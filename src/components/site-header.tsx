"use client";

// ============================================================================
// Site header — Businesses mega-dropdown + Membership mega-dropdown
// ============================================================================

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X, UserRound, Building2, UsersRound, Newspaper, Images, Phone, Home, ShieldCheck, Lock, LogOut, ChevronDown as ChevDown } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { LangSwitcher } from "@/components/lang-switcher";
import { BUSINESSES } from "@/lib/seed";
import { authedClient } from "@/lib/supabase/client";

export function SiteHeader() {
  const { t, lang, setLang } = useLang();
  const L = (p: string) => `/${lang}${p === "/" ? "" : p}`;
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [f28, setF28] = useState(false);
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [meOpen, setMeOpen] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [glide, setGlide] = useState({ x: 0, w: 0, on: false });
  function glideTo(el: HTMLElement | null) {
    const nav = navRef.current;
    if (!nav || !el) return;
    const r = el.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    setGlide({ x: r.left - nr.left, w: r.width, on: true });
  }
  const openMenu = (k: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen(k);
  };
  const closeMenuSoon = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(null), 250);
  };

  // F28: authenticate කරපු members ලට පමණයි header එකේ පේන්නේ
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = await authedClient();
        const { data: u } = await sb.auth.getUser();
        if (!u?.user) return;
        const { data: prof } = await sb.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
        if (alive) setMe({ name: prof?.full_name || u.user.email || "Profile" });
        const { data } = await sb.from("f28_members").select("status").eq("user_id", u.user.id).maybeSingle();
        if (alive && data && data.status === "active") setF28(true);
      } catch { /* not logged in */ }
    })();
    return () => { alive = false; };
  }, []);

  const publicBusinesses = BUSINESSES.filter((b) => b.active);

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[72px] gap-3">
          {/* logo */}
          <Link href={L("/")} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white flex items-center justify-center text-[10px] font-black tracking-wide shadow shrink-0">
              coop
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-extrabold text-white text-[10px] sm:text-[11.5px] leading-[1.3] sm:leading-tight max-w-[190px] sm:max-w-[300px] sm:whitespace-nowrap" title={t.brand}>{t.brand}</div>
              <div className="text-[9px] sm:text-[9.5px] text-slate-400 tracking-wide uppercase truncate">Panduwasnuwara New MPCS</div>
            </div>
          </Link>

          {/* desktop nav */}
          <nav
            ref={navRef}
            className="hidden lg:flex items-center gap-0.5 text-[13px] font-semibold text-slate-200 whitespace-nowrap relative"
            onMouseLeave={() => setGlide((g) => ({ ...g, on: false }))}
          >
            {/* sliding hover glider */}
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-400 to-indigo-400 transition-all duration-300 ease-out pointer-events-none"
              style={{ width: glide.w, transform: `translateX(${glide.x}px)`, opacity: glide.on ? 1 : 0 }}
            />
            <Link href={L("/")} onMouseEnter={(e) => glideTo(e.currentTarget)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
              <Home size={15} /> {t.nav.home}
            </Link>

            {/* Businesses dropdown */}
            <div className="relative" onMouseEnter={() => openMenu("biz")} onMouseLeave={closeMenuSoon}>
              <button onMouseEnter={(e) => glideTo(e.currentTarget)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1">
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
                        className="flex items-start gap-2.5 p-2.5 rounded-xl border border-transparent hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50/70 hover:shadow-md transition-all duration-200"
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 shrink-0 overflow-hidden">
                          {b.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.logo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            b.name_en.slice(0, 2).toUpperCase()
                          )}
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
            <div className="relative" onMouseEnter={() => openMenu("mem")} onMouseLeave={closeMenuSoon}>
              <button onMouseEnter={(e) => glideTo(e.currentTarget)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1">
                <UsersRound size={15} /> {t.nav.membership} <ChevronDown size={14} />
              </button>
              {open === "mem" && (
                <div className="mega" style={{ width: "min(92vw, 420px)" }}>
                  <div className="section-badge mb-2">Membership Portal — MPCS</div>
                  <div className="flex flex-col gap-1">
                    <Link href={L("/membership/members")} className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50/70 hover:shadow-md transition-all duration-200">
                      <UsersRound size={18} className="text-indigo-700" />
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">{t.nav.memberDetails}</div>
                        <div className="text-[11px] text-slate-500">Search full registered member registry</div>
                      </div>
                    </Link>
                    <Link href={L("/membership/voters")} className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50/70 hover:shadow-md transition-all duration-200">
                      <ShieldCheck size={18} className="text-indigo-700" />
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">{t.nav.voters}</div>
                        <div className="text-[11px] text-slate-500">Cooperative electoral register</div>
                      </div>
                    </Link>
                    <Link href={L("/membership/apply")} className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50/70 hover:shadow-md transition-all duration-200">
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
                    {me ? (
                      <Link href={L("/dashboard")} className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50/70 hover:shadow-md transition-all duration-200">
                        <UserRound size={18} className="text-indigo-700" />
                        <div>
                          <div className="text-[13px] font-bold text-slate-800">{me.name} — Profile</div>
                          <div className="text-[11px] text-slate-500">මගේ විස්තර, F28 සහ password එක වෙනස් කිරීම</div>
                        </div>
                      </Link>
                    ) : (
                      <>
                        <Link href={L("/register")} className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50/70 hover:shadow-md transition-all duration-200">
                          <UserRound size={18} className="text-slate-500" />
                          <div>
                            <div className="text-[13px] font-bold text-slate-800">{t.nav.register}</div>
                            <div className="text-[11px] text-slate-500">Create a new cooperative account</div>
                          </div>
                        </Link>
                        <Link href={L("/signin")} className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50/70 hover:shadow-md transition-all duration-200">
                          <UserRound size={18} className="text-indigo-700" />
                          <div>
                            <div className="text-[13px] font-bold text-slate-800">{t.nav.signin}</div>
                            <div className="text-[11px] text-slate-500">Access your existing profile</div>
                          </div>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link href={L("/gallery")} onMouseEnter={(e) => glideTo(e.currentTarget)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
              <Images size={15} /> {t.nav.gallery}
            </Link>
            <Link href={L("/news")} onMouseEnter={(e) => glideTo(e.currentTarget)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
              <Newspaper size={15} /> {t.nav.news}
            </Link>
            {f28 && (
              <Link href={L("/dashboard/f28")} onMouseEnter={(e) => glideTo(e.currentTarget)} className="px-3 py-2 rounded-lg bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 transition-colors flex items-center gap-1.5 font-bold">
                <Lock size={15} /> F28
              </Link>
            )}
            <Link href={L("/contact")} onMouseEnter={(e) => glideTo(e.currentTarget)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
              <Phone size={15} /> {t.nav.contact}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {/* language switcher (professional) */}
            {me ? (
              <div className="relative">
                <button
                  className="inline-flex items-center gap-2.5 !py-1.5 !px-2.5 !text-[12px] rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-lg shadow-black/20 backdrop-blur transition-all hover:shadow-white/10"
                  onClick={() => setMeOpen(!meOpen)}
                >
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-fuchsia-500 text-white flex items-center justify-center text-[12px] font-black ring-2 ring-white/40 shadow-md">
                    {me.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="max-w-[110px] truncate font-bold text-white">{me.name}</span>
                    <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-amber-300/90">
                      {lang === "si" ? "සාමාජික" : "Member"}
                    </span>
                  </span>
                  <ChevDown size={13} className="hidden sm:inline text-white/70" />
                </button>
                {meOpen && (
                  <div className="absolute right-0 mt-2 w-48 card p-1.5 shadow-xl z-50">
                    <Link href={L("/dashboard")} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-[12.5px] font-bold text-slate-800" onClick={() => setMeOpen(false)}>
                      <UserRound size={14} /> Profile
                    </Link>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 text-[12.5px] font-bold text-rose-600"
                      onClick={async () => {
                        const sb = await authedClient();
                        await sb.auth.signOut();
                        window.location.href = L("/");
                      }}
                    >
                      <LogOut size={14} /> Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href={L("/register")} className="hidden sm:inline-flex items-center gap-1.5 !py-2 !px-4 !text-[12.5px] rounded-full bg-white/10 text-white font-bold border border-white/25 hover:bg-white/20 transition">
                  <UserRound size={14} /> {t.nav.register}
                </Link>
                <Link href={L("/signin")} className="hidden sm:inline-flex items-center gap-1.5 !py-2 !px-4 !text-[12.5px] rounded-full bg-white text-slate-900 font-bold hover:bg-slate-100 transition">
                  <UserRound size={14} /> {t.nav.signin}
                </Link>
              </>
            )}
            <button className="lg:hidden p-2 rounded-lg border border-slate-200" onClick={() => setMobile(!mobile)}>
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* mobile nav — image background + සියලු මෙනු options */}
      {mobile && (
        <div
          className="lg:hidden relative border-t border-white/10"
          style={{
            backgroundImage: `linear-gradient(rgba(11,16,41,0.93), rgba(11,16,41,0.96)), url(/images/hero/hero-1.jpg)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="px-4 py-4 flex flex-col gap-1 text-sm font-semibold text-white max-h-[75vh] overflow-y-auto">
            <Link href={L("/")} className="px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
              <Home size={15} /> {t.nav.home}
            </Link>

            {/* businesses — all */}
            <button className="px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center justify-between" onClick={() => setBizOpen(!bizOpen)}>
              <span className="flex items-center gap-2.5"><Building2 size={15} /> {t.nav.businesses}</span>
              <ChevronDown size={14} className={bizOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            {bizOpen && (
              <div className="pl-4 flex flex-col gap-0.5">
                {publicBusinesses.map((b) => (
                  <Link key={b.slug} href={L(`/businesses/${b.slug}`)} className="px-3 py-2 rounded-lg hover:bg-white/10 text-[12.5px] flex items-center gap-2" onClick={() => setMobile(false)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                    {lang === "si" ? b.name_si : b.name_en}
                  </Link>
                ))}
              </div>
            )}

            {/* membership — all */}
            <div className="px-3 pt-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/45">{t.nav.membership}</div>
            <Link href={L("/membership/members")} className="pl-6 pr-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
              <UsersRound size={15} /> {t.nav.memberDetails}
            </Link>
            <Link href={L("/membership/voters")} className="pl-6 pr-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
              <UsersRound size={15} /> {t.nav.voters}
            </Link>
            <Link href={L("/membership/apply")} className="pl-6 pr-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
              <UserRound size={15} /> {t.nav.apply}
            </Link>

            {/* other */}
            <div className="px-3 pt-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/45">More</div>
            <Link href={L("/gallery")} className="px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
              <Images size={15} /> {t.nav.gallery}
            </Link>
            <Link href={L("/news")} className="px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
              <Newspaper size={15} /> {t.nav.news}
            </Link>
            <Link href={L("/contact")} className="px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
              <Phone size={15} /> {t.nav.contact}
            </Link>
            {f28 && (
              <Link href={L("/dashboard/f28")} className="px-3 py-2.5 rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 flex items-center gap-2.5 font-bold" onClick={() => setMobile(false)}>
                <Lock size={15} /> F28
              </Link>
            )}

            {/* account */}
            <div className="border-t border-white/10 mt-2.5 pt-2.5">
              {me ? (
                <>
                  <Link href={L("/dashboard")} className="px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
                    <UserRound size={15} /> {me.name} — Profile
                  </Link>
                  <button
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-rose-500/20 text-rose-300 flex items-center gap-2.5"
                    onClick={async () => {
                      const sb = await authedClient();
                      await sb.auth.signOut();
                      window.location.href = L("/");
                    }}
                  >
                    <LogOut size={15} /> Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link href={L("/signin")} className="px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
                    <UserRound size={15} /> {t.nav.signin}
                  </Link>
                  <Link href={L("/register")} className="px-3 py-2.5 rounded-lg hover:bg-white/10 flex items-center gap-2.5" onClick={() => setMobile(false)}>
                    <UserRound size={15} /> {t.nav.register}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}