"use client";

// ============================================================================
// Business detail — default template + rural-bank / consumer / fuel-station
// ============================================================================

import Link from "next/link";
import {
  ChevronRight, Clock, Fuel, Home, MapPin, Phone, PhoneCall, Search, ShieldCheck, Star, Store, TrendingUp, UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { ContactCards, SectionHead, SendInquiryCard, ServiceCard } from "@/components/site-sections";
import type { BusinessContact, BusinessUnit, FuelPrice } from "@/lib/types";
import { animationMarqueeDurationSeconds, animationWatermarkOpacity } from "@/lib/animation-settings";
import { authedClient } from "@/lib/supabase/client";
import { RURAL_BANK_BRANCHES } from "@/lib/seed";

/* ---------------------------------------------------------------- hero ---- */
export function BusinessHero({ b }: { b: BusinessUnit }) {
  const { lang, t } = useLang();
  const products = b.animation?.products ?? [];
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

        {/* Admin → Animation: උඩින් animate වෙලා යන product images */}
        {products.length > 0 && (
          <div className="mt-9">
            <div className="mb-3 flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.22em] text-amber-300">
              <Star size={13} /> {lang === "si" ? "අපගේ නිෂ්පාදන" : "Our Products"}
            </div>
            <div className="biz-products-marquee" aria-label={lang === "si" ? "නිෂ්පාදන" : "Products"}>
              <div
                className="biz-products-track"
                style={{ animationDuration: `${animationMarqueeDurationSeconds(products.length)}s` }}
              >
                {[...products, ...products].map((src, i) => (
                  <div
                    key={`${src}-${i}`}
                    aria-hidden={i >= products.length}
                    className="biz-product-float group flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] bg-gradient-to-b from-white to-slate-50 p-2 shadow-[0_18px_35px_-18px_rgba(2,6,23,0.65)] ring-1 ring-white/50 transition-shadow duration-300 hover:shadow-[0_26px_45px_-18px_rgba(2,6,23,0.8)] sm:h-28 sm:w-28"
                    style={{ animationDelay: `${-(i % products.length) * 0.55}s` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={i < products.length ? `${lang === "si" ? b.name_si || b.name_en : b.name_en} product ${i + 1}` : ""}
                      className="h-full w-full rounded-2xl object-contain drop-shadow-sm transition duration-300 group-hover:scale-[1.06]"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------- page background image -- */
// Admin → Animation එකෙන් දාන image එක මුළු business පිටුවේම පසුබිමට (watermark)
// වැටෙනවා — logo එක පිටිපස්සේ නෙවෙයි. Brightness එකෙන් පේන තද බව හැදෙනවා.
export function BusinessPageWatermark({ b }: { b: BusinessUnit }) {
  const anim = b.animation;
  if (!anim?.bgImage) return null;
  const brightness = anim.brightness ?? 55;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={anim.bgImage}
        alt=""
        className="biz-anim-bg h-full w-full object-cover"
        style={{
          opacity: animationWatermarkOpacity(brightness),
          filter: `brightness(${brightness}%)`,
        }}
      />
    </div>
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
export function RuralBankNetwork({ b }: { b: BusinessUnit }) {
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const branches = useMemo(
    () =>
      b.branches.length > 0
        ? b.branches.map((br, i) => ({
            no: String(i + 1).padStart(2, "0"),
            name: br.name,
            name_si: br.name_si || br.location || "",
            manager: br.manager,
            phone: br.phone,
          }))
        : RURAL_BANK_BRANCHES,
    [b.branches]
  );
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return branches;
    return branches.filter(
      (br) =>
        br.name.toLowerCase().includes(s) ||
        br.name_si.includes(q.trim()) ||
        br.manager.includes(q.trim()) ||
        br.phone.includes(s) ||
        br.no.includes(s)
    );
  }, [branches, q]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <SectionHead
        badge="Branch Network"
        title="ශාඛා ජාලය සහ සම්බන්ධතා"
        sub={`අපේ ග්‍රාමීය බැංකු ශාඛා ${branches.length} ක ජාලය — ඔබේ ගමටම බැංකු සේවා.`}
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
          { icon: <Home size={20} />, value: String(branches.length), label: "Active Branches" },
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    {lang === "si" ? "ගැලපෙන ශාඛාවක් හමු නොවුණි." : "No matching branch found."}
                  </td>
                </tr>
              )}
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
  const si = lang === "si";
  const labels = {
    name: si ? "කලාපීය ශාඛාවේ නම" : "Regional Name",
    manager: si ? "කළමනාකරුගේ නම" : "Manager Name",
    location: si ? "ස්ථානය" : "Location",
    hotline: si ? "හොට්ලයින්" : "Hotline",
    call: si ? "අමතන්න" : "Call",
  };

  return (
    <section className="bg-white border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <SectionHead
          badge="Regional Branches"
          title={si ? "කලාපීය ශාඛා" : "Regional Branches"}
          sub={t.sections.branchesSub}
        />
        {/* දිග පේළි: Regional Name → Manager Name → Location → Hotline, ඊළඟ ශාඛාව ඊට යටින් */}
        <div className="mx-auto max-w-6xl space-y-3">
          {b.branches.map((br, i) => {
            const phoneHref = br.phone ? `tel:${br.phone.replace(/\s/g, "")}` : undefined;
            const fields = [
              { label: labels.name, value: br.name, icon: <MapPin size={16} /> },
              { label: labels.manager, value: br.manager, icon: <UserRound size={16} /> },
              { label: labels.location, value: br.location, icon: <MapPin size={16} /> },
            ];
            return (
              <article
                key={`${br.name}-${i}`}
                className="contact-pro-card contact-pro-emerald grid gap-4 rounded-3xl border border-emerald-100 bg-white p-4 sm:p-5 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {fields.map((field, fieldIndex) => (
                  <div key={field.label} className="contact-pro-field flex min-w-0 items-start gap-3 rounded-2xl px-3 py-2.5">
                    <span className="contact-pro-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
                      {fieldIndex === 0 && br.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={br.photo} alt={br.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        field.icon
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {field.label}
                      </span>
                      <span className={`mt-1 block break-words text-[13.5px] font-bold leading-snug ${fieldIndex === 0 ? "text-[15px] font-black text-slate-900" : "text-slate-700"}`}>
                        {field.value || "—"}
                      </span>
                    </span>
                  </div>
                ))}
                <div className="contact-pro-hotline rounded-2xl bg-emerald-700 px-4 py-3 text-white md:min-w-44">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-100">
                    <PhoneCall size={14} /> {labels.hotline}
                  </div>
                  <div className="mt-1 text-[15px] font-black tabular-nums">{br.phone || "—"}</div>
                  {phoneHref && (
                    <a
                      href={phoneHref}
                      className="contact-pro-call mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-black text-emerald-800"
                    >
                      <Phone size={11} /> {labels.call}
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------- Coop City branch cards ----- */
export function CoopCityBranches({ b }: { b: BusinessUnit }) {
  const { lang } = useLang();
  if (b.slug !== "coop-city" || b.branches.length === 0) return null;
  const si = lang === "si";
  const labels = {
    type: si ? "Coop City වර්ගය" : "Coop City Type",
    manager: si ? "කළමනාකරුගේ නම" : "Manager Name",
    location: si ? "ස්ථානය" : "Location",
    hotline: si ? "හොට්ලයින්" : "Hot Line",
    call: si ? "අමතන්න" : "Call",
  };

  return (
    <section className="bg-gradient-to-b from-emerald-50/80 via-white to-white border-y border-emerald-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <SectionHead
          badge={si ? "Coop City ශාඛා" : "Coop City Branches"}
          title={si ? "අපගේ Coop City සහ Mini Coop City ශාඛා" : "Our Coop City & Mini Coop City Branch"}
          sub={
            si
              ? "ඔබට ළඟම Coop City හෝ Mini Coop City ශාඛාව තෝරා ගන්න — වර්ගය, කළමනාකරු, ස්ථානය සහ හොට්ලයින් අංකය මෙහි ඇත."
              : "Choose your nearest Coop City or Mini Coop City branch — branch type, manager, location and hotline are listed here."
          }
        />

        <div className="mx-auto max-w-5xl space-y-4">
          {b.branches.map((br, i) => {
            const phoneHref = br.phone ? `tel:${br.phone.replace(/\s/g, "")}` : undefined;
            const rows = [
              { label: labels.type, value: br.name, icon: <Store size={17} /> },
              { label: labels.manager, value: br.manager, icon: <UserRound size={17} /> },
              { label: labels.location, value: br.location, icon: <MapPin size={17} /> },
            ];
            return (
              <article
                key={`${br.name}-${i}`}
                className="card contact-pro-card contact-pro-emerald group rounded-3xl border border-emerald-100 bg-white"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
                  <div className="flex items-center gap-4 lg:w-56 lg:shrink-0">
                    <div className="contact-pro-icon flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20">
                      {br.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={br.photo} alt={br.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Store size={24} />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                        {si ? `ශාඛාව ${String(i + 1).padStart(2, "0")}` : `Branch ${String(i + 1).padStart(2, "0")}`}
                      </div>
                      <h3 className="mt-1 text-lg font-black leading-snug text-slate-900">{br.name || "—"}</h3>
                    </div>
                  </div>

                  <div className="grid flex-1 gap-3 sm:grid-cols-3">
                    {rows.map((row) => (
                      <div key={row.label} className="contact-pro-field rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          <span className="text-emerald-600">{row.icon}</span>
                          {row.label}
                        </div>
                        <div className="mt-1.5 break-words text-[13px] font-bold leading-snug text-slate-800">
                          {row.value || "—"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="contact-pro-hotline rounded-2xl bg-emerald-700 p-4 text-white lg:w-52 lg:shrink-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                      <PhoneCall size={15} /> {labels.hotline}
                    </div>
                    <div className="mt-1 text-lg font-black tabular-nums">{br.phone || "—"}</div>
                    {phoneHref && (
                      <a
                        href={phoneHref}
                        className="contact-pro-call mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11.5px] font-black text-emerald-800"
                      >
                        <Phone size={12} /> {labels.call}
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BusinessHoursCard() {
  return (
    <div className="card contact-pro-card contact-pro-amber self-start rounded-3xl p-5 text-[12.5px] text-slate-500 space-y-2">
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
  );
}

/** Consumer Section එකේ කළමනාකරුවන් දෙදෙනා වෙන වෙනම දිග පේළි දෙකකින් පෙන්වයි. */
export function ConsumerManagerContacts({ contacts }: { contacts: BusinessContact[] }) {
  const { lang } = useLang();
  const si = lang === "si";
  const managers = contacts.filter((c) => {
    const role = `${c.role_en} ${c.role_si}`.toLowerCase();
    return !role.includes("regional branch") && !role.includes("ප්‍රාදේශීය ශාඛාව") && !role.includes("කලාපීය ශාඛා");
  });
  if (managers.length === 0) return null;
  const labels = {
    type: si ? "කළමනාකරු වර්ගය" : "Manager Type",
    name: si ? "නම" : "Name",
    location: si ? "ස්ථානය" : "Location",
    hotline: si ? "හොට්ලයින්" : "Hotline",
    call: si ? "අමතන්න" : "Call",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      {managers.map((c, i) => {
        const phoneHref = c.phone ? `tel:${c.phone.replace(/\s/g, "")}` : undefined;
        const fields = [
          { label: labels.type, value: si ? c.role_si || c.role_en : c.role_en || c.role_si, icon: <ShieldCheck size={16} /> },
          { label: labels.name, value: c.name, icon: <UserRound size={16} /> },
          { label: labels.location, value: c.location, icon: <MapPin size={16} /> },
        ];
        return (
          <article
            key={`${c.role_en}-${c.name}-${i}`}
            className="contact-pro-card contact-pro-indigo grid gap-4 rounded-3xl border border-indigo-100 bg-white p-4 sm:p-5 md:grid-cols-[1.15fr_1fr_1fr_auto] md:items-center"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            {fields.map((field, fieldIndex) => (
              <div key={field.label} className="contact-pro-field flex min-w-0 items-start gap-3 rounded-2xl px-3 py-2.5">
                <span className="contact-pro-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                  {field.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {field.label}
                  </span>
                  <span className={`mt-1 block break-words text-[13.5px] font-bold leading-snug ${fieldIndex === 1 ? "text-[15px] font-black text-slate-900" : "text-slate-700"}`}>
                    {field.value || "—"}
                  </span>
                </span>
              </div>
            ))}
            <div className="contact-pro-hotline rounded-2xl bg-indigo-700 px-4 py-3 text-white md:min-w-44">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-indigo-100">
                <PhoneCall size={14} /> {labels.hotline}
              </div>
              <div className="mt-1 text-[15px] font-black tabular-nums">{c.phone || "—"}</div>
              {phoneHref && (
                <a
                  href={phoneHref}
                  className="contact-pro-call mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-black text-indigo-800"
                >
                  <Phone size={11} /> {labels.call}
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ contacts ---- */
export function BusinessContacts({ b }: { b: BusinessUnit }) {
  const { t } = useLang();

  // Consumer Section: Regional පේළිවලට යටින් කළමනාකරුවන් දෙදෙනාම
  // Manager Type → Name → Location → Hotline ලෙස වෙන වෙනම පෙන්වයි.
  if (b.special === "consumer") {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <SectionHead badge="Contact & Information" title={t.sections.contacts || "දෙපාර්තමේන්තු සම්බන්ධතා සහ විමසීම්"} sub={t.sections.contactsSub} />
        <ConsumerManagerContacts contacts={b.contacts} />
        <div className="mx-auto mt-8 grid max-w-6xl items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
          <SendInquiryCard department={b.name_en} />
          <BusinessHoursCard />
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <ContactCards contacts={b.contacts} />
        <div className="space-y-6">
          <SendInquiryCard department={b.name_en} />
          <BusinessHoursCard />
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
