"use client";

// ============================================================================
// Admin → Emails — ㉕  (හැම email notification එකක්ම එකම තැනක)
//  එක් එක් "කාරනාව" (route) එකට ලිපින 1–4ක් — හැම ලිපිනයකටම email යයි.
//  · Membership Applications  · Contact / Inquiry Form
//  · Live Chat Requests        · Website Message Box · Business Unit Inquiries
//  · Auto Backup Reports (සාර්ථක/අසාර්ථක වාර්තා)
// ============================================================================

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle, Briefcase, CheckCircle2, HardDriveDownload, Inbox, Info, Mail, Plus, RefreshCw, Save, Send, Sparkles, Trash2, UserPlus, X,
} from "lucide-react";
import { MessageImageIcon as MessageCircle } from "@/components/site-icons";
import { AdminTopbar, useNotice } from "@/components/admin";
import {
  DEFAULT_SLOTS, MAIL_ROUTES, MAIL_SLOTS, clearMailRouteCache, isEmail, mailKey,
  sendToRoute, type MailRouteKey,
} from "@/lib/mail-routes";
import { authedClient } from "@/lib/supabase/client";
import { SILENTFORMS_DEFAULT_KEY, SILENTFORMS_ENDPOINT, looksLikeAccessKey } from "@/lib/silentforms";

type Draft = Record<MailRouteKey, string[]>;

const ICONS: Record<MailRouteKey, ComponentType<{ size?: number | string; className?: string }>> = {
  membership: UserPlus,
  inquiry: Mail,
  livechat: MessageCircle,
  message: Inbox,
  business: Briefcase,
  backup: HardDriveDownload,
};

const TONES: Record<MailRouteKey, string> = {
  membership: "from-indigo-500 to-indigo-700 shadow-indigo-200",
  inquiry: "from-sky-500 to-cyan-600 shadow-sky-200",
  livechat: "from-fuchsia-500 to-purple-600 shadow-fuchsia-200",
  message: "from-emerald-500 to-teal-600 shadow-emerald-200",
  business: "from-amber-500 to-orange-600 shadow-amber-200",
  backup: "from-slate-600 to-slate-900 shadow-slate-200",
};

function emptyDraft(): Draft {
  const d = {} as Draft;
  for (const r of MAIL_ROUTES) d[r.key] = Array.from({ length: DEFAULT_SLOTS }, () => "");
  return d;
}

export default function AdminEmailsPage() {
  const { show, node } = useNotice();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [fallback, setFallback] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<MailRouteKey | "">("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sb = await authedClient();
      const { data } = await sb.from("system_settings").select("key,value");
      const map = new Map(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));

      const next = emptyDraft();
      for (const r of MAIL_ROUTES) {
        const vals: string[] = [];
        for (let n = 1; n <= MAIL_SLOTS; n++) vals.push((map.get(mailKey(r.key, n)) || "").trim());
        // පළමු හිස් slot දෙක විතරක් පෙන්නන්න (දත්ත තියෙන ගණනට අනුව)
        while (vals.length > DEFAULT_SLOTS && !vals[vals.length - 1]) vals.pop();
        next[r.key] = vals;
      }
      setDraft(next);

      // fallback (පරණ settings) — route එකක් හිස් නම් ඒවා යනවා
      const fb: Record<string, string[]> = {};
      const pick = (keys: string[]) => keys.map((k) => (map.get(k) || "").trim()).filter(Boolean);
      fb.membership = pick(["contact_email_1", "contact_email_2"]);
      fb.inquiry = pick(["contact_email_1", "contact_email_2"]);
      fb.livechat = pick(["live_chat_email", "contact_email_1"]);
      fb.message = Array.from(new Set(pick(["mail_route_livechat_1", "live_chat_email", "contact_email_1"])));
      fb.business = pick(["contact_email_1", "contact_email_2"]);
      setFallback(fb);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(
    () => MAIL_ROUTES.reduce((a, r) => a + draft[r.key].filter((v) => isEmail(v)).length, 0),
    [draft]
  );

  function setSlot(route: MailRouteKey, idx: number, val: string) {
    setDraft((d) => ({ ...d, [route]: d[route].map((v, i) => (i === idx ? val : v)) }));
  }

  function addSlot(route: MailRouteKey) {
    setDraft((d) => ({ ...d, [route]: [...d[route], ""].slice(0, MAIL_SLOTS) }));
  }

  function removeSlot(route: MailRouteKey, idx: number) {
    setDraft((d) => {
      const arr = d[route].filter((_, i) => i !== idx);
      while (arr.length < DEFAULT_SLOTS) arr.push("");
      return { ...d, [route]: arr };
    });
  }

  async function saveRoute(route: MailRouteKey) {
    const emails = draft[route].map((v) => v.trim());
    const bad = emails.find((v) => v && !isEmail(v));
    if (bad) return show(`⚠ වලංගු නොවන ලිපිනයක්: ${bad}`);
    const filled = emails.filter(Boolean);
    if (new Set(filled.map((e) => e.toLowerCase())).size !== filled.length) return show("⚠ එකම ලිපිනය දෙපාරක් ඇත");

    setSaving(route);
    try {
      const sb = await authedClient();
      const rows = Array.from({ length: MAIL_SLOTS }, (_, i) => ({
        key: mailKey(route, i + 1),
        value: (emails[i] || "").trim(),
      }));
      const { error } = await sb.from("system_settings").upsert(rows, { onConflict: "key" });
      if (error) throw new Error(error.message);
      clearMailRouteCache();
      show(`✅ ${MAIL_ROUTES.find((r) => r.key === route)?.title_si} — සුරැකුණා (${filled.length} ලිපිනය${filled.length === 1 ? "" : "ක"})`);
    } catch (e) {
      show(`⚠ ${e instanceof Error ? e.message : "save failed"}`);
    }
    setSaving("");
  }

  /** 🏷 යැව්වේ කොහොමද කියන එක පෙන්වන්න */
  const methodName = (m?: string) => (m === "smtp" ? "SMTP" : m === "silentforms" ? "SilentForms" : "—");

  /** 📮 server route එකෙන් mail යවන helper (SilentForms → SMTP fallback) */
  const sendViaServer = useCallback(async (to: string | string[], subject: string, text: string) => {
    const sb = await authedClient();
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token ?? "";
    if (!token) return { ok: false, sent: 0, method: "none", failed: [{ to: String(to), error: "login session නෑ" }] };
    const res = await fetch("/api/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, subject, text }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean; sent?: number; method?: string; failed?: { to: string; error?: string }[];
    };
    return { ok: Boolean(j.ok), sent: Number(j.sent ?? 0), method: String(j.method ?? "none"), failed: j.failed ?? [] };
  }, []);

  async function activate(route: MailRouteKey, email: string) {
    if (!isEmail(email)) return show("⚠ වලංගු ලිපිනයක් ඇතුළත් කරන්න");
    setBusy(`${route}:${email}`);
    const r = await sendViaServer(
      email.trim(),
      "MPCS — Activate this email address",
      "This is the activation request for the society notification list. Please confirm this address to start receiving notifications.\n\nPanduwasnuwara New MPCS LTD"
    );
    setBusy("");
    if (r.ok) {
      show(`✅ Activation mail යැවුණා → ${email} (${methodName(r.method)})`);
    } else {
      const why = r.failed?.[0]?.error ?? "හේතුව දන්නේ නෑ";
      show(`⚠ Activation mail යැවීමට බැරි → ${email} · ${why}`);
    }
  }

  async function testRoute(route: MailRouteKey) {
    setBusy(`test:${route}`);
    const emails = draft[route].map((v) => v.trim()).filter(isEmail);
    const r = await sendViaServer(
      emails,
      "MPCS — Test email from Admin → Emails",
      "මෙය පරීක්ෂණ email එකකි — site එකේ notifications දැන් මේ ලිපිනයට එනවා. / This is a test message."
    );
    setBusy("");
    show(r.sent > 0
      ? (r.method === "silentforms" ? "SilentForms submission accepted — key owner / confirmed recipients වෙත පමණයි; inbox delivery තහවුරු නෑ" : `SMTP accepted: ${r.sent} recipients — inbox / Spam බලන්න`)
      : `⚠ test email යැවීමට බැරි — ${r.failed?.[0]?.error ?? "ලිපින පරීක්ෂා කරන්න"}`);
  }

  /* ---------------- 📨 SilentForms card (ප්‍රධාන email සේවාව) ---------------- */
  const [sfKey, setSfKey] = useState("");
  const [sfShowKey, setSfShowKey] = useState(false);
  const [sfState, setSfState] = useState<{ configured: boolean; saved: boolean; preview: string; provider: "silentforms" | "smtp" } | null>(null);
  const [sfBusy, setSfBusy] = useState("");
  const [sfTestTo, setSfTestTo] = useState("");

  const loadSilentForms = useCallback(async () => {
    try {
      const sb = await authedClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token ?? "";
      const res = await fetch("/api/mail/settings", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { silentforms?: { configured?: boolean; saved?: boolean; preview?: string; provider?: "silentforms" | "smtp" } };
      const sf = j.silentforms;
      if (sf) {
        setSfState({
          configured: Boolean(sf.configured),
          saved: Boolean(sf.saved),
          preview: String(sf.preview ?? ""),
          provider: sf.provider === "smtp" ? "smtp" : "silentforms",
        });
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => { void loadSilentForms(); }, [loadSilentForms]);

  async function saveSilentForms(patch?: { accessKey?: string; provider?: "silentforms" | "smtp" }) {
    const accessKey = patch?.accessKey ?? sfKey.trim();
    if (accessKey && !looksLikeAccessKey(accessKey)) {
      return show("⚠ Access key එක වැරදි වගේ — අකුරු/ඉලක්කම් 16ට වඩා තිබෙන්න ඕන (උදා: bf4a0621…f189b)");
    }
    setSfBusy(patch?.provider ? "provider" : "save");
    try {
      const sb = await authedClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token ?? "";
      const body: Record<string, unknown> = {};
      if (patch?.accessKey !== undefined) body.accessKey = patch.accessKey;
      else if (sfKey.trim()) body.accessKey = sfKey.trim();
      if (patch?.provider) body.provider = patch.provider;
      const res = await fetch("/api/mail/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string; silentforms?: { configured?: boolean; saved?: boolean; preview?: string; provider?: "silentforms" | "smtp" } };
      if (!j.ok) {
        show(`⚠ සුරැකීමේ දෝෂයක්: ${j.reason ?? "unknown"}`);
        return;
      }
      const sf = j.silentforms;
      if (sf) {
        setSfState({
          configured: Boolean(sf.configured),
          saved: Boolean(sf.saved),
          preview: String(sf.preview ?? ""),
          provider: sf.provider === "smtp" ? "smtp" : "silentforms",
        });
        // browser එකේ backup report වලටත් මේ key එකම ගන්න
        try {
          if (sf.saved && body.accessKey) globalThis.localStorage?.setItem("mpcs_silentforms_key", String(body.accessKey));
        } catch { /* ignore */ }
      }
      setSfKey("");
      show(
        patch?.provider
          ? `✅ යැවීමේ පිළිවෙළ සුරැකුණා — මුලින්ම ${patch.provider === "smtp" ? "SMTP" : "SilentForms"}`
          : "✅ SilentForms access key එක සුරැකුණා — දැන් හැම email එකක්ම මේ key එකෙන් යයි"
      );
    } finally {
      setSfBusy("");
    }
  }

  async function testSilentForms() {
    const to = sfTestTo.trim() || smtp.user.trim();
    if (!isEmail(to)) return show("⚠ Test එකට ලිපිනයක් දාන්න (උදා: ඔයාගේ Gmail එක)");
    setSfBusy("test");
    try {
      const sb = await authedClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token ?? "";
      const res = await fetch("/api/mail/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testTo: to, testProvider: "silentforms" }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; notice?: string; method?: string; reason?: string; failed?: { error?: string }[] };
      show(
        j.ok
          ? (j.notice ?? "SilentForms submission accepted — inbox delivery තහවුරු නෑ")
          : `⚠ Test එක fail — ${j.failed?.[0]?.error ?? j.reason ?? "access key එක පරීක්ෂා කරන්න"}`
      );
    } finally {
      setSfBusy("");
    }
  }

  /* ---------------- 📮 Mail Server (SMTP) card ---------------- */
  const [smtp, setSmtp] = useState({ host: "smtp.gmail.com", port: 465, user: "", pass: "", fromName: "Panduwasnuwara MPCS", fromEmail: "" });
  const [smtpState, setSmtpState] = useState<{ configured: boolean; hasPassword: boolean } | null>(null);
  const [smtpBusy, setSmtpBusy] = useState("");

  const loadSmtp = useCallback(async () => {
    try {
      const sb = await authedClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token ?? "";
      const res = await fetch("/api/mail/settings", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { configured?: boolean; host?: string; port?: number; user?: string; fromName?: string; fromEmail?: string; hasPassword?: boolean };
      setSmtpState({ configured: Boolean(j.configured), hasPassword: Boolean(j.hasPassword) });
      setSmtp((s) => ({ ...s, host: j.host || s.host, port: j.port || s.port, user: j.user || "", fromName: j.fromName || s.fromName, fromEmail: j.fromEmail || "", pass: "" }));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => { void loadSmtp(); }, [loadSmtp]);

  async function saveSmtpSettings(testTo?: string) {
    setSmtpBusy(testTo ? "test" : "save");
    try {
      const sb = await authedClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token ?? "";
      const res = await fetch("/api/mail/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(testTo ? { testTo, testProvider: "smtp" } : smtp),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; notice?: string; sent?: number; method?: string; configured?: boolean; reason?: string; failed?: { error?: string }[] };
      if (testTo) {
        show(j.ok
          ? (j.notice ?? `SMTP server accepted — ${testTo}; inbox / Spam බලන්න`)
          : `⚠ Test එක fail — ${j.failed?.[0]?.error ?? j.reason ?? "සැකසුම පරීක්ෂා කරන්න"}`);
      } else if (j.ok) {
        setSmtpState({ configured: Boolean(j.configured), hasPassword: true });
        setSmtp((s) => ({ ...s, pass: "" }));
        show("✅ Mail Server (SMTP) සැකසුම සුරැකුණා — SilentForms fail වුණොත් මේකෙන් යයි");
      } else {
        show(`⚠ සුරැකීමේ දෝෂයක්: ${j.reason ?? "unknown"}`);
      }
    } finally {
      setSmtpBusy("");
    }
  }

  return (
    <div>
      {node}
      <AdminTopbar
        title="Emails"
        sub="හැම email notification එකක්ම එකම තැනකින් — කාරනාව අනුව ලිපින 1–4ක්"
      />

      {/* 📨 SilentForms — site එකේ ප්‍රධාන email සේවාව */}
      <div className={`mb-5 rounded-2xl border p-4 ${sfState?.configured ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${sfState?.configured ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200" : "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200"}`}>
            <Mail size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[13.5px] font-extrabold text-slate-900">
                📨 SilentForms — ප්‍රධාන email සේවාව {sfState?.configured ? "· ✅ සක්‍රීය" : "· ⚠ ඔයාගේ key එක තාම save කරලා නෑ"}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${sfState?.configured ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>
                {sfState?.configured ? "KEY SAVED ✅" : "DEFAULT KEY — වැඩ කරනවා"}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
              Contact form · Membership · Live Chat · Messages · Business · Backup reports — <b>හැම email එකක්ම</b> දැන් යන්නේ
              <b> SilentForms</b> ({SILENTFORMS_ENDPOINT}) හරහා. Access key එක මෙතන save කරන්න — එතකොට හැම පණිවිඩයක්ම
              ඒ key එකට සම්බන්ධ inbox එකට එයි. (Key එක server එකේ <code>backup_secrets</code> එකේ තමයි තියෙන්නේ — backup එකට ඉබේම එකතු වේ.)
            </p>

            {sfState?.preview ? (
              <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                දැනට save වෙලා තියෙන key: <code className="text-emerald-700">{sfState.preview}</code>
                {!sfState.saved && <span className="ml-2 font-bold text-amber-700">(අභ්‍යන්තර default key — ඔයාගේම එකක් save කරන්න)</span>}
              </div>
            ) : null}

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative sm:col-span-2">
                <input
                  value={sfKey}
                  onChange={(e) => setSfKey(e.target.value)}
                  type={sfShowKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="SilentForms Access Key එක මෙතන paste කරන්න"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-16 text-[12px] outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => setSfShowKey((v) => !v)}
                  className="absolute right-1.5 top-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-600 hover:bg-slate-200"
                >
                  {sfShowKey ? "HIDE" : "SHOW"}
                </button>
              </div>
              <input
                value={sfTestTo}
                onChange={(e) => setSfTestTo(e.target.value)}
                type="email"
                placeholder="Test ලිපිනය (ඔයාගේ Gmail එක)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400"
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void saveSilentForms()}
                disabled={sfBusy !== "" || !sfKey.trim()}
                className="btn btn-primary !py-1.5 !px-3 !text-[11px]"
              >
                <Save size={12} /> {sfBusy === "save" ? "සුරකිමින්…" : "Access Key සුරකින්න"}
              </button>
              <button
                onClick={() => void saveSilentForms({ accessKey: SILENTFORMS_DEFAULT_KEY })}
                disabled={sfBusy !== ""}
                className="rounded-lg bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Default key එක දාන්න
              </button>
              <button
                onClick={() => void testSilentForms()}
                disabled={sfBusy !== "" || !(isEmail(sfTestTo) || isEmail(smtp.user))}
                className="btn btn-outline !py-1.5 !px-3 !text-[11px]"
              >
                <Send size={12} /> {sfBusy === "test" ? "යවමින්…" : "SMTP Test — saved settings"}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">යැවීමේ පිළිවෙළ</span>
              {([
                { key: "silentforms" as const, label: "① SilentForms → ② SMTP" },
                { key: "smtp" as const, label: "① SMTP → ② SilentForms" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => void saveSilentForms({ provider: opt.key })}
                  disabled={sfBusy !== ""}
                  className={`rounded-lg px-2.5 py-1.5 text-[10.5px] font-extrabold ring-1 transition ${
                    sfState?.provider === opt.key
                      ? "bg-indigo-600 text-white ring-indigo-600"
                      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {sfBusy === "provider" && <span className="text-[10.5px] text-slate-500">සුරකිමින්…</span>}
            </div>

            <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
              🔁 <b>SilentForms එක tips:</b> විනාඩියකට IP එකකට <b>10</b>ක්, key එකකට <b>60</b>ක් · එක පණිවිඩයක් <b>1 MB</b>ට අඩුවෙන් ·
              attachments නෑ. Fail වුණොත් ඊළඟ විනාඩි 15 ඇතුළත ඉබේම SMTP එකට මාරු වේ.
            </div>
          </div>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-[12px] text-slate-700">
        <h3 className="font-extrabold text-indigo-950">📬 Email නොඑනවා නම් — පියවරෙන් පියවර</h3>
        <p className="mt-2 font-bold">Key saved ≠ inbox verified. SilentForms success = submission accepted පමණයි.</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li><a href="https://silentforms.com/sign-in" target="_blank" rel="noopener noreferrer" className="font-bold underline">SilentForms dashboard</a> එකට key හිමියාගේ email එකෙන් sign in කර අදාළ form එක විවෘත කරන්න.</li>
          <li><b>Email me every submission</b> ON කරන්න. Form paused නොවන බවත් domain restrictions නිවැරදි බවත් බලන්න.</li>
          <li>වෙනත් ලිපිනයකට ඕන නම් <b>Extra recipients → Add recipient</b>. එම inbox එකට ආ confirmation link එක click කරන්න. Waiting for confirmation නම් mail එන්නේ නෑ. උපරිම extra recipients 5යි.</li>
          <li>මෙතන SilentForms key එක Save කර Test කරන්න. Test ලිපිනය type කිරීමෙන් පමණක් SilentForms recipient එක වෙනස් නොවේ. Key owner සහ confirmed recipients ගේ Inbox / Spam / All Mail බලන්න.</li>
          <li>Admin එකේ route ලිපින වලටම යවන්න ඕන නම් පහළ SMTP card එකේ Gmail + App Password + smtp.gmail.com + 465 → Save → <b>SMTP Test</b>. SMTP test එක SilentForms හරහා යන්නේ නෑ.</li>
          <li>SMTP test එක inbox එකට ආ පසු උඩ <b>① SMTP → ② SilentForms</b> තෝරන්න. Auto Backup Reports card එකේ අවශ්‍ය ලිපින Save කරන්න.</li>
          <li>Admin → Backup → test run කර History බලන්න. Report size = සෑදූ අවසන් ZIP එකේ actual bytes; උදා: <b>36.7 MB (36,700,000 bytes)</b>. ZIP attachment එකක් email කරන්නේ නෑ.</li>
        </ol>
        <p className="mt-2">සේවාව mail එක භාරගත්තත් instant inbox delivery සහතික කරන්න බැහැ. SilentForms dashboard සැකසුම් මේ Admin panel එකෙන් වෙනස් කළ නොහැක.</p>
      </section>

      {/* 📮 Mail Server (SMTP) — SilentForms fail වුණොත් email යවන්න */}
      <div className={`mb-5 rounded-2xl border p-4 ${smtpState?.configured ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${smtpState?.configured ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200" : "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200"}`}>
            <Send size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-extrabold text-slate-900">
              📮 Mail Server (SMTP) {smtpState?.configured ? "— ✅ සක්‍රීය" : "— ⚠ තාම set කරලා නෑ"}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
              හැම email එකක්ම මුලින්ම යන්නේ <b>SilentForms</b> හරහා (උඩ card එක). ඒක fail වුණොත් / down වුණොත්
              <b>ඉබේම මේ SMTP එකට මාරු වෙනවා</b>. ඒ නිසා <b>Gmail App Password</b> එකක් දාලා තිබ්බොත්
              Admin එකේ ලිපින වෙත SMTP යවන්න පුළුවන්. SilentForms HTTP success වුණත් inbox එකට නොආවොත් fallback එක දුවන්නේ නෑ; එවිට ① SMTP තෝරන්න.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <input value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} type="email" placeholder="Gmail ලිපිනය (උදා: induwara633@gmail.com)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} type="password" autoComplete="new-password" placeholder={smtpState?.hasPassword ? "App Password — වෙනස් කරන්න ඕන නම් විතරයි" : "Gmail App Password (අකුරු 16)"} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.fromName} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} placeholder="පෙන්වන නම (From)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value, 10) || 465 })} type="number" placeholder="465" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} type="email" placeholder="From ලිපිනය (හිස් නම් උඩ ලිපිනයම)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
            </div>
            <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
              🔁 <b>යැවීමේ පිළිවෙළ:</b> ① <b>SilentForms</b> → ② fail වුණොත් <b>ඉබේම SMTP</b> → ③ දෙකම fail නම් error එකේ හේතුව පෙන්වයි.
              SilentForms down වුණාම ඊළඟ විනාඩි 15 තුළ කෙලින්ම SMTP එකෙන් යයි (ආයේ තත්පර 12ක් ඉන්නේ නෑ).
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => void saveSmtpSettings()} disabled={smtpBusy !== ""} className="btn btn-primary !py-1.5 !px-3 !text-[11px]">
                <Save size={12} /> {smtpBusy === "save" ? "සුරකිමින්…" : "SMTP සුරකින්න"}
              </button>
              <button onClick={() => void saveSmtpSettings(smtp.user || "")} disabled={smtpBusy !== "" || !isEmail(smtp.user)} className="btn btn-outline !py-1.5 !px-3 !text-[11px]">
                <Send size={12} /> {smtpBusy === "test" ? "යවමින්…" : "SMTP Test — saved settings"}
              </button>
              <button onClick={() => setSmtp((s) => ({ ...s, host: "smtp.gmail.com", port: 465 }))} className="rounded-lg bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                Gmail preset
              </button>
              {smtpState?.configured && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  SilentForms fail වුණොත් මේකෙන් යයි ✅
                </span>
              )}
            </div>
            <details className="mt-2 text-[11px] text-slate-600">
              <summary className="cursor-pointer font-bold text-indigo-700">Gmail App Password එකක් හදාගන්නේ කොහොමද? (පියවර 4)</summary>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                <li>Google ගිණුම → <b>Security</b> → <b>2-Step Verification</b> on කරන්න (අනිවාර්යයි)</li>
                <li>එතනම <b>App passwords</b> එකට යන්න (හොයාගන්න බැරි නම්: myaccount.google.com/apppasswords)</li>
                <li>නම: <b>MPCS Website</b> → Create → එන <b>අකුරු 16</b> කොපි කරන්න</li>
                <li>ඒක උඩ “App Password” කොටුවේ දාලා <b>SMTP සුරකින්න</b> → <b>Test email</b> ඔබන්න</li>
              </ol>
            </details>
          </div>
        </div>
      </div>

      {/* summary strip */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-fuchsia-50 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-extrabold text-slate-900">
            {activeCount} active ලිපින · {MAIL_ROUTES.length} කාරනා
          </div>
          <div className="text-[11px] text-slate-600">
            එක් කාරනාවකට ලිපින 2ක් දැම්මොත් ඒ සියල්ල <b>SilentForms access key එකේ inbox එකටම</b> එක email එකක් ලෙස එයි —
            ලිපින ටික email එක ඇතුළේ සටහන් වේ. වෙන් වෙන් ලිපින වලට වෙන් වෙන් වශයෙන් යැවීමට SMTP දාන්න.
          </div>
        </div>
        <button onClick={() => void load()} disabled={loading} className="btn btn-outline !py-1.5 !px-3 !text-[11px]">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {MAIL_ROUTES.map((r) => {
          const Icon = ICONS[r.key];
          const values = draft[r.key];
          const fb = fallback[r.key] ?? [];
          const filled = values.filter((v) => v.trim());
          return (
            <div key={r.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 px-4 pt-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${TONES[r.key]} text-white shadow-lg`}>
                  <Icon size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-extrabold text-slate-900">{r.title_si}</div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{r.title_en}</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{r.desc_si}</p>
                </div>
              </div>

              <div className="px-4 pb-4 pt-3">
                <div className="space-y-2">
                  {values.map((v, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <Mail size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={v}
                          onChange={(e) => setSlot(r.key, i, e.target.value)}
                          placeholder={`Email ${i + 1}`}
                          type="email"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-[12px] outline-none focus:border-indigo-400 focus:bg-white"
                        />
                      </div>
                      <button
                        onClick={() => void activate(r.key, v)}
                        disabled={!isEmail(v) || busy === `${r.key}:${v}`}
                        title="Activation mail යවන්න"
                        className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-2 text-[10px] font-extrabold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-40"
                      >
                        {busy === `${r.key}:${v}` ? "…" : "Activate"}
                      </button>
                      {values.length > 1 && (
                        <button
                          onClick={() => removeSlot(r.key, i)}
                          className="shrink-0 rounded-lg bg-slate-50 p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          title="ඉවත් කරන්න"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {values.length < MAIL_SLOTS && (
                    <button onClick={() => addSlot(r.key)} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-[10.5px] font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
                      <Plus size={11} /> තවත් ලිපිනයක්
                    </button>
                  )}
                  <button
                    onClick={() => void saveRoute(r.key)}
                    disabled={saving === r.key}
                    className="ml-auto btn btn-primary !py-2 !px-3.5 !text-[11.5px]"
                  >
                    <Save size={12} /> {saving === r.key ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => void testRoute(r.key)}
                    disabled={busy === `test:${r.key}` || filled.length === 0}
                    className="btn btn-outline !py-2 !px-3 !text-[11.5px]"
                  >
                    <Send size={12} /> {busy === `test:${r.key}` ? "…" : "Test"}
                  </button>
                </div>

                {filled.length === 0 && fb.length > 0 && (
                  <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10.5px] text-amber-800">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    <span>
                      තවම ලිපින දාලා නෑ — දැනට <b>{fb.join(", ")}</b> ට යනවා (පරණ setting). ඉහත දාලා Save කරන්න.
                    </span>
                  </div>
                )}

                {filled.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-700">
                    <CheckCircle2 size={12} /> දැන් {filled.length} ලිපිනයකට යනවා: {filled.join(", ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-[12px] font-extrabold text-slate-800">
          <AlertTriangle size={13} className="text-amber-600" /> වැදගත්
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-slate-600">
          <li><b>SilentForms</b> එකේ access key එකට සම්බන්ධ inbox එකට තමයි හැම පණිවිඩයක්ම එන්නේ — key එක නැති වුණොත් උඩ card එකෙන් අලුත් එකක් save කරන්න.</li>
          <li>SilentForms key ගන්නා email එක confirm කළ යුතුයි. Extra recipients ද වෙන වෙනම confirm කළ යුතුයි. API success එක inbox delivery තහවුරු කිරීමක් නොවේ.</li>
          <li>විනාඩියකට SilentForms සීමා: IP එකකට <b>10</b>, key එකකට <b>60</b> — සාමාන්‍ය භාවිතයට ප්‍රමාණවත්.</li>
          <li>admin panel එකේ වෙනත් තැන්වල තිබුණු email settings ඉවත් කරලා එකම තැනට ගෙනාවා — දැන් මෙතනින් විතරයි.</li>
        </ul>
      </div>
    </div>
  );
}
