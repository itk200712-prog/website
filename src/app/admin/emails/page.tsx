"use client";

// ============================================================================
// Admin → Emails — ㉕  (හැම email notification එකක්ම එකම තැනක)
//  එක් එක් "කාරනාව" (route) එකට ලිපින 1–10ක් — හැම ලිපිනයකටම email යයි.
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
  type MailRouteKey,
} from "@/lib/mail-routes";
import { SMTP_PRESETS, smtpConfigurationIssue } from "@/lib/mail-config";
import { authedClient } from "@/lib/supabase/client";

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

  /** Server-side SMTP sender; credentials never leave the server. */
  const sendViaServer = useCallback(async (to: string | string[], subject: string, text: string) => {
    try {
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
    } catch (error) {
      return { ok: false, sent: 0, method: "none", failed: [{ to: String(to), error: (error as Error).message }] };
    }
  }, []);

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
      ? `SMTP accepted: ${r.sent}; failed: ${r.failed.length} — Inbox / Spam බලන්න${r.failed[0]?.error ? ` · ${r.failed[0].to}: ${r.failed[0].error}` : ""}`
      : `⚠ SMTP send failed — ${r.failed?.[0]?.error ?? "Admin → Emails → SMTP settings පරීක්ෂා කරන්න"}`);
  }

  /* ---------------- 📮 Mail Server (SMTP) card ---------------- */
  const [smtp, setSmtp] = useState({ host: "smtp.gmail.com", port: 465, user: "", pass: "", fromName: "Panduwasnuwara MPCS", fromEmail: "" });
  const [smtpState, setSmtpState] = useState<{ configured: boolean; hasPassword: boolean } | null>(null);
  const [smtpTestTo, setSmtpTestTo] = useState("");
  const [smtpBusy, setSmtpBusy] = useState("");
  const [smtpResult, setSmtpResult] = useState("");
  const smtpIssue = smtpConfigurationIssue(smtp);

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
    if (smtpIssue) { setSmtpResult(smtpIssue); return; }
    setSmtpResult("");
    setSmtpBusy(testTo ? "test" : "save");
    try {
      const sb = await authedClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token ?? "";
      const res = await fetch("/api/mail/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(testTo ? { testTo } : smtp),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; notice?: string; sent?: number; method?: string; configured?: boolean; warning?: string; reason?: string; failed?: { error?: string }[] };
      if (testTo) {
        setSmtpResult(j.ok ? j.notice ?? "SMTP accepted — Inbox / Spam බලන්න." : j.failed?.[0]?.error ?? j.reason ?? "SMTP test failed");
        show(j.ok
          ? (j.notice ?? `SMTP server accepted — ${testTo}; inbox / Spam බලන්න`)
          : `⚠ Test එක fail — ${j.failed?.[0]?.error ?? j.reason ?? "සැකසුම පරීක්ෂා කරන්න"}`);
      } else if (j.ok) {
        setSmtpState({ configured: Boolean(j.configured), hasPassword: Boolean(j.configured) });
        setSmtp((s) => ({ ...s, pass: "" }));
        show(`✅ SMTP සැකසුම සුරැකුණා — site එකේ සියලු email දැන් SMTP හරහා පමණයි${j.warning ? ` · ⚠ ${j.warning}` : ""}`);
      } else {
        setSmtpResult(j.reason ?? "SMTP save failed");
        show(`⚠ සුරැකීමේ දෝෂයක්: ${j.reason ?? "unknown"}`);
      }
    } catch (error) {
      setSmtpResult((error as Error).message);
      show(`⚠ SMTP request failed — ${(error as Error).message}`);
    } finally {
      setSmtpBusy("");
    }
  }

  return (
    <div>
      {node}
      <AdminTopbar
        title="Emails"
        sub="SMTP පමණයි · එක sender ගිණුමකින් අදාළ සියලු ලිපිනවලට"
      />

      <section className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-[12px] text-slate-700">
        <h2 className="font-extrabold text-indigo-950">📮 SMTP ONLY — පියවරෙන් පියවර</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>යවන Gmail ගිණුමේ Google Account → Security → <b>2-Step Verification</b> ON කරන්න.</li>
          <li><a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="font-bold underline">App Password</a> එකක් Create කරගන්න. සාමාන්‍ය Gmail password එක දාන්න එපා.</li>
          <li>පහළ Gmail address + App Password + From name + <b>smtp.gmail.com</b> + <b>465</b> පුරවන්න. From email = එම Gmail ලිපිනයම. <b>SMTP සුරකින්න</b>.</li>
          <li><b>SMTP Test — saved settings</b> ඔබලා එම inbox එකේ Inbox / Spam / All Mail බලන්න. වෙනම test ලිපිනයක් දාන්නත් පුළුවන්.</li>
          <li>අදාළ කාරණාවල card වල ලැබිය යුතු email ලිපින දාලා <b>Save → Test</b>. Recipient ලිපිනවල passwords හෝ keys අවශ්‍ය නෑ. <b>තවත් ලිපිනයක්</b> ඔබා එකම card එකට ලිපින 7ක් දාලා Save කරන්න (උපරිම 10යි). එක SMTP sender එකෙන් එක් එක් ලිපිනයට වෙනම email යවයි; recipient list එක වෙනත් recipients ට නොපෙන්වයි.</li>
          <li><b>Auto Backup Reports</b> ලිපින Save → Admin → Backup → test run. Report එකේ size එක final ZIP bytes ගණනයි.</li>
        </ol>
        <p className="mt-2">SMTP configure කරලා නැත්නම් හෝ send fail වුණොත් පැහැදිලි error එකක් පෙන්වයි. වෙනත් mail සේවාවකට fallback නැහැ. Server accepted = inbox delivered නොවේ; instant delivery සහතික කළ නොහැක.</p>
      </section>

      <div className={`mb-5 rounded-2xl border p-4 ${smtpState?.configured ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${smtpState?.configured ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200" : "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200"}`}>
            <Send size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-extrabold text-slate-900">
              📮 Mail Server (SMTP) {smtpState?.configured ? "— Settings saved (login verified නොවේ)" : "— ⚠ තාම set කරලා නෑ"}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
              Site එකේ සියලු email සහ backup reports යවන්නේ <b>මෙම SMTP sender ගිණුමෙන් පමණයි</b>.
              එක් එක් recipient email සඳහා වෙනම SMTP account හෝ access key අවශ්‍ය නැහැ. Configure කරලා Save කළ පසු Test කරන්න.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <input value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} type="email" aria-label="SMTP sender username" placeholder="Sender email / SMTP username" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} type="password" autoComplete="new-password" aria-label="SMTP password" placeholder={smtpState?.hasPassword ? "Saved password — sender/host වෙනස් නම් අලුත් එක දාන්න" : "SMTP password / Gmail App Password"} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.fromName} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} placeholder="පෙන්වන නම (From)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value, 10) || 465 })} type="number" placeholder="465" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
              <input value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} type="email" placeholder="From ලිපිනය (හිස් නම් උඩ ලිපිනයම)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-indigo-400" />
            </div>
            {smtpIssue && <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] leading-relaxed text-rose-800">⚠ {smtpIssue}</div>}
            {!!smtpResult && <div role="status" aria-live="polite" className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-relaxed text-slate-700">{smtpResult}</div>}
            <div className="mt-2 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
              <b>535 BadCredentials:</b> Saved settings තිබීම login සාර්ථකයි කියන එක නොවේ. <b>@mail.com ≠ @gmail.com</b>.
              Gmail sender නම් smtp.gmail.com + එම Gmail ගිණුමේ අලුත් App Password භාවිත කරන්න.
              Mail.com sender නම් Mail.com preset (smtp.mail.com) + එම ගිණුමේ SMTP credentials/access අවශ්‍යයි.
              Sender/host වෙනස් කළොත් password එකත් අලුතින් දාලා Save කරන්න. අපි ලිපිනය ඉබේම වෙනස් කරන්නේ නැහැ.
            </div>
            <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
              🔒 <b>SMTP ONLY:</b> credentials server එකේ <code>backup_secrets</code> තුළයි; full backup එකට ඇතුළත්.
              SMTP නොමැති නම් / fail නම් වෙනත් provider එකක් භාවිත නොවේ.
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => void saveSmtpSettings()} disabled={smtpBusy !== ""} className="btn btn-primary !py-1.5 !px-3 !text-[11px]">
                <Save size={12} /> {smtpBusy === "save" ? "සුරකිමින්…" : "SMTP සුරකින්න"}
              </button>
              <input aria-label="SMTP test recipient" type="email" value={smtpTestTo} onChange={e => setSmtpTestTo(e.target.value)} placeholder="Test recipient (හිස් නම් sender)" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px]" />
              <button onClick={() => void saveSmtpSettings(smtpTestTo.trim() || smtp.user)} disabled={smtpBusy !== "" || !isEmail(smtpTestTo.trim() || smtp.user)} className="btn btn-outline !py-1.5 !px-3 !text-[11px]">
                <Send size={12} /> {smtpBusy === "test" ? "යවමින්…" : "SMTP Test — saved settings"}
              </button>
              {Object.entries(SMTP_PRESETS).map(([key, preset]) => <button key={key} type="button" onClick={() => setSmtp(s => ({ ...s, host: preset.host, port: preset.port }))}
                className="rounded-lg bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">{preset.label} preset</button>)}
              {smtpState?.configured && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  SMTP settings saved · authentication/inbox verified නොවේ
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
            {activeCount} email slots · {MAIL_ROUTES.length} කාරනා
          </div>
          <div className="text-[11px] text-slate-600">
            එක SMTP sender ගිණුමෙන් එක් එක් recipient වෙත වෙන වෙනම email යවයි. Card එකකට උපරිම ලිපින {MAIL_SLOTS}යි; ලිපින 7ක් එකම card එකට එක් කළ හැක. එක් ලිපිනයක් fail වුණත් අනෙක් ලිපිනවල යැවීම දිගටම සිදුවේ.
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
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
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
                    <CheckCircle2 size={12} /> Draft ලිපින {filled.length}: {filled.join(", ")} — ලිපින වෙනස් කළ පසු card Save කරන්න.
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
          <li>SMTP සැකසුම එකවරක් Save කළාම site එකේ හැම email route එකකටම භාවිත වේ.</li>
          <li>ලැබිය යුතු ලිපින සඳහා access keys හෝ passwords අවශ්‍ය නැහැ.</li>
          <li>App Password එක chat එකක share කරන්න එපා. Inbox නොඑනවා නම් Spam / All Mail සහ SMTP error එක පරීක්ෂා කරන්න.</li>
          <li>admin panel එකේ වෙනත් තැන්වල තිබුණු email settings ඉවත් කරලා එකම තැනට ගෙනාවා — දැන් මෙතනින් විතරයි.</li>
        </ul>
      </div>
    </div>
  );
}
