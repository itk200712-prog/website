"use client";

// ============================================================================
// Admin → Emails — ㉕  (හැම email notification එකක්ම එකම තැනක)
//  එක් එක් "කාරනාව" (route) එකට ලිපින 1–4ක් — හැම ලිපිනයකටම email යයි.
//  · Membership Applications  · Contact / Inquiry Form
//  · Live Chat Requests        · Website Message Box · Business Unit Inquiries
// ============================================================================

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle, Briefcase, CheckCircle2, Inbox, Info, Mail, Plus, RefreshCw, Save, Send, Sparkles, Trash2, UserPlus, X,
} from "lucide-react";
import { MessageImageIcon as MessageCircle } from "@/components/site-icons";
import { AdminTopbar, useNotice } from "@/components/admin";
import {
  DEFAULT_SLOTS, MAIL_ROUTES, MAIL_SLOTS, clearMailRouteCache, isEmail, mailKey, sendActivationMail,
  sendToRoute, type MailRouteKey,
} from "@/lib/mail-routes";
import { authedClient } from "@/lib/supabase/client";

type Draft = Record<MailRouteKey, string[]>;

const ICONS: Record<MailRouteKey, ComponentType<{ size?: number | string; className?: string }>> = {
  membership: UserPlus,
  inquiry: Mail,
  livechat: MessageCircle,
  message: Inbox,
  business: Briefcase,
};

const TONES: Record<MailRouteKey, string> = {
  membership: "from-indigo-500 to-indigo-700 shadow-indigo-200",
  inquiry: "from-sky-500 to-cyan-600 shadow-sky-200",
  livechat: "from-fuchsia-500 to-purple-600 shadow-fuchsia-200",
  message: "from-emerald-500 to-teal-600 shadow-emerald-200",
  business: "from-amber-500 to-orange-600 shadow-amber-200",
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

  async function activate(route: MailRouteKey, email: string) {
    if (!isEmail(email)) return show("⚠ වලංගු ලිපිනයක් ඇතුළත් කරන්න");
    setBusy(`${route}:${email}`);
    const ok = await sendActivationMail(email.trim());
    setBusy("");
    show(ok ? `✅ Activation mail යැවුණා → ${email}` : `⚠ Activation mail යැවීමට බැරි විය → ${email}`);
  }

  async function testRoute(route: MailRouteKey) {
    setBusy(`test:${route}`);
    const n = await sendToRoute(route, {
      _subject: "MPCS — Test email from Admin → Emails",
      Name: "Panduwasnuwara MPCS",
      Message: "මෙය පරීක්ෂණ email එකකි. දැන් මේ ලිපිනයට සැබෑ notifications එනවා. / This is a test message.",
      Source: "Admin → Emails (test)",
    });
    setBusy("");
    show(n > 0 ? `✅ ලිපින ${n}කට test email යැවුණා` : "⚠ test email යැවීමට බැරි විය — ලිපින පරීක්ෂා කරන්න");
  }

  return (
    <div>
      {node}
      <AdminTopbar
        title="Emails"
        sub="හැම email notification එකක්ම එකම තැනකින් — කාරනාව අනුව ලිපින 1–4ක්"
      />

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
            එක් කාරනාවකට ලිපින 2ක් දැම්මොත් <b>දෙකටම</b> email යයි. FormSubmit එකෙන් පළමු වතාවට activation mail එකක් එයි — confirm කරන්න.
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
          <li>FormSubmit එකට එක් ලිපිනයකට <b>එක වරක්</b> confirm කිරීම ප්‍රමාණවත් — <b>Activate</b> ඔබලා inbox එකේ ලින්ක් එක ඔබන්න.</li>
          <li>Confirm නොකළ ලිපිනයකට email යැවෙන්නේ නෑ (FormSubmit එකේ නියමය).</li>
          <li>admin panel එකේ වෙනත් තැන්වල තිබුණු email settings ඉවත් කරලා එකම තැනට ගෙනාවා — දැන් මෙතනින් විතරයි.</li>
        </ul>
      </div>
    </div>
  );
}
