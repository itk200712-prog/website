// ============================================================================
//  POST /api/baymax-ai — Baymax ගේ Gemini AI fallback එක (server-side only)
//  Gemini API key එක browser එකට කවදාවත් යන්නේ නෑ:
//    · Admin → Live Chat එකෙන් save කරන key එක backup_secrets එකේ
//      (superadmin-only RLS) තියෙන්නේ; මේ route එක එය කියවන්නේ
//      Vercel env එකේ ඇති SUPABASE_SERVICE_ROLE_KEY එකෙන් විතරයි.
//    · නැත්නම් කෙලින්ම GEMINI_API_KEY env එකක් තිබුණොත් එයත් හරි.
//  Enable/Model settings දෙක system_settings (public) එකේ — ඒවා රහස් නෙමෙයි.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  buildGeminiRequest,
  collectApiKeys,
  DEFAULT_GEMINI_MODEL,
  extractGeminiResult,
  GEMINI_API_KEY_SLOTS,
  isAiEnabledValue,
  modelFallbackChain,
  needsWebSearch,
  normalizeAiHistory,
  normalizeAiQuestion,
  normalizeGeminiModel,
  preferredAiModel,
  withSourceLinks,
  type AiHistoryTurn,
  type AiSourceLink,
  type BaymaxAiLanguage,
} from "@/lib/baymax-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** අපේම site එකෙන් එන request විතරක් (පිට අයට quota එක කන්න බෑ) */
function sameOrigin(req: NextRequest): boolean {
  const source = req.headers.get("origin") || req.headers.get("referer");
  if (!source) return process.env.NODE_ENV !== "production";
  try {
    const host = (req.headers.get("x-forwarded-host") || req.nextUrl.host).split(",")[0].trim();
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

// සරල rate-limit එකක් (serverless instance එක තුළ) — IP එකකට විනාඩියකට 12යි
const hits = new Map<string, number[]>();
function rateLimited(req: NextRequest): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 12;
}

async function supabaseRest(path: string, key: string): Promise<unknown[] | null> {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base || !key) return null;
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

type AiConfig = {
  enabled: boolean;
  model: string;
  /** rotation පිළිවෙළට ඇති keys (env key එක මුලින්ම, පසුව Admin එකෙන් දාපු 1–5) */
  apiKeys: string[];
  /** server එකට key එක කියවන්න විදිහක් තියෙනවද (env key හෝ service-role key) */
  serverConfigured: boolean;
};

// හැම AI ප්‍රශ්නයකදීම Supabase එකට දෙපාරක් යන එක response එක පරක්කු කරයි.
// Warm serverless instance එකක config එක තත්පර 30ක් cache කර, settings සහ
// secrets කියවීම් දෙකම එකවර (parallel) කරයි. Admin වෙනසක් උපරිම තත්පර 30කින් පෙනේ.
const CONFIG_CACHE_TTL_MS = 30_000;
let configCache: { at: number; config: AiConfig } | null = null;

async function loadConfig(): Promise<AiConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_CACHE_TTL_MS) {
    return configCache.config;
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const envKey = (process.env.GEMINI_API_KEY ?? "").trim();
  const readKey = serviceKey || anonKey;

  const [settingsRowsRaw, secretRowsRaw] = await Promise.all([
    readKey
      ? supabaseRest("system_settings?select=key,value&key=in.(chat_ai_enabled,chat_ai_model)", readKey)
      : Promise.resolve(null),
    serviceKey
      ? supabaseRest(`backup_secrets?select=key,value&key=in.(${GEMINI_API_KEY_SLOTS.join(",")})`, serviceKey)
      : Promise.resolve(null),
  ]);

  let enabled = false;
  let model: string = DEFAULT_GEMINI_MODEL;
  let settingsOk = !readKey;
  if (readKey) {
    const rows = settingsRowsRaw as { key: string; value: string }[] | null;
    settingsOk = rows !== null;
    const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
    enabled = isAiEnabledValue(map.get("chat_ai_enabled"));
    model = normalizeGeminiModel(map.get("chat_ai_model"));
  }

  // Admin එකෙන් දාපු keys 5ම (slot පිළිවෙළට) — එකක් limit වුණොත් ඊළඟ එක
  let storedKeys: string[] = [];
  let secretsOk = !serviceKey;
  if (serviceKey) {
    const rows = secretRowsRaw as { key: string; value: string }[] | null;
    secretsOk = rows !== null;
    const bySlot = new Map((rows ?? []).map((r) => [r.key, r.value]));
    storedKeys = GEMINI_API_KEY_SLOTS.map((slot) => bySlot.get(slot) ?? "");
  }
  const apiKeys = collectApiKeys([envKey, ...storedKeys]);
  const config = { enabled, model, apiKeys, serverConfigured: Boolean(envKey || serviceKey) };

  // Network අසාර්ථක වීමක් cache කරන්නේ නෑ — ඊළඟ ප්‍රශ්නයේදීම ආයේ උත්සාහ කරයි.
  if (settingsOk && secretsOk) configCache = { at: Date.now(), config };
  return config;
}

/** Admin → Live Chat එකේ setup status එක පෙන්වන්න (key එක return වෙන්නේ නෑ) */
export async function GET(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, reason: "forbidden" }, 403);
  const c = await loadConfig();
  return json({
    ok: true,
    enabled: c.enabled,
    configured: c.apiKeys.length > 0,
    keys: c.apiKeys.length,
    serverConfigured: c.serverConfigured,
    model: c.model,
  });
}

type GeminiResult = { ok: true; answer: string } | { ok: false; status: number };

/** continuation කොටසක් පෙර පිළිතුරට අමුණනවා — වචනයක් මැදින් කැඩෙන්නේ නැතිව */
function appendContinuation(current: string, next: string): string {
  if (!current) return next;
  if (!next) return current;
  if (/\s$/.test(current) || /^\s/.test(next)) return current + next;
  if (/^[.,!?;:%)]/.test(next)) return current + next;
  return `${current} ${next}`;
}

const GEMINI_ATTEMPT_TIMEOUT_MS = 14_000;
const AI_TOTAL_DEADLINE_MS = 32_000;

async function callGemini(
  apiKey: string,
  model: string,
  question: string,
  language: BaymaxAiLanguage,
  useSearch: boolean,
  history: AiHistoryTurn[],
  deadlineAt: number
): Promise<GeminiResult> {
  let fullAnswer = "";
  const sources: AiSourceLink[] = [];
  let requestQuestion = question;
  let requestHistory = history;

  // පිළිතුර token සීමාවෙන් (MAX_TOKENS) මැදින් කැඩුණොත්, නැවතුණු තැනින්ම
  // ඉතිරිය ලියවා ගෙන සම්පූර්ණ පිළිතුරක් විදිහට යවනවා — අඩක් උත්තර බෑ.
  // එක් attempt එකක් තත්පර 14කට සීමා කර ඇති නිසා hang වන model/key එකක්
  // නිසා මුළු chat එකම විනාඩියක් නවතින්නේ නෑ.
  for (let pass = 0; pass < 3; pass++) {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 750) {
      return fullAnswer
        ? { ok: true, answer: withSourceLinks(fullAnswer, sources, language) }
        : { ok: false, status: 408 };
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.max(750, Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remaining))
    );
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(buildGeminiRequest(requestQuestion, language, pass === 0 && useSearch, requestHistory)),
          signal: controller.signal,
          cache: "no-store",
        }
      );
      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        /* හිස් response එකක් වෙන්න පුළුවන් */
      }
      if (!res.ok) return { ok: false, status: res.status };
      const result = extractGeminiResult(payload);
      if (!result.text) return fullAnswer ? { ok: true, answer: withSourceLinks(fullAnswer, sources, language) } : { ok: false, status: 200 };
      fullAnswer = pass === 0 ? result.text : appendContinuation(fullAnswer, result.text);
      for (const s of result.sources) {
        if (!sources.some((x) => x.uri === s.uri)) sources.push(s);
      }
      if (result.finishReason !== "MAX_TOKENS") break;
      requestHistory = [...history, { role: "user", text: question }, { role: "model", text: fullAnswer }];
      requestQuestion =
        "Continue exactly where the previous answer stopped and finish it completely. Do not repeat anything already written, do not add a new introduction, and make sure the final sentence is complete.";
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      return fullAnswer
        ? { ok: true, answer: withSourceLinks(fullAnswer, sources, language) }
        : { ok: false, status: timedOut ? 408 : 0 };
    } finally {
      clearTimeout(timer);
    }
  }

  return fullAnswer ? { ok: true, answer: withSourceLinks(fullAnswer, sources, language) } : { ok: false, status: 200 };
}

type GeminiAnswer = { ok: true; answer: string; model: string } | { ok: false; status: number };

/**
 * තෝරපු model එක මුලින්ම (Google Search එක්ක). Search එකට 400/429 ආවොත්
 * search නැතිවත් උත්සාහ කරනවා — search grounding quota එක වෙනම නිසා.
 * Model එකක් නැත්නම් (404) හෝ එහි quota ඉවර නම් (429) ඊළඟ model එකට යනවා;
 * quota එක model එක අනුව වෙනස් නිසා එකක් බ්ලොක් වුණත් අනිකෙන් උත්තරේ එන්න පුළුවන්.
 */
/** එක් key එකකින් කෙටි model fallback chain එක උත්සාහ කරයි (deadline එක තුළ) */
async function tryWithKey(
  apiKey: string,
  selectedModel: string,
  question: string,
  language: BaymaxAiLanguage,
  history: AiHistoryTurn[],
  searchPreferred: boolean,
  deadlineAt: number
): Promise<GeminiAnswer> {
  const chain = modelFallbackChain(selectedModel);
  let lastStatus = 0;

  for (let i = 0; i < chain.length; i++) {
    if (Date.now() >= deadlineAt) break;
    const model = chain[i];
    // Search අවශ්‍ය ප්‍රශ්නයකට පමණක් මුලින් search; සාමාන්‍ය ප්‍රශ්නයකට
    // search නැති වේගවත් මාර්ගයමයි. Search එක අසාර්ථක නම් එකම model එකෙන්
    // search නැතිව එක් වරක් උත්සාහ කරයි.
    const attempts = searchPreferred ? [true, false] : [false];
    for (const useSearch of attempts) {
      if (Date.now() >= deadlineAt) break;
      const result = await callGemini(apiKey, model, question, language, useSearch, history, deadlineAt);
      if (result.ok) return { ok: true, answer: result.answer, model };
      lastStatus = result.status;
      // search එක්ක ගැටලුවක් නම් විතරක් search නැති උත්සාහයට යනවා
      if (useSearch && ![400, 408, 429].includes(result.status)) break;
    }
    // Key එක වැරදි/අවසර නැති නම් මේ key එකෙන් තව models උත්සාහ කරන්නේ නෑ.
    // 404 (model නෑ), 408 (timeout), 429 (quota), 5xx/network නම් ඊළඟ model එකට.
    if (lastStatus === 401 || lastStatus === 403) break;
    if (lastStatus === 400 && !searchPreferred) break;
  }

  return { ok: false, status: lastStatus };
}

/**
 * Key rotation: පළමු key එකෙන් පටන් ගනී. එහි quota/limit ඉවර නම් (429)
 * හෝ key එක වලංගු නැත්නම් (400/401/403) ඊළඟ key එකට auto මාරු වේ —
 * Key 1 → Key 2 → Key 3 … keys ඉවර වෙනකම්ම.
 */
async function callGeminiWithFallbacks(
  apiKeys: string[],
  selectedModel: string,
  question: string,
  language: BaymaxAiLanguage,
  history: AiHistoryTurn[]
): Promise<GeminiAnswer> {
  const deadlineAt = Date.now() + AI_TOTAL_DEADLINE_MS;
  const model = preferredAiModel(question, selectedModel);
  const searchPreferred = needsWebSearch(question);
  let lastStatus = 0;
  for (const apiKey of apiKeys) {
    if (Date.now() >= deadlineAt) break;
    const result = await tryWithKey(apiKey, model, question, language, history, searchPreferred, deadlineAt);
    if (result.ok) return result;
    lastStatus = result.status;
    // quota/key/model/timeout/network ගැටලුවක් නම් ඊළඟ key එකට යනවා;
    // මුළු උත්සාහයම deadline එකෙන් සීමා වී ඇති නිසා chat එක එල්ලිලා තියෙන්නේ නෑ.
    if (![0, 400, 401, 403, 404, 408, 429].includes(lastStatus) && lastStatus < 500) break;
  }
  return { ok: false, status: lastStatus };
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, reason: "forbidden" }, 403);
  if (rateLimited(req)) return json({ ok: false, reason: "rate_limited" }, 429);

  let body: { question?: unknown; language?: unknown; history?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }
  const question = normalizeAiQuestion(body.question);
  if (question.length < 2) return json({ ok: false, reason: "empty_question" }, 400);
  const language: BaymaxAiLanguage = body.language === "en" ? "en" : "si";
  const history = normalizeAiHistory(body.history);

  const c = await loadConfig();
  if (!c.enabled) return json({ ok: false, reason: "disabled" });
  if (!c.serverConfigured) return json({ ok: false, reason: "server_not_configured" });
  if (!c.apiKeys.length) return json({ ok: false, reason: "not_configured" });

  const result = await callGeminiWithFallbacks(c.apiKeys, c.model, question, language, history);
  if (result.ok) return json({ ok: true, answer: result.answer, model: result.model });
  return json({
    ok: false,
    reason:
      result.status === 429
        ? "quota_exceeded"
        : result.status === 408
          ? "ai_timeout"
          : result.status === 404
            ? "invalid_model"
            : result.status === 400 || result.status === 401 || result.status === 403
              ? "invalid_key"
              : "ai_error",
    status: result.status || undefined,
  });
}
