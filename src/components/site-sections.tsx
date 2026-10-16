"use client";

// ============================================================================
// Reusable page sections — service cards, contact cards, inquiry card, badges
// ============================================================================

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users, MapPin, Phone, MessageSquare, Send, Clock, CheckCircle2, Building2, Headphones,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { BusinessContact, BusinessService, BoardMember } from "@/lib/types";

export function SectionHead({ badge, title, sub, right }: { badge: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div>
        <div className="section-badge mb-2">{badge}</div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{title}</h2>
        {sub && <p className="text-slate-500 text-sm mt-1.5 max-w-2xl">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function ServiceCard({ service, unitName, index }: { service: BusinessService; unitName: string; index: number }) {
  const { lang, t } = useLang();
  const title = lang === "si" ? service.title_si || service.title_en : service.title_en;
  const desc = lang === "si" ? service.desc_si || service.desc_en : service.desc_en;
  const features = (lang === "si" ? service.features_si : service.features_en).length
    ? lang === "si"
      ? service.features_si
      : service.features_en
    : [t.biz.trusted, t.biz.memberPriv, t.biz.certified];
  return (
    <div className="card card-hover p-6">
      <div className="num-chip">{String(index + 1).padStart(2, "0")}</div>
      <h3 className="mt-4 text-lg font-extrabold text-slate-900">{title}</h3>
      <p className="text-slate-500 text-[13px] mt-1.5 leading-relaxed">
        {desc || `Premier service offered by ${unitName}.`}
      </p>
      <div className="border-t border-slate-100 my-4" />
      <ul className="space-y-2">
        {features.slice(0, 3).map((f) => (
          <li key={f} className="flex items-center gap-2 text-[13px] text-slate-600">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContactCards({ contacts, sub }: { contacts: BusinessContact[]; sub?: string }) {
  const { t } = useLang();
  const main = contacts[0];
  if (!main) return null;
  return (
    <div>
      <SectionHead badge="Contact & Information" title={t.sections.contacts} sub={sub ?? t.sections.contactsSub} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {contacts.map((c, i) => (
          <div key={i} className="card p-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              {i === 0 ? <Users size={19} /> : <Headphones size={19} />}
            </div>
            <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{c.role_en}</div>
            <div className="font-bold text-slate-900 text-[15px] mt-0.5">{c.name}</div>
            <div className="text-slate-500 text-[12px] mt-1">{c.note_en ?? "Department Operations"}</div>
          </div>
        ))}
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <MapPin size={19} />
          </div>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.labels.location}</div>
          <div className="font-bold text-slate-900 text-[14px] mt-0.5">{main.location}</div>
          <div className="text-slate-500 text-[12px] mt-1">{t.labels.openMonSat}</div>
        </div>
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Phone size={19} />
          </div>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.labels.hotline}</div>
          <div className="font-bold text-slate-900 text-[15px] mt-0.5 tabular-nums">{main.phone}</div>
          <a href={`tel:${main.phone.replace(/\s/g, "")}`} className="text-indigo-700 text-[12px] font-bold mt-1 inline-flex items-center gap-1">
            <Phone size={12} /> {t.labels.callNow}
          </a>
        </div>
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <MessageSquare size={19} />
          </div>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.labels.inquiry}</div>
          <div className="text-slate-600 text-[12.5px] mt-1">{t.labels.inquiryNote}</div>
          <div className="text-indigo-700 text-[12px] font-bold mt-1.5">{t.labels.response}</div>
        </div>
      </div>
    </div>
  );
}

export function SendInquiryCard({ department }: { department: string }) {
  // ✅ user requirement: සයිට් එකේ යට send query තැන — screenshot එකේ form design එකම
  return <InquiryForm department={department} />;
}

export function PersonCard({ person }: { person: BoardMember }) {
  const { lang, t } = useLang();
  const pill: Record<BoardMember["category"], { label: string; cls: string }> = {
    chairman: { label: lang === "si" ? t.boardPage.chairman : "Chairman", cls: "badge-amber" },
    "vice-chairman": { label: lang === "si" ? t.boardPage.vice : "Vice Chairman", cls: "badge-blue" },
    director: { label: lang === "si" ? t.boardPage.directors.replace("වරුන්", "").trim() || "Director" : "Director", cls: "badge-green" },
    officer: { label: lang === "si" ? "නිලධාරී" : "Administrative Officer", cls: "badge-red" },
  };
  return (
    <div className="card card-hover p-6 flex flex-col">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-700 flex items-center justify-center text-xl font-black shrink-0 overflow-hidden">
          {person.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photo} alt={person.name_en} className="w-full h-full object-cover" />
          ) : (
            person.name_en.split(" ").map((w) => w[0]).slice(0, 2).join("")
          )}
        </div>
        <div className="min-w-0">
          <span className={`${pill[person.category].cls} inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold`}>
            {pill[person.category].label}
          </span>
          <div className="font-extrabold text-slate-900 mt-1.5 leading-snug">{person.name_en}</div>
          <div className="text-slate-500 text-[12.5px]">{lang === "si" ? person.position_si : person.position_en}</div>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-[12px] text-slate-600">
        🎓 {person.qualification}
      </div>
      <div className="mt-3 space-y-1.5 text-[12.5px] text-slate-600">
        <div className="flex items-center gap-2"><Phone size={13} className="text-slate-400" /> {person.phone}</div>
        <div className="flex items-center gap-2"><Send size={13} className="text-slate-400" /> {person.email}</div>
        <div className="flex items-start gap-2"><MapPin size={13} className="text-slate-400 mt-0.5" /> {person.address}</div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 text-[13px] font-semibold text-slate-500">{person.name_si}</div>
    </div>
  );
}

export function InquiryForm({ department, compact }: { department?: string; compact?: boolean }) {
  const { t } = useLang();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  // success card එක ලස්සන animation එකකින් පෙන්නලා ඉබේම close වෙලා form එකට ආයෙ එනවා
  useEffect(() => {
    if (!sent) return;
    setClosing(false);
    const t1 = setTimeout(() => setClosing(true), 2900);
    const t2 = setTimeout(() => { setSent(false); setClosing(false); }, 3350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [sent]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    // FormSubmit delivery (admin settings email එකට) — client-side සිට direct POST
    try {
      await fetch(`https://formsubmit.co/ajax/${(fd.get("_to") as string) || "itk200712@gmail.com"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          Name: fd.get("name"),
          "Phone Number": fd.get("phone"),
          Email: fd.get("email") || "—",
          Department: fd.get("department"),
          Message: fd.get("message"),
        }),
      });
    } catch {
      /* offline / demo — form UI එක ක්‍රියා කරයි */
    }
    // ✅ Messages & Inquiries tab එකටත් පේලියක් දානවා (best-effort)
    try {
      const { dbInsert } = await import("@/components/admin");
      await dbInsert("messages", {
        name: String(fd.get("name") || ""),
        phone: String(fd.get("phone") || ""),
        email: String(fd.get("email") || ""),
        department: String(fd.get("department") || "General Society Inquiry"),
        subject: String(fd.get("department") || "General Society Inquiry"),
        message: String(fd.get("message") || ""),
        status: "unread",
      });
    } catch { /* ignore */ }
    setSent(true);
    setBusy(false);
    form.reset();
  }

  if (sent) {
    return (
      <div className={`card p-10 text-center ${closing ? "soft-out" : "pop-in"}`}>
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto pop-in">
          <CheckCircle2 size={34} />
        </div>
        <p className="mt-4 font-extrabold text-slate-900 text-[16px]">{t.contactPage.success}</p>
        <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-emerald-200 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ animation: "softOut 3s linear forwards", transformOrigin: "left" }} />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 sm:p-8 space-y-4">
      <div>
        <h3 className="text-xl font-extrabold text-slate-900">{t.contactPage.formTitle}</h3>
        <p className="text-slate-500 text-[13px] mt-1">{t.contactPage.formSub}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label">{t.contactPage.name} *</label>
          <input name="name" required className="field" placeholder="e.g. Sunil Perera" />
        </div>
        <div>
          <label className="field-label">{t.contactPage.phone} *</label>
          <input name="phone" required className="field" placeholder="077XXXXXX" />
        </div>
        <div>
          <label className="field-label">{t.contactPage.email}</label>
          <input name="email" type="email" className="field" placeholder="name@example.com" />
        </div>
        <div>
          <label className="field-label">{t.contactPage.dept} *</label>
          <select name="department" required className="field" defaultValue={department || t.contactPage.generalDept}>
            <option value={t.contactPage.generalDept}>{t.contactPage.generalDept}</option>
            <option value="Rural Bank">Rural Bank</option>
            <option value="Consumer Section">Consumer Section</option>
            <option value="Fuel Station">Fuel Station</option>
            <option value="Ristbury Tiara Agency">Ristbury Tiara Agency</option>
            <option value="Co-op City Supermarket">Co-op City Supermarket</option>
            <option value="Membership">Membership</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">{t.contactPage.message} *</label>
        <textarea name="message" required rows={compact ? 3 : 5} className="field" placeholder="Write the details of your inquiry or question here..." />
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        <Send size={16} /> {busy ? "..." : t.contactPage.submit}
      </button>
    </form>
  );
}

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(value); return; }
    const dur = 1500; const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n.toLocaleString()}{suffix}</>;
}

const STAT_ICONS = { members: Users, voters: CheckCircle2, divisions: Building2, years: Clock } as const;

export function StatCard({
  kind, value, suffix = "", label, tag,
}: { kind: keyof typeof STAT_ICONS; value: number; suffix?: string; label: string; tag: string }) {
  const Icon = STAT_ICONS[kind];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.18)] p-6">
      <div className="flex items-center justify-between">
        <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><Icon size={22} /></div>
        <span className="text-[9.5px] font-bold tracking-[0.16em] text-slate-400 uppercase">{tag}</span>
      </div>
      <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums"><Counter value={value} suffix={suffix} /></div>
      <div className="text-slate-500 text-[13px] mt-0.5">{label}</div>
    </div>
  );
}

export function StatsBand({ members, voters, divisions, years }: { members: number; voters: number; divisions: number; years: number }) {
  const { t } = useLang();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard kind="members" value={members} label={t.stats.members} tag="CSV / EXCEL" />
      <StatCard kind="voters" value={voters} label={t.stats.voters} tag="ELECTORAL" />
      <StatCard kind="divisions" value={divisions} label={t.stats.divisions} tag="BUSINESS" />
      <StatCard kind="years" value={years} suffix="+" label={t.stats.years} tag="SINCE 1976" />
    </div>
  );
}
