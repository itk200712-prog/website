"use client";

// ============================================================================
// Business detail — default template + rural-bank / consumer / fuel-station
// ============================================================================

import Link from "next/link";
import {
  ChevronRight, Clock, Fuel, Home, MapPin, Phone, Search, ShieldCheck, Star, TrendingUp, UserRound, 
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { ContactCards, SectionHead, SendInquiryCard, ServiceCard } from "@/components/site-sections";
import type { BusinessUnit, FuelPrice } from "@/lib/types";
import { authedClient } from "@/lib/supabase/client";
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
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------- fuel live stock (F28 only) -- */
type StockRow = { id: string; fuel_type: string; amount: number | string; note?: string; created_at?: string; updated_at?: string };

const STOCK_META: Record<string, { en: string; si: string; color: string }> = {
  petrol92: { en: "Petrol 92", si: "ඔක්ටේන් 92", color: "#ef4444" },
  super_diesel: { en: "Super Diesel", si: "සුපර් ඩීසල්", color: "#f59e0b" },
  kerosene: { en: "Kerosene", si: "කිරෝසින් / භූමිතෙල්", color: "#3b82f6" },
};

function useCountUp(target: number, run: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setN(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return n;
}

function StockCard({ type, amount, price, idx }: { type: string; amount: number; price: number; idx: number }) {
  const meta = STOCK_META[type] ?? { en: type, si: type, color: "#64748b" };
  const liters = useCountUp(amount, true);
  const value = useCountUp(amount * price, true);
  return (
    <div
      className="rounded-3xl border-2 bg-white p-6 relative overflow-hidden fuel-fade-up"
      style={{ borderColor: meta.color + "55", animationDelay: `${idx * 0.15}s` }}
    >
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full opacity-20" style={{ background: meta.color }} />
      <div className="flex items-center justify-between relative">
        <div>
          <div className="text-lg font-extrabold text-slate-900">{meta.en}</div>
          <div className="text-slate-500 text-[12.5px]">{meta.si}</div>
        </div>
        <span className="rounded-full px-3 py-1 text-[10.5px] font-bold text-white" style={{ background: meta.color }}>
          LIVE
        </span>
      </div>
      <div className="mt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Live Stock</div>
        <div className="text-3xl font-black text-slate-900 tabular-nums">
          {liters.toLocaleString()} <span className="text-sm font-bold text-slate-500">L</span>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full fuel-shimmer" style={{ width: `${Math.min(100, (amount / 5000) * 100)}%`, background: meta.color }} />
      </div>
      <div className="mt-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Stock Value</div>
        <div className="text-2xl font-black tabular-nums" style={{ color: meta.color }}>
          Rs. {value.toLocaleString()}
        </div>
        <div className="text-[10.5px] text-slate-400 mt-0.5">Rs. {price.toFixed(2)} / L</div>
      </div>
    </div>
  );
}

export function FuelLiveStockSection() {
  const { lang } = useLang();
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const sb = await authedClient();
        const { data: u } = await sb.auth.getUser();
        if (!u?.user) { setReady(true); return; }
        const { data: m } = await sb.from("f28_members").select("status").eq("user_id", u.user.id).maybeSingle();
        if (!m || m.status !== "active") { setReady(true); return; }
        setAllowed(true);
        const [st, pr] = await Promise.all([
          sb.from("fuel_stock").select("*").order("created_at", { ascending: false }).limit(200),
          sb.from("fuel_prices").select("*"),
        ]);
        setRows((st.data as StockRow[]) ?? []);
        setPrices(Object.fromEntries(((pr.data as { type: string; price: number }[]) ?? []).map((r) => [r.type, Number(r.price)])));
      } catch { /* not allowed */ }
      setReady(true);
    })();
  }, []);

  if (ready && !allowed) return null; // non-F28 අයට section එක පේන්නෙම නෑ

  // දැනට තියෙන තොගය = එක් එක් type එකේ අන්තිම entry එකේ ගණන
  const latest: Record<string, number> = {};
  const seen = new Set<string>();
  for (const r of rows) {
    if (!seen.has(r.fuel_type)) {
      seen.add(r.fuel_type);
      latest[r.fuel_type] = Number(r.amount);
    }
  }
  const lastUpdate = rows.reduce((acc, r) => {
    const t = new Date(r.updated_at || r.created_at || 0).getTime();
    return t > acc ? t : acc;
  }, 0);
  // ✅ අවසාන යාවත්කාලීන දිනය හා වේලාව — පැහැදිලි, වෘත්තීය ආකෘතියෙන්
  const updatedAt = lastUpdate ? new Date(lastUpdate) : null;
  // "වප්"/"ඔක්තෝබර්" වගේ අවුල් නැති වෙන්න දිනය සර්වසාධාරණ ආකෘතියෙන් (16 Oct 2026)
  const dateText = updatedAt
    ? updatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const timeText = updatedAt
    ? updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : "";
  const totalValue = Object.entries(latest).reduce((a, [type, amt]) => a + amt * (prices[type] ?? 0), 0);

  return (
    <section className="bg-slate-50 border-y border-slate-200 relative overflow-hidden">
      <style>{`
        @keyframes fuelFadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
        @keyframes fuelShimmer { 0% { filter: brightness(1); } 50% { filter: brightness(1.25); } 100% { filter: brightness(1); } }
        .fuel-fade-up { animation: fuelFadeUp .7s ease both; }
        .fuel-shimmer { animation: fuelShimmer 2.2s ease-in-out infinite; }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] uppercase text-indigo-600">
              <ShieldCheck size={15} /> F28 Members Only
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Live Stock &amp; Value</h2>
            <p className="text-slate-500 text-sm mt-1.5">සජීවී තොග තත්ත්වය සහ වටිනාකම — ඉන්ධන හලේ නවතම තොග දත්ත</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Total Stock Value</div>
            <div className="text-3xl font-black text-slate-900 tabular-nums">Rs. {totalValue.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {(["petrol92", "super_diesel", "kerosene"] as const).map((type, i) => (
            <StockCard key={type} type={type} amount={latest[type] ?? 0} price={prices[type] ?? 0} idx={i} />
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-5 sm:px-6 py-4 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.45)] flex flex-wrap items-center justify-between gap-4 fuel-fade-up">
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-600/25">
              <Clock size={19} />
            </span>
            <div>
              <div className={`text-[10px] font-bold uppercase text-slate-400 ${lang === "si" ? "tracking-[0.06em]" : "tracking-[0.2em]"}`}>
                {lang === "si" ? "අවසාන යාවත්කාලීන කිරීම" : "Last Updated"}
              </div>
              <div className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                {lang === "si" ? "අවසානවරට යාවත්කාලීන කළ දිනය හා වේලාව" : "Date and time of the last stock update"}
              </div>
            </div>
          </div>
          <div className="text-right leading-tight">
            <div className="text-[15px] font-extrabold text-slate-900 tabular-nums">{dateText}</div>
            <div className="text-[12px] font-semibold text-slate-500 tabular-nums mt-0.5">
              {timeText || (lang === "si" ? "තාම යාවත්කාලීන කර නැත" : "Not updated yet")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
