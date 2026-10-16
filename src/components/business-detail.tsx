"use client";

// ============================================================================
// Business detail — default template + rural-bank / consumer / fuel-station
// ============================================================================

import Link from "next/link";
import {
  ChevronRight, Clock, Fuel, Home, MapPin, Phone, Search, ShieldCheck, Star, TrendingUp, UserRound, Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { ContactCards, SectionHead, SendInquiryCard, ServiceCard } from "@/components/site-sections";
import type { BusinessUnit, FuelPrice } from "@/lib/types";
import { RURAL_BANK_BRANCHES } from "@/lib/seed";

/* ---------------------------------------------------------------- hero ---- */
export function BusinessHero({ b }: { b: BusinessUnit }) {
  const { lang, t } = useLang();
  return (
    <section className="hero-dark text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-14">
        {/* breadcrumb */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px]">
          <Home size={13} /> Home <ChevronRight size={12} className="text-white/40" /> Businesses
          <ChevronRight size={12} className="text-white/40" />
          <span className="text-amber-300 font-semibold">{lang === "si" ? b.name_si : b.name_en}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] uppercase text-amber-300 mt-8">
          <ShieldCheck size={15} /> {t.biz.badge}
        </div>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-white/95 text-slate-800 flex items-center justify-center text-2xl font-black shrink-0 shadow-xl overflow-hidden">
            {b.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logo} alt="" className="w-full h-full object-cover" />
            ) : (
              b.name_en.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight">{lang === "si" ? b.name_si || b.name_en : b.name_en}</h1>
            {(lang === "si" ? b.tagline_si : b.tagline_en) && (
              <div className="mt-2 text-amber-300 font-semibold text-lg">
                {lang === "si" ? b.tagline_si : b.tagline_en}
              </div>
            )}
          </div>
        </div>

        {(lang === "si" ? b.desc_si : b.desc_en) && (
          <p className="mt-5 text-slate-300 max-w-3xl leading-relaxed text-[15px]">
            {lang === "si" ? b.desc_si : b.desc_en}
          </p>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- services -- */
export function BusinessServices({ b }: { b: BusinessUnit }) {
  const { lang, t } = useLang();
  const services = b.services.filter((s) => s.active);
  if (services.length === 0 && b.special !== "default") return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <SectionHead badge="Offered Services" title={t.sections.services} sub={t.sections.servicesSub} />
      {services.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          {lang === "si"
            ? "මෙම ඒකකය සඳහා සේවා තවම එකතු කර නොමැත. Admin පැනලයෙන් සේවා එකතු කරන්න."
            : "No services configured for this unit yet. Add services from the Admin panel."}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <ServiceCard key={s.order} service={s} unitName={b.name_en} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------- fuel price block -- */
export function FuelPriceSection({ prices }: { prices: FuelPrice[] }) {
  const { lang, t } = useLang();
  return (
    <section className="bg-white border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] uppercase text-amber-600">
              <Fuel size={15} /> Daily Fuel Rates
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{t.sections.fuelPrices}</h2>
            <p className="text-slate-500 text-sm mt-1.5">{t.sections.fuelPricesSub}</p>
          </div>
          <span className="badge-green rounded-full px-4 py-2 text-[12px] font-bold">
            ● In Stock &amp; Available
          </span>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {prices.map((p) => (
            <div
              key={p.type}
              className="rounded-2xl border-2 bg-white p-6"
              style={{ borderColor: p.color + "55" }}
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: p.color + "18" }}>
                  <Fuel size={20} style={{ color: p.color }} />
                </div>
                <span className="badge-amber rounded-full px-3 py-1 text-[11px] font-bold">{p.tag}</span>
              </div>
              <div className="mt-4 text-xl font-extrabold text-slate-900">{p.name_en}</div>
              <div className="text-slate-500 text-sm">{p.name_si}</div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Price Per Liter</div>
                  <div className="text-3xl font-black text-slate-900 tabular-nums">
                    Rs. {p.price.toFixed(2)}
                  </div>
                </div>
                <div className="text-slate-400 text-xs">/ Liter</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------- rural bank network -- */
export function RuralBankNetwork() {
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return RURAL_BANK_BRANCHES;
    return RURAL_BANK_BRANCHES.filter(
      (b) =>
        b.name.toLowerCase().includes(s) ||
        b.name_si.includes(q.trim()) ||
        b.manager.includes(q.trim()) ||
        b.phone.includes(s) ||
        b.no.includes(s)
    );
  }, [q]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <SectionHead
        badge="Branch Network"
        title="ශාඛා ජාලය සහ සම්බන්ධතා"
        sub="අපේ ග්‍රාමීය බැංකු ශාඛා 22 ක ජාලය — ඔබේ ගමටම බැංකු සේවා."
        right={
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="field !pl-10"
              placeholder={lang === "si" ? "ශාඛාව, කළමනාකරු හෝ දුරකථනය අනුව සොයන්න..." : "Search branch, manager or phone..."}
            />
          </div>
        }
      />

      {/* hero badges row */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {[
          { icon: <Home size={20} />, value: "22", label: "Active Branches" },
          { icon: <TrendingUp size={20} />, value: "48+", label: "Years of Trust" },
          { icon: <ShieldCheck size={20} />, value: "100%", label: "Member Owned" },
        ].map((x) => (
          <div key={x.label} className="card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">{x.icon}</div>
            <div>
              <div className="text-2xl font-black text-slate-900">{x.value}</div>
              <div className="text-slate-500 text-[12.5px]">{x.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="table-x">
            <thead>
              <tr>
                <th>#</th>
                <th>BRANCH</th>
                <th>MANAGER</th>
                <th>CONTACT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((br) => (
                <tr key={br.no}>
                  <td className="font-bold text-indigo-700 tabular-nums">{br.no}</td>
                  <td>
                    <div className="font-bold text-slate-900">{lang === "si" ? br.name_si : br.name}</div>
                    <div className="text-slate-400 text-[11px]">{lang === "si" ? br.name : br.name_si}</div>
                  </td>
                  <td className="text-slate-600">{br.manager}</td>
                  <td>
                    <a href={`tel:${br.phone.replace(/\s/g, "")}`} className="text-indigo-700 font-semibold tabular-nums">
                      {br.phone}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hero-dark rounded-2xl p-8 mt-8 text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xl font-black">Become a Member of Panduwasnuwara MPCS</div>
          <div className="text-slate-300 text-sm mt-1">සාමාජිකත්වය ලබාගෙන අපේ බැංකු සේවා සියල්ලෙන් ප්‍රයෝජන ගන්න.</div>
        </div>
        <Link href="/membership/apply" className="btn btn-amber">
          Apply for Membership →
        </Link>
      </div>
    </section>
  );
}

/* --------------------------------------------------- consumer regional ----- */
export function RegionalBranches({ b }: { b: BusinessUnit }) {
  const { lang, t } = useLang();
  if (b.branches.length === 0) return null;
  return (
    <section className="bg-white border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <SectionHead badge="Regional Branches" title={`${t.sections.branches} (කලාපීය)`} sub={t.sections.branchesSub} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {b.branches.map((br) => (
            <div key={br.name} className="card p-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <MapPin size={19} />
                </div>
                <div>
                  <div className="font-extrabold text-slate-900">{br.name}</div>
                  <div className="text-slate-500 text-[12px]">{lang === "si" ? "කලාපීය ශාඛාව" : "Regional Branch"}</div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-[13px] text-slate-600">
                <div className="flex items-center gap-2"><UserRound size={14} className="text-slate-400" /> {br.manager}</div>
                <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {br.location}</div>
                <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {br.phone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ contacts ---- */
export function BusinessContacts({ b }: { b: BusinessUnit }) {
  const { lang } = useLang();
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <ContactCards contacts={b.contacts} />
        <div className="space-y-6">
          <SendInquiryCard department={b.name_en} />
          <div className="card p-5 text-[12.5px] text-slate-500 space-y-2">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-[13px]">
              <Clock size={15} /> Business Hours
            </div>
            <div>Mon – Sat : 8.30 AM – 5.30 PM</div>
            <div>Sunday &amp; Public Holidays : Closed</div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Star size={14} className="text-amber-500" />
              <span className="text-slate-600">Member privileges &amp; special offers available</span>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-[13px]">
              <Wallet size={15} /> Payment &amp; Valuation
            </div>
            <p className="text-slate-500 text-[12.5px] mt-2 leading-relaxed">
              {lang === "si"
                ? "මිල ගණන් සහ ගෙවීම් ක්‍රම පිළිබඳ විස්තර සඳහා අදාළ දෙපාර්තමේන්තු කළමනාකරු අමතන්න."
                : "Contact the relevant department manager for details on prices and payment methods."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
