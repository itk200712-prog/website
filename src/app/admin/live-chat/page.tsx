"use client";

// ============================================================================
// Admin → Live Chat (⑳)
//  · Live Chat email setting (contact requests යන ලිපිනය)
//  · Usage analytics — opens, searches, contact requests, 7-day chart
//  · Recent chat activity + contact requests (call back list)
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bot, CheckCircle2, Clock, KeyRound, Mail, MessageCircle, Phone,
  RefreshCw, Save, Search, Send, Sparkles, Trash2, TrendingUp, Upload, UserRound, X as XIcon,
} from "lucide-react";
import { AdminStatCard, AdminTopbar, dbUpdate, useNotice } from "@/components/admin";
import { AdminLiveChats } from "@/components/admin-live-chats";
import { authedClient } from "@/lib/supabase/client";
import { uploadSiteImage } from "@/lib/supabase/storage";
import { logActivity } from "@/lib/activity";
import {
  DEFAULT_GEMINI_MODEL, GEMINI_MODEL_OPTIONS, isAiEnabledValue, maskSecret, normalizeGeminiModel,
} from "@/lib/baymax-ai";

/** /api/baymax-ai එකෙන් එන reason එක admin ට තේරෙන වාක්‍යයකට */
function aiReasonText(reason?: string, status?: number): string {
  switch (reason) {
    case "server_not_configured":
      return "Server setup එක අඩුයි — Vercel එකට SUPABASE_SERVICE_ROLE_KEY env එක දාලා redeploy කරන්න (පහත පියවර බලන්න).";
    case "not_configured":
      return "තාම Gemini API key එකක් save කරලා නෑ — key එක paste කරලා Save කරන්න.";
    case "disabled":
      return "AI එක off කරලා තියෙන්නේ — උඩින් enable කරලා Save කරන්න.";
    case "invalid_key":
      return "Gemini API key එක වැරදියි වගේ (Google එකෙන් reject වුණා) — key එක ආයේ check කරලා save කරන්න.";
    case "invalid_model":
      return "තෝරපු model එක හමු නොවීය — වෙනත් model එකක් තෝරලා Save කරන්න.";
    case "quota_exceeded":
      return "Gemini quota/rate limit එක ඉවරයි (429) — server එක වෙනත් models ද උත්සාහ කළා. ටික වෙලාවක් ඉඳලා ආයේ Test කරන්න; දිගටම එනවා නම් Google AI Studio එකේ quota/billing එක බලන්න, නැත්නම් අලුත් key එකක් දාන්න.";
    case "rate_limited":
      return "විනාඩියක් තුළ ප්‍රශ්න ගොඩක් ආවා — ටිකක් ඉඳලා ආයේ උත්සාහ කරන්න.";
    default:
      return `Gemini එකෙන් පිළිතුරක් ලැබුණේ නෑ${status ? ` (status ${status})` : ""} — ටිකකින් ආයේ උත්සාහ කරන්න.`;
  }
}

type Event = { id: string; event_type: string; query: string; matched: number; session_id: string; created_at: string };
type Msg = {
  id: string; name: string; phone: string; email: string; department: string;
  subject: string; message: string; status: string; created_at: string;
};

const TYPE_META: Record<string, { label: string; tone: string; icon: typeof Activity }> = {
  open: { label: "Chat opened", tone: "bg-indigo-50 text-indigo-700", icon: MessageCircle },
  search: { label: "Member search", tone: "bg-sky-50 text-sky-700", icon: Search },
  member_no: { label: "Member No lookup", tone: "bg-violet-50 text-violet-700", icon: UserRound },
  managers: { label: "Business managers", tone: "bg-amber-50 text-amber-700", icon: UserRound },
  office: { label: "Office phones", tone: "bg-emerald-50 text-emerald-700", icon: Phone },
  mphone: { label: "Managers phones", tone: "bg-teal-50 text-teal-700", icon: Phone },
  contact: { label: "Contact request", tone: "bg-fuchsia-50 text-fuchsia-700", icon: Send },
  message: { label: "Message form", tone: "bg-slate-100 text-slate-700", icon: Mail },
  search_error: { label: "Search error", tone: "bg-rose-50 text-rose-700", icon: Activity },
  intent_officer: { label: "Asked for an officer", tone: "bg-fuchsia-50 text-fuchsia-700", icon: MessageCircle },
  ask_officer: { label: "Officer Yes/No prompt", tone: "bg-fuchsia-50 text-fuchsia-700", icon: MessageCircle },
  decline_officer: { label: "Officer — declined", tone: "bg-slate-100 text-slate-600", icon: XIcon },
  ai_answer: { label: "AI answer (Gemini)", tone: "bg-indigo-50 text-indigo-700", icon: Sparkles },
  ai_quota: { label: "AI quota/limit", tone: "bg-rose-50 text-rose-700", icon: Sparkles },
};

export default function AdminLiveChatPage() {
  const { show, node } = useNotice();
  // ✅ Chat bot (Baymax) — නම + avatar
  const [botName, setBotName] = useState("Baymax");
  const [botAvatar, setBotAvatar] = useState("");
  const [savingBot, setSavingBot] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [requests, setRequests] = useState<Msg[]>([]);
  const [tablesMissing, setTablesMissing] = useState(false);
  const [view, setView] = useState<"overview" | "chats">("overview");
  const [chatCount, setChatCount] = useState({ active: 0, unread: 0 });

  // ✨ Baymax AI (Gemini) — enable/model එක public settings, key එක backup_secrets (superadmin-only)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiKeyMask, setAiKeyMask] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sb = await authedClient();
      const { data: st } = await sb
        .from("system_settings")
        .select("key,value")
        .in("key", ["chat_bot_name", "chat_bot_avatar", "chat_ai_enabled", "chat_ai_model"]);
      const map = new Map(((st ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
      setBotName((map.get("chat_bot_name") || "Baymax").trim() || "Baymax");
      setBotAvatar((map.get("chat_bot_avatar") || "").trim());
      setAiEnabled(isAiEnabledValue(map.get("chat_ai_enabled")));
      setAiModel(normalizeGeminiModel(map.get("chat_ai_model")));

      // Gemini key එක superadmin ට විතරයි (backup_secrets RLS) — mask එක විතරක් තබා ගනී
      const { data: u } = await sb.auth.getUser();
      let superAdmin = false;
      if (u?.user) {
        const { data: prof } = await sb.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
        superAdmin = (prof as { role?: string } | null)?.role === "superadmin";
      }
      setIsSuperAdmin(superAdmin);
      if (superAdmin) {
        const { data: keyRow } = await sb
          .from("backup_secrets")
          .select("value")
          .eq("key", "gemini_api_key")
          .maybeSingle();
        setAiKeyMask(maskSecret((keyRow as { value?: string } | null)?.value));
      }
      void refreshAiStatus();

      const { data: ev, error: evErr } = await sb
        .from("live_chat_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(400);
      if (evErr) {
        if (/does not exist|relation|42P01|could not find the table|PGRST205|schema cache/i.test(evErr.message)) setTablesMissing(true);
        setEvents([]);
      } else {
        setTablesMissing(false);
        setEvents((ev ?? []) as Event[]);
      }

      const { data: cs } = await sb.from("chat_sessions").select("unread_admin,status").neq("status", "closed").limit(200);
      const chatRows = (cs ?? []) as { unread_admin: number; status: string }[];
      setChatCount({ active: chatRows.length, unread: chatRows.reduce((a, r) => a + (r.unread_admin || 0), 0) });

      const { data: msgs } = await sb
        .from("messages")
        .select("*")
        .in("department", ["Live Chat", "Live Chat Contact"])
        .order("created_at", { ascending: false })
        .limit(60);
      setRequests((msgs ?? []) as Msg[]);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBotImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    // ✅ 512px WebP ට auto කුඩා කර upload (quality තියාගෙන)
    const r = await uploadSiteImage(f, "chat", { maxSize: 512, quality: 0.92 });
    setUploading(false);
    e.target.value = "";
    if (r.url) {
      setBotAvatar(r.url);
      show("✅ පින්තූරය upload වුණා — Save ඔබන්න");
    } else {
      show(`⚠ ${r.error ?? "upload failed"}`);
    }
  }

  async function saveBot() {
    setSavingBot(true);
    const name = botName.trim() || "Baymax";
    const sb = await authedClient();
    const { error } = await sb.from("system_settings").upsert(
      [
        { key: "chat_bot_name", value: name },
        { key: "chat_bot_avatar", value: botAvatar.trim() },
      ],
      { onConflict: "key" }
    );
    setSavingBot(false);
    if (error) return show(`⚠ ${error.message}`);
    setBotName(name);
    show("✅ Chat bot settings saved — Live Chat එකේ වහාම පේනවා");
  }

  /** server එකට key එක පේනවද කියා බලනවා (key එක ආපසු එන්නේ නෑ — status එක විතරයි) */
  async function refreshAiStatus() {
    try {
      const r = await fetch("/api/baymax-ai", { cache: "no-store" });
      const j = (await r.json()) as { ok?: boolean; serverConfigured?: boolean; configured?: boolean; enabled?: boolean };
      if (!j.ok) return;
      setAiStatus(
        !j.serverConfigured
          ? "🔴 Server setup එක අඩුයි — Vercel එකට SUPABASE_SERVICE_ROLE_KEY env එක දාලා redeploy කරන්න (පහත පියවර බලන්න)."
          : j.configured
            ? `🟢 Server ready — Gemini key එක server එකට පේනවා${j.enabled ? " · AI on කරලා තියෙන්නේ" : " · AI තාම off"}`
            : "🟡 Server ready — තාම Gemini API key එකක් save කරලා නෑ."
      );
    } catch {
      setAiStatus("⚠ AI server status එක ගන්න බැරි වුණා — site එක deploy වුණාට පස්සේ ආයේ බලන්න.");
    }
  }

  async function saveAi() {
    setSavingAi(true);
    const sb = await authedClient();
    const model = normalizeGeminiModel(aiModel);
    const { error } = await sb.from("system_settings").upsert(
      [
        { key: "chat_ai_enabled", value: aiEnabled ? "1" : "0" },
        { key: "chat_ai_model", value: model },
      ],
      { onConflict: "key" }
    );
    if (error) {
      setSavingAi(false);
      return show(`⚠ ${error.message}`);
    }

    let keyUpdated = false;
    const newKey = aiKeyInput.trim();
    if (newKey) {
      if (!isSuperAdmin) {
        setSavingAi(false);
        return show("⚠ API key එක save කරන්න superadmin ගිණුමෙන් login වෙන්න ඕනේ");
      }
      if (newKey.length < 12) {
        setSavingAi(false);
        return show("⚠ මේක හරි Gemini API key එකක් වගේ නැහැ — ආයේ check කරන්න");
      }
      const { error: keyErr } = await sb
        .from("backup_secrets")
        .upsert({ key: "gemini_api_key", value: newKey }, { onConflict: "key" });
      if (keyErr) {
        setSavingAi(false);
        return show(`⚠ ${keyErr.message}`);
      }
      setAiKeyMask(maskSecret(newKey));
      setAiKeyInput("");
      keyUpdated = true;
    }

    setAiModel(model);
    setSavingAi(false);
    void logActivity(
      "AI_SETTINGS",
      `Baymax Gemini AI ${aiEnabled ? "enabled" : "disabled"} · model ${model}${keyUpdated ? " · API key updated" : ""}`
    );
    show("✅ Gemini AI settings saved — Baymax එකේ වහාම බලපානවා");
    void refreshAiStatus();
  }

  async function clearAiKey() {
    if (!isSuperAdmin) return;
    setSavingAi(true);
    const sb = await authedClient();
    const { error } = await sb
      .from("backup_secrets")
      .upsert({ key: "gemini_api_key", value: "" }, { onConflict: "key" });
    setSavingAi(false);
    if (error) return show(`⚠ ${error.message}`);
    setAiKeyMask("");
    setAiKeyInput("");
    void logActivity("AI_SETTINGS", "Baymax Gemini API key cleared");
    show("✅ Gemini API key එක ඉවත් කළා");
    void refreshAiStatus();
  }

  /** සජීවී test එකක් — "සමූපකාරයක් යනු කුමක්ද?" කියා ඇත්තටම අහලා බලනවා */
  async function testAi() {
    setTestingAi(true);
    setAiStatus("⏳ Test කරනවා… Gemini එකෙන් සිංහල උත්තරයක් ඉල්ලනවා");
    try {
      const r = await fetch("/api/baymax-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "සමූපකාරයක් යනු කුමක්ද? වාක්‍ය දෙකකින් කෙටියෙන් කියන්න.",
          language: "si",
        }),
      });
      const j = (await r.json()) as { ok?: boolean; answer?: string; reason?: string; status?: number; model?: string };
      if (j.ok && j.answer) {
        setAiStatus(`✅ වැඩ කරනවා!${j.model ? ` (model: ${j.model})` : ""} උදාහරණ පිළිතුර:\n${String(j.answer).slice(0, 260)}`);
      } else {
        setAiStatus(`⚠ ${aiReasonText(j.reason, j.status)}`);
      }
    } catch {
      setAiStatus("⚠ Test එක යවන්න බැරි වුණා — network එක check කරලා ආයේ උත්සාහ කරන්න.");
    }
    setTestingAi(false);
  }

  async function markHandled(m: Msg) {
    const err = await dbUpdate("messages", { id: m.id }, { status: "read" });
    if (err) return show(`⚠ ${err}`);
    setRequests((xs) => xs.map((x) => (x.id === m.id ? { ...x, status: "read" } : x)));
    show("✅ handled ලෙස සලකුණු කළා");
  }

  /* ------------------------------- stats ------------------------------- */
  const stats = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const t0 = startOfDay.getTime();

    const opens = events.filter((e) => e.event_type === "open");
    const searches = events.filter((e) => e.event_type === "search");
    const contacts = events.filter((e) => e.event_type === "contact");
    const sessions = new Set(events.map((e) => e.session_id).filter(Boolean));

    const today = events.filter((e) => new Date(e.created_at).getTime() >= t0).length;
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      days.push({
        label: d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2),
        count: opens.filter((e) => {
          const t = new Date(e.created_at).getTime();
          return t >= d.getTime() && t < next.getTime();
        }).length,
      });
    }
    const max = Math.max(1, ...days.map((x) => x.count));

    const counts = new Map<string, number>();
    searches.forEach((s) => {
      const k = s.query.trim().toLowerCase();
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const topQueries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const unmatched = searches.filter((s) => s.matched === 0).length;

    return {
      total: events.length,
      today,
      opens: opens.length,
      searches: searches.length,
      contacts: contacts.length,
      sessions: sessions.size,
      unmatched,
      days,
      max,
      topQueries,
      pending: requests.filter((r) => r.status === "unread").length,
    };
  }, [events, requests]);

  const recent = events.slice(0, 25);

  const tabs = (
    <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        onClick={() => setView("overview")}
        className={`rounded-lg px-3.5 py-1.5 text-[11.5px] font-extrabold transition ${view === "overview" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
      >
        📊 Overview
      </button>
      <button
        onClick={() => setView("chats")}
        className={`relative rounded-lg px-3.5 py-1.5 text-[11.5px] font-extrabold transition ${view === "chats" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
      >
        💬 Live Chats
        {chatCount.unread > 0 && (
          <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white">{chatCount.unread}</span>
        )}
      </button>
    </div>
  );

  if (view === "chats") {
    return (
      <div>
        {node}
        <AdminTopbar title="Live Chat" sub="Visitor chats — කෙලින්ම කතා කරන්න" />
        {tabs}
        <AdminLiveChats />
      </div>
    );
  }

  return (
    <div>
      {node}
      <AdminTopbar title="Live Chat" sub="Chat settings · usage analytics · contact requests" />
      {tabs}

      {/* ── Live chat entry — පැහැදිලිවම ── */}
      <button
        onClick={() => setView("chats")}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-3.5 text-left text-white shadow-lg shadow-indigo-600/20 hover:opacity-95 transition"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <MessageCircle size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-extrabold">Live Chats — visitor ලා සමඟ කෙලින්ම කතා කරන්න</span>
          <span className="block text-[11px] text-indigo-100">
            {chatCount.active} active chat{chatCount.active === 1 ? "" : "s"}
            {chatCount.unread > 0 ? ` · ${chatCount.unread} new message${chatCount.unread === 1 ? "" : "s"}` : " · අලුත් messages නෑ"}
          </span>
        </span>
        {chatCount.unread > 0 && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-rose-600">{chatCount.unread}</span>}
        <span className="shrink-0 text-[11.5px] font-extrabold">අරින්න →</span>
      </button>

      {tablesMissing && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-[12.5px] font-extrabold text-amber-800">⚠ live_chat_events table එක තවම හදලා නෑ</div>
          <p className="mt-1 text-[11.5px] text-amber-700">
            supabase/schema.sql එකේ අන්තිම "§20. LIVE CHAT" block එක Supabase → SQL Editor එකේ run කරන්න. ඊට පස්සේ usage analytics පිරෙනවා.
          </p>
        </div>
      )}

      {/* ── chat bot (Baymax) settings ── */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <Bot size={15} className="text-indigo-600" /> Chat bot — නම සහ පින්තූරය
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              Site එකේ Live Chat widget එකේ පේන bot නම සහ avatar එක. Upload කරන පින්තූරය auto කුඩා කරලා (512px · WebP) storage එකට යනවා — quality එක එහෙමම.
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-1">LIVE CHAT</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
            {botAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={botAvatar} alt="bot avatar" className="h-full w-full object-cover" />
            ) : (
              <Bot size={26} />
            )}
          </div>

          <div className="flex flex-col items-start gap-1.5">
            <label className={`btn btn-outline !py-2 !px-3 !text-[11.5px] cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              <Upload size={13} /> {uploading ? "Uploading…" : "Avatar upload"}
              <input type="file" accept="image/*" className="hidden" onChange={onBotImage} disabled={uploading} />
            </label>
            {botAvatar && (
              <button type="button" onClick={() => setBotAvatar("")} className="text-[11px] font-bold text-rose-600 hover:underline">
                පින්තූරය ඉවත් කරන්න
              </button>
            )}
          </div>

          <div className="min-w-[200px] flex-1">
            <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Bot නම</label>
            <input
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Baymax"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:bg-white"
            />
          </div>

          <button onClick={() => void saveBot()} disabled={savingBot} className="btn btn-primary !py-2.5 !px-4 !text-[12px]">
            <Save size={13} /> {savingBot ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ✨ Baymax AI (Gemini) settings */}
      <div className="mb-5 rounded-2xl border border-indigo-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <Sparkles size={15} className="text-indigo-600" /> Baymax AI — Gemini (පොදු දැනුම් ප්‍රශ්න)
            </div>
            <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-slate-500">
              Site එකේ තොරතුරු වලින් උත්තර නැති පොදු ප්‍රශ්නවලට (උදා: “සමූපකාරයක් යනු කුමක්ද?”)
              Gemini AI එක Google Search එකත් බලලා උත්තර දෙයි. අහන භාෂාවෙන්මයි — සිංහලෙන් ඇහුවොත් සිංහලෙන්ම.
              Site එකේ ඇත්ත තොරතුරු (අංක, මිල, නම්) කලින් වගේම site brain එකෙන්මයි; AI එක ඒවා හදලා කියන්නේ නෑ.
            </p>
          </div>
          <span className={`rounded-full text-[10px] font-black px-2 py-1 ${aiEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {aiEnabled ? "AI ON" : "AI OFF"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-700">
            <input type="checkbox" className="mt-0.5" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
            <span><b>Gemini AI එක on කරන්න</b><br /><span className="text-slate-500">Site brain එකට උත්තර නැති ප්‍රශ්නවලට විතරයි AI එක කැඳවන්නේ.</span></span>
          </label>

          <div>
            <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Gemini model එක</label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:bg-white"
            >
              {!GEMINI_MODEL_OPTIONS.some((o) => o.value === aiModel) && <option value={aiModel}>{aiModel}</option>}
              {GEMINI_MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
              <KeyRound size={11} /> Gemini API key එක
            </label>
            <input
              type="password"
              value={aiKeyInput}
              onChange={(e) => setAiKeyInput(e.target.value)}
              disabled={!isSuperAdmin}
              autoComplete="new-password"
              placeholder={aiKeyMask ? "අලුත් key එකක් දාන්න නම් මෙතැන paste කරන්න (හිස් තිබ්බොත් පරණ එකම තියේවි)" : "Gemini API key එක මෙතැන paste කරන්න…"}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:bg-white disabled:opacity-50"
            />
            <div className="mt-1.5 text-[11px] text-slate-500">
              {!isSuperAdmin
                ? "🔒 API key එක බලන්න/වෙනස් කරන්න superadmin ගිණුමෙන් login වෙන්න ඕනේ."
                : aiKeyMask
                  ? <>🔒 දැනට save වී ඇති key එක: <b>{aiKeyMask}</b> (සම්පූර්ණ එක ආයෙත් පෙන්වන්නේ නෑ)</>
                  : "තාම key එකක් save කරලා නෑ."}{" "}
              Key එකක් නැත්නම්{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-bold text-indigo-700 hover:underline">
                Google AI Studio එකෙන් නොමිලේ ගන්න →
              </a>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => void saveAi()} disabled={savingAi} className="btn btn-primary !py-2.5 !px-4 !text-[12px]">
            <Save size={13} /> {savingAi ? "Saving…" : "Save AI settings"}
          </button>
          <button onClick={() => void testAi()} disabled={testingAi || savingAi} className="btn btn-outline !py-2.5 !px-4 !text-[12px]">
            <Sparkles size={13} /> {testingAi ? "Testing…" : "Test කරන්න"}
          </button>
          {aiKeyMask && isSuperAdmin && (
            <button onClick={() => void clearAiKey()} disabled={savingAi} className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-rose-600 hover:underline">
              <Trash2 size={12} /> Key එක ඉවත් කරන්න
            </button>
          )}
        </div>

        {aiStatus && (
          <div className="mt-3 whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-700">
            {aiStatus}
          </div>
        )}

        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-800">
          <b>⚠ එක වරක් කරන server setup එක (අනිවාර්යයි):</b> API key එක visitor ට පේන්නේ නැතිව server එකට කියවන්න
          පුළුවන් වෙන්න — ① Supabase → Project Settings → API Keys එකෙන් <b>service_role</b> secret එක copy කරන්න
          (කාටවත් එවන්න එපා) · ② Vercel → Project → Settings → Environment Variables එකට නම{" "}
          <code className="rounded bg-white/70 px-1 font-bold">SUPABASE_SERVICE_ROLE_KEY</code> කියා ඒක දාන්න
          (<b>NEXT_PUBLIC_</b> කියා පටන් ගන්න එපා!) · ③ Vercel එකෙන් <b>Redeploy</b> කරන්න · ④ ඊට පස්සේ මෙතැනින්
          Gemini key එක paste කරලා, AI on කරලා Save → Test කරන්න.
        </div>
      </div>

      {/* ── stats ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 mb-5">
        <AdminStatCard tag="TODAY" value={String(stats.today)} label="Chat events today" sub="opens · searches · requests" icon={<Activity size={18} />} tone="blue" />
        <AdminStatCard tag="SESSIONS" value={String(stats.sessions)} label="Visitor sessions" sub={`${stats.opens} chat opens`} icon={<MessageCircle size={18} />} tone="green" />
        <AdminStatCard tag="SEARCHES" value={String(stats.searches)} label="Member searches" sub={`${stats.unmatched} without match`} icon={<Search size={18} />} tone="amber" />
        <AdminStatCard tag="CALLBACKS" value={String(stats.contacts)} label="Contact requests" sub={`${stats.pending} pending`} icon={<Send size={18} />} tone={stats.pending > 0 ? "red" : "slate"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        {/* ── email routing → Admin → Emails ── */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold text-slate-900">Live Chat ඉල්ලීම් යන ලිපින</div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
                “Contact Live Chat” සහ “Request a Call” ඉල්ලීම් යන email ලිපින දැන් එකම තැනකින් — <b>Admin → Emails → Live Chat
                Requests &amp; Callbacks</b>. එහි ලිපින 2ක් දැම්මොත් දෙකටම යයි.
              </p>
              <a href="/admin/emails" className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11.5px] font-extrabold text-white hover:bg-indigo-700">
                Emails settings අරින්න →
              </a>
            </div>
          </div>
        </div>

        {/* ── 7 day chart ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
            <TrendingUp size={15} className="text-emerald-600" /> Last 7 days
          </div>
          <p className="text-[11.5px] text-slate-500">Chat opens per day</p>
          <div className="mt-4 flex items-end justify-between gap-1.5 h-[110px]">
            {stats.days.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-fuchsia-500 transition-all" style={{ height: `${Math.max(4, (d.count / stats.max) * 88)}px`, opacity: d.count ? 1 : 0.25 }} />
                <span className="text-[9px] font-bold text-slate-400">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-center text-[10.5px] text-slate-500">
            Total opens: <b className="text-slate-800">{stats.opens}</b>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* ── contact requests ── */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <Send size={15} className="text-fuchsia-600" /> Contact requests
              {stats.pending > 0 && <span className="rounded-full bg-rose-100 text-rose-700 text-[9.5px] font-black px-1.5 py-0.5">{stats.pending} new</span>}
            </div>
            <a href="/admin/messages" className="text-[11px] font-bold text-indigo-600 hover:underline">All messages →</a>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {requests.length === 0 && <div className="px-4 py-8 text-center text-[11.5px] text-slate-400">තවම contact requests නෑ</div>}
            {requests.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-extrabold text-slate-900 truncate">{m.name || "—"}</span>
                      {m.status === "unread" && <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 text-[8.5px] font-black px-1.5 py-0.5">NEW</span>}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-slate-500 line-clamp-2 whitespace-pre-line">{m.message}</div>
                    <div className="mt-1 text-[9.5px] text-slate-400">
                      {new Date(m.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {" · "}{m.department}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {m.phone && (
                      <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center hover:bg-emerald-100" title="Call">
                        <Phone size={12} />
                      </a>
                    )}
                    {m.status === "unread" && (
                      <button onClick={() => void markHandled(m)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200" title="Mark handled">
                        <CheckCircle2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── usage log ── */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <Clock size={15} className="text-indigo-600" /> Recent activity
            </div>
            <span className="text-[10px] font-bold text-slate-400">{events.length} events</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {recent.length === 0 && <div className="px-4 py-8 text-center text-[11.5px] text-slate-400">activity නෑ</div>}
            {recent.map((e) => {
              const meta = TYPE_META[e.event_type] ?? { label: e.event_type, tone: "bg-slate-100 text-slate-600", icon: Activity };
              const Icon = meta.icon;
              return (
                <div key={e.id} className="flex items-center gap-2 px-3.5 py-2">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${meta.tone}`}>
                    <Icon size={11} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-slate-800 truncate">{meta.label}</div>
                    {e.query && <div className="text-[10px] text-slate-400 truncate">“{e.query}”{e.event_type === "search" ? ` · ${e.matched} hit` : ""}</div>}
                  </div>
                  <span className="shrink-0 text-[9px] text-slate-400">
                    {new Date(e.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── top searches ── */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
          <Search size={15} className="text-sky-600" /> Most searched names / NIC
        </div>
        <p className="text-[11.5px] text-slate-500">Visitors ලා chat එකේ සොයන දේවල් — registry එකේ නැති ඒවා මෙතනින් හඳුනාගන්න.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {stats.topQueries.length === 0 && <span className="text-[11.5px] text-slate-400">දත්ත නෑ</span>}
          {stats.topQueries.map(([q, c]) => (
            <span key={q} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {q}
              <span className="rounded-full bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5">{c}</span>
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <ArrowUpRight size={13} className="text-indigo-500" />
          <a href="/admin/data" className="font-bold text-indigo-600 hover:underline">Data &amp; Live Metrics</a> එකේ සම්පූර්ණ registry එක බලන්න
        </div>
      </div>
    </div>
  );
}
