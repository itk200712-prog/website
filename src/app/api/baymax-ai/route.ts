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
  DEFAULT_GEMINI_MODEL,
  extractGeminiText,
  isAiEnabledValue,
  normalizeAiQuestion,
  normalizeGeminiModel,
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
  apiKey: string;
  /** server එකට key එක කියවන්න විදිහක් තියෙනවද (env key හෝ service-role key) */
  serverConfigured: boolean;
};

async function loadConfig(): Promise<AiConfig> {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const envKey = (process.env.GEMINI_API_KEY ?? "").trim();

  let enabled = false;
  let model: string = DEFAULT_GEMINI_MODEL;
  const readKey = serviceKey || anonKey;
  if (readKey) {
    const rows = (await supabaseRest(
      "system_settings?select=key,value&key=in.(chat_ai_enabled,chat_ai_model)",
      readKey
    )) as { key: string; value: string }[] | null;
    const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
    enabled = isAiEnabledValue(map.get("chat_ai_enabled"));
    model = normalizeGeminiModel(map.get("chat_ai_model"));
  }

  let apiKey = envKey;
  if (!apiKey && serviceKey) {
    const rows = (await supabaseRest(
      "backup_secrets?select=value&key=eq.gemini_api_key",
      serviceKey
    )) as { value: string }[] | null;
    apiKey = String(rows?.[0]?.value ?? "").trim();
  }

  return { enabled, model, apiKey, serverConfigured: Boolean(envKey || serviceKey) };
}

/** Admin → Live Chat එකේ setup status එක පෙන්වන්න (key එක return වෙන්නේ නෑ) */
export async function GET(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, reason: "forbidden" }, 403);
  const c = await loadConfig();
  return json({
    ok: true,
    enabled: c.enabled,
    configured: Boolean(c.apiKey),
    serverConfigured: c.serverConfigured,
    model: c.model,
  });
}

type GeminiResult = { ok: true; answer: string } | { ok: false; status: number };

async function callGemini(
  apiKey: string,
  model: string,
  question: string,
  language: BaymaxAiLanguage,
  useSearch: boolean
): Promise<GeminiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(buildGeminiRequest(question, language, useSearch)),
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
    const answer = extractGeminiText(payload);
    return answer ? { ok: true, answer } : { ok: false, status: 200 };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, reason: "forbidden" }, 403);
  if (rateLimited(req)) return json({ ok: false, reason: "rate_limited" }, 429);

  let body: { question?: unknown; language?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }
  const question = normalizeAiQuestion(body.question);
  if (question.length < 2) return json({ ok: false, reason: "empty_question" }, 400);
  const language: BaymaxAiLanguage = body.language === "en" ? "en" : "si";

  const c = await loadConfig();
  if (!c.enabled) return json({ ok: false, reason: "disabled" });
  if (!c.serverConfigured) return json({ ok: false, reason: "server_not_configured" });
  if (!c.apiKey) return json({ ok: false, reason: "not_configured" });

  let result = await callGemini(c.apiKey, c.model, question, language, true);
  // තෝරපු model එක search grounding support නොකළොත් search නැතිව ආයෙත් උත්සාහ කරයි
  if (!result.ok && result.status === 400) {
    result = await callGemini(c.apiKey, c.model, question, language, false);
  }
  if (result.ok) return json({ ok: true, answer: result.answer, model: c.model });
  return json({
    ok: false,
    reason:
      result.status === 404
        ? "invalid_model"
        : result.status === 400 || result.status === 401 || result.status === 403
          ? "invalid_key"
          : "ai_error",
    status: result.status || undefined,
  });
}
