"use client";

// ============================================================================
// Site header — Businesses mega-dropdown + Membership mega-dropdown
// ============================================================================

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Menu, X, UserRound, Building2, UsersRound, Newspaper, Images, Phone, Home, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { LangSwitcher } from "@/components/lang-switcher";
import { BUSINESSES } from "@/lib/seed";

export function SiteHeader() {
  const { t, lang, setLang } = useLang();
  const L = (p: string) => `/${lang}${p === "/" ? "" : p}`;
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);

  const publicBusinesses = BUSINESSES.filter((b) => b.active);

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[72px] gap-3">
          {/* logo */}
          <Link href={L("/")} className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white flex items-center justify-center text-[10px] font-black tracking-wide shadow">
              coop
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-white text-[13.5px] leading-tight max-w-[230px] truncate" title={t.brand}>{t.brand}</div>
              <div className="text-[9.5px] text-slate-400 tracking-wide uppercase">Panduwasnuwara New MPCS</div>
            </div>
          </Link>

          {/* desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 text-[13px] font-semibold text-slate-200 whitespace-nowrap">
            <Link href={L("/")} className="px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1.5">
              <Home size={15} /> {t.nav.home}
            </Link>

            {/* Businesses dropdown */}
            <div className="relative" onMouseEnter={() => setOpen("biz")} onMouseLeave={() => setOpen(null)}>
              <button className="px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1">
                <Building2 size={15} /> {t.nav.businesses} <ChevronDown size={14} />
              </button>
              {open === "biz" && (
                <div className="mega">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="section-badge">Our Business Divisions</div>
                    <span className="text-xs text-slate-400">{publicBusinesses.length} Divisions</span>
                  </div>
                  <div className="mega-scroll grid grid-cols-2 gap-1.5">
                    {publicBusinesses.map((b) => (
                      <Link
                        key={b.slug}
                        href={L(`/businesses/${b.slug}`)}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200"
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                          {b.name_en.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12.5px] font-bold text-slate-800 truncate">{lang === "si" ? b.name_si : b.name_en}</span>
                            {b.is_new && <span className="badge-new">NEW</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {(lang === "si" ? b.tagline_si || b.category_si : b.tagline_en || b.category_en) || b.category_en}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <Link href={L("/businesses")} className="text-[12.5px] font-bold text-indigo-700 hover:underline px-1">
                      {t.nav.allBusinesses} →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Membership dropdown */}
            <div className="relative" onMouseEnter={() => setOpen("mem")} onMouseLeave={() => setOpen(null)}>
              <button className="px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1">
                <UsersRound size={15} /> {t.nav.membership} <ChevronDown size={14} />
              </button>
              {open === "mem" && (
                <div className="mega" style={{ width: "min(92vw, 420px)" }}>
                  <div className="section-badge mb-2">Membership Portal — MPCS</div>
                  <div className="flex flex-col gap-1">
                    <Link href={L("/membership/members")} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                      <UsersRound size={18} className="text-indigo-700" />
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">{t.nav.memberDetails}</div>
                        <div className="text-[11px] text-slate-500">Search full registered member registry</div>
                      </div>
                    </Link>
                    <Link href={L("/membership/voters")} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                      <ShieldCheck size={18} className="text-indigo-700" />
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">{t.nav.voters}</div>
                        <div className="text-[11px] text-slate-500">Cooperative electoral register</div>
                      </div>
                    </Link>
                    <Link href={L("/membership/apply")} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                      <Newspaper size={18} className="text-indigo-700" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-slate-800">{t.nav.apply}</span>
                          <span className="badge-new">{t.labels.applyBadge}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">Online application &amp; certified rubber stamp</div>
                      </div>
                    </Link>
                    <div className="border-t border-slate-100 my-1" />
                    <Link href={L("/register")} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                      <UserRound size={18} className="text-slate-500" />
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">{t.nav.register}</div>
                        <div className="text-[11px] text-slate-500">Create a new cooperative account</div>
                      </div>
                    </Link>
                    <Link href={L("/signin")} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                      <UserRound size={18} className="text-indigo-700" />
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">{t.nav.signin}</div>
                        <div className="text-[11px] text-slate-500">Access your existing profile</div>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link href={L("/gallery")} className="px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1.5">
              <Images size={15} /> {t.nav.gallery}
            </Link>
            <Link href={L("/news")} className="px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1.5">
              <Newspaper size={15} /> {t.nav.news}
            </Link>
            <Link href={L("/contact")} className="px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1.5">
              <Phone size={15} /> {t.nav.contact}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {/* language switcher (professional) */}
            <LangSwitcher tone="dark" />
            <Link href={L("/register")} className="hidden sm:inline-flex items-center gap-1.5 !py-2 !px-4 !text-[12.5px] rounded-full bg-white/10 text-white font-bold border border-white/25 hover:bg-white/20 transition">
              <UserRound size={14} /> {t.nav.register}
            </Link>
            <Link href={L("/signin")} className="inline-flex items-center gap-1.5 !py-2 !px-4 !text-[12.5px] rounded-full bg-white text-slate-900 font-bold hover:bg-slate-100 transition">
              <UserRound size={14} /> {t.nav.signin}
            </Link>
            <button className="lg:hidden p-2 rounded-lg border border-slate-200" onClick={() => setMobile(!mobile)}>
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* mobile nav */}
      {mobile && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1 text-sm font-semibold">
          {[
            ["/", t.nav.home],
            ["/businesses", t.nav.businesses],
            ["/membership/members", t.nav.memberDetails],
            ["/membership/voters", t.nav.voters],
            ["/membership/apply", t.nav.apply],
            ["/board", t.nav.board],
            ["/gallery", t.nav.gallery],
            ["/news", t.nav.news],
            ["/contact", t.nav.contact],
            ["/signin", t.nav.signin],
            ["/register", t.nav.register],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="px-3 py-2.5 rounded-lg hover:bg-slate-50" onClick={() => setMobile(false)}>
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
