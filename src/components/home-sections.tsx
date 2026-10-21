"use client";

// ============================================================================
//  Home sections — reference site (alpha) එකේ පිළිවෙලට:
//  Hero → Stats → Board → About → Businesses → Gallery → News → CTA → Contact
//  සියලු පෙළ භාෂාව අනුව (සිංහල / English) — /si /en routes සමඟ
// ============================================================================

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Newspaper,
  Phone,
  Send,
  ShieldCheck,
  Landmark,
  Eye,
  Target,
  MapPin,
  Mail,
  Clock,
  Images, X, GraduationCap, Users, CheckCircle2, Building2} from "lucide-react";
import { GallerySocial, useMe, updateItem, type Me } from "@/components/gallery-grid";
import type { GalleryComment } from "@/lib/types";
import { useEffect, useState } from "react";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { SiteLogoBadge } from "@/components/site-logo";
import { createClient } from "@/lib/supabase/client";
import { SectionHead, StatCard, PersonCard } from "@/components/site-sections";
import { BoxIcon } from "@/components/box-icon";
import { HomeClientBits } from "@/components/home-client";
import { useLang } from "@/lib/i18n";
import { SITE } from "@/lib/seed";
import type { BusinessUnit, NewsItem, BoardMember, SiteSettings, GalleryItem } from "@/lib/types";

const HOME_COPY = {
  si: {
    heroTag: "",
    heroDesc:
      "",
    cta1: "සාමාජිකත්වයට අයදුම් කරන්න",
    cta2: "ව්‍යාපාර හා සේවා",
    estBadge: "ස්ථාපිත 1976 — විශ්වාසනීය සේවය",
    reg: "ලියාපදිංචි අංකය",
    boardBadge: "",
    boardTitle: "අධ්‍යක්ෂ මණ්ඩලය",
    boardSub: "",
    officersTitle: "",
    all: "සියල්ල බලන්න →",
    statMembers: "සාමාජිකයින්",
    statVoters: "ඡන්ද දායකයින්",
    statDivisions: "ව්‍යාපාර අංශ",
    statYears: "සේවා වසර",
    aboutBadge: "අප ගැන",
    aboutTitle: "ග්‍රාමීය බැංකු, පාරිභෝගික භාණ්ඩ සහ වෙළෙඳ නියෝජිතායතන එකම වහලක් යටින්",
    aboutP1:
      "අපගේ සමූපකාර සමිතිය ගමේ ජනතාවගේ යහපත උදෙසා ග්‍රාමීය බැංකුව, පාරිභෝගික භාණ්ඩ අලෙවිසැල, නිෂ්පාදන නියෝජිතායතන සහ ඉන්ධන පිරවුම්හල එකට එක් කරයි. සාමාජිකයින්ගේ ඉතුරුම් සුරැකීම, ප්‍රදේශයේ වෙළෙඳුන්ට සහාය වීම සහ ශක්තිමත් ප්‍රජාවක් ගොඩනැගීම අපගේ සමස්ත මෙහෙවරයි.",
    aboutP2:
      "සමිතිය 1976 ඔක්තෝබර් 6 වන දින සමූපකාර දෙපාර්තමේන්තුව යටතේ ලියාපදිංචි කරන ලදී. අඩ සියවසකට වැඩි කාලයක් මුළුල්ලේ, මෙය තවමත් ක්‍රියාත්මක වන්නේ සාමාජිකයින් විසින් තෝරා පත් කරගත් සාමාජිකයින් වෙනුවෙනි.",
    principles: "සමූපකාර ස්වාධීනත්වය · ප්‍රජාතන්ත්‍රවාදී පාලනය · සාමාජික ආර්ථික සහභාගීත්වය · ප්‍රජා සුබසාධනය.",
    vision: "අපගේ දැක්ම",
    visionText: "බල ප්‍රදේශය තුළ උසස් මට්ටමේ ව්‍යාපාරික සේවාවන් සපයන ප්‍රමුඛ වෙළඳ ආයතනය බවට පත්වීම.",
    mission: "අපගේ මෙහෙවර",
    missionText:
      "විශ්වාසදායක බැංකු සේවා, සාධාරණ වෙළෙඳාම සහ ප්‍රජා-කේන්ද්‍රීය සේවා මගින් සාමාජික ආර්ථික වර්ධනය කිරීමේ සමාජ මෙහෙවර ඉටු කරමින් ගුණාත්මක, ඵලදායී හා කාර්යක්ෂම ව්‍යාපාරයක් බවට සමූපකාරය නංවාලීම.",
    bizBadge: "",
    bizTitle: "ව්‍යාපාර හා සේවා අංශ",
    bizSub: "",
    galleryBadge: "",
    galleryTitle: "ඡායාරූප ගැලරිය",
    gallerySub: "",
    newsBadge: "",
    newsTitle: "පුවත් හා නිවේදන",
    newsSub: "",
    contactBadge: "",
    contactTitle: "නිල විමසුම් සහ ඇමතුම්",
    contactSub: "",
    callUs: "දුරකථන",
    visitUs: "ලිපිනය",
    emailUs: "විද්‍යුත් තැපෑල",
    hoursTitle: "වැඩ කරන වේලාවන්",
    inquire: "විමසුමක් යවන්න",
    membershipBadge: "සාමාජිකත්වය",
    membershipTitle: "සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතියේ සාමාජිකයෙකු වන්න",
    membershipText: "අදම සාමාජිකත්වයට බැඳී අපේ සේවා සියල්ලෙන් ප්‍රයෝජන ගන්න — ග්‍රාමීය බැංකු, ණය පහසුකම්, වට්ටම් සහ තවත් බොහෝ දේ.",
    apply: "අයදුම් කරන්න",
    memberList: "සාමාජික ලේඛනය",
  },
  en: {
    heroTag: "Empowering Our Community Through Co-operation",
    heroDesc:
      "Uniting trusted rural banking, consumer essentials, and commercial services to uplift member livelihoods and local enterprise.",
    cta1: "Become a Member",
    cta2: "Explore Businesses",
    estBadge: "Est. 1976 — 50+ Years of Trust",
    reg: "Official Registration",
    boardBadge: "",
    boardTitle: "Board of Directors",
    boardSub: "",
    officersTitle: "Official Members · Administrative Officers",
    all: "View All →",
    statMembers: "Members",
    statVoters: "Eligible Voters",
    statDivisions: "Business Divisions",
    statYears: "Years of Service",
    aboutBadge: "About Us",
    aboutTitle: "Rural banking, consumer goods and trade agencies, under one roof",
    aboutP1:
      "Our co-operative brings the rural bank, consumer goods store, product agencies and a fuel station together for the benefit of the village. Protecting members' savings, supporting local traders and building a stronger community is the whole of our mission.",
    aboutP2:
      "The society was registered on 6 October 1976 under the Department of Co-operatives. Fifty years on, it is still run the same way — by elected members, for members.",
    principles: "Co-operative autonomy · democratic control · member economic participation · concern for community.",
    vision: "Our Vision",
    visionText: "To become the leading trading institution providing high-standard business services within our area.",
    mission: "Our Mission",
    missionText:
      "To develop this co-operative into a quality-driven, productive and efficient business by fulfilling the social commitment of enhancing member economic growth — through reliable banking, fair trade and community-centred service.",
    bizBadge: "",
    bizTitle: "Our Businesses",
    bizSub: "",
    galleryBadge: "",
    galleryTitle: "Photo Gallery",
    gallerySub: "",
    newsBadge: "",
    newsTitle: "News & Announcements",
    newsSub: "",
    contactBadge: "",
    contactTitle: "Get in Touch & Official Inquiries",
    contactSub: "",
    callUs: "Hotline / Phone",
    visitUs: "Head Office / Address",
    emailUs: "Email",
    hoursTitle: "Working Hours",
    inquire: "Send an Inquiry",
    membershipBadge: "Membership",
    membershipTitle: "Become a Member of Panduwasnuwara New MPCS LTD",
    membershipText:
      "Join today and take advantage of all our services — rural banking, loan facilities, member discounts and much more.",
    apply: "Apply Now",
    memberList: "Member Directory",
  },
} as const;

export function HomeSections({
  businesses,
  news,
  board,
  settings,
  gallery,
}: {
  businesses: BusinessUnit[];
  news: NewsItem[];
  board: BoardMember[];
  settings: SiteSettings;
  gallery: GalleryItem[];
}) {
  const { lang, t } = useLang();
  const c = HOME_COPY[lang];
  const L = (p: string) => `/${lang}${p === "/" ? "" : p}`;

  const pinned = news.filter((n) => n.pinned);
  const rest = news.filter((n) => !n.pinned).slice(0, 3);
  const newsList = [...pinned, ...rest].slice(0, 4);

  const [person, setPerson] = useState<BoardMember | null>(null);
  const [gal, setGal] = useState<GalleryItem | null>(null);
  const [galItems, setGalItems] = useState<GalleryItem[]>(gallery);
  const me = useMe();
  const galList = galItems;
  const galIdx = gal ? galList.findIndex((x) => x.id === gal.id) : -1;
  const galCurrent = gal ? galList.find((x) => x.id === gal.id) ?? gal : null;
  const live = useLiveStats({
    members: settings.members_total,
    voters: settings.voters_total,
    divisions: businesses.length,
    years: settings.years_of_service,
  });
  const sortedBoard = board.filter((p) => p.category !== "officer").slice().sort((a, b) => a.order - b.order);
  const officerList = board.filter((p) => p.category === "officer").slice().sort((a, b) => a.order - b.order);

  return (
    <main>
      {/* ================= HERO ================= */}
      <section className="hero-dark relative overflow-hidden text-white flex flex-col min-h-[calc(100vh-72px)]">
        <HeroSlideshow images={settings.hero_images} />
        <div className="hero-overlay" />
        <div className="relative z-30 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-16 sm:pt-24 pb-10 sm:pb-12 flex-1 flex flex-col justify-center items-center text-center">
          {/* ✅ coop pill + Est badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2">
            <SiteLogoBadge size={20} className="!shadow-none ring-1 ring-white/30" />
            <span className="text-[11px] sm:text-[12px] font-bold text-white/90">
              {lang === "si" ? "ශ්‍රී ලංකා සමුපකාර චලනය" : "Sri Lanka Co-operative Movement"}
            </span>
            <span className="rounded-full bg-amber-400 text-slate-900 px-2.5 py-0.5 text-[10px] font-extrabold">Est. 1976</span>
          </div>

          <h1
            className={`mt-7 font-black leading-[1.2] max-w-5xl text-center ${
              lang === "si" ? "text-[26px] sm:text-[40px] lg:text-[46px]" : "text-3xl sm:text-5xl"
            }`}
          >
            {lang === "si" ? "සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය" : "Panduwasnuwara MPCS LTD"}
          </h1>
          {c.heroTag && <div className="mt-3 text-[15px] sm:text-[18px] font-bold text-amber-200">{c.heroTag}</div>}
          {c.heroDesc && <p className="mt-3.5 max-w-2xl text-[12.5px] sm:text-[14.5px] text-white/80 leading-relaxed">{c.heroDesc}</p>}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={L("/businesses")}
              className="btn !bg-indigo-600 hover:!bg-indigo-500 !text-white !border-indigo-500 !px-7 !py-3.5 !text-[14px] !font-extrabold shadow-xl shadow-indigo-900/40"
            >
              {lang === "si" ? "ව්‍යාපාර බලන්න" : "Explore Businesses"} <ArrowRight size={17} />
            </Link>
            <Link
              href={L("/membership/members")}
              className="btn btn-outline !bg-white/10 !text-white !border-white/25 hover:!bg-white/20 !px-7 !py-3.5 !text-[14px] !font-bold"
            >
              {lang === "si" ? "සාමාජිකත්වය" : "Membership"}
            </Link>
          </div>
        </div>

        {/* ✅ hero stats bar — dark glass strip */}
        <div className="relative z-30 px-4 sm:px-6 pb-12 sm:pb-14">
          <div className="max-w-3xl mx-auto rounded-2xl border border-white/15 bg-slate-950/65 backdrop-blur-xl px-4 sm:px-8 py-4">
            <div className="grid grid-cols-3 divide-x divide-white/15">
              <div className="flex items-center justify-center gap-2.5 px-2">
                <Users size={18} className="text-amber-300" />
                <div className="text-left">
                  <div className="text-[13px] sm:text-[15px] font-extrabold text-amber-300 leading-tight">{live.years}+ {lang === "si" ? "වසර" : "Years"}</div>
                  <div className="text-[9px] sm:text-[10px] text-white/65 font-semibold uppercase tracking-wide">{lang === "si" ? "කැපවූ සේවාව" : "Dedicated Service"}</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2.5 px-2">
                <Building2 size={18} className="text-sky-300" />
                <div className="text-left">
                  <div className="text-[13px] sm:text-[15px] font-extrabold text-sky-300 leading-tight">100% {lang === "si" ? "දේශීය" : "Local"}</div>
                  <div className="text-[9px] sm:text-[10px] text-white/65 font-semibold uppercase tracking-wide">{lang === "si" ? "සාමාජික පාලනය" : "Member Owned"}</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2.5 px-2">
                <CheckCircle2 size={18} className="text-emerald-300" />
                <div className="text-left">
                  <div className="text-[13px] sm:text-[15px] font-extrabold text-emerald-300 leading-tight">{SITE.reg_no}</div>
                  <div className="text-[9px] sm:text-[10px] text-white/65 font-semibold uppercase tracking-wide">{lang === "si" ? "නිල ලියාපදිංචිය" : "Official Registration"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BOARD DETAILS — photo එක ඉවර වෙන තැනින් පටන් ගන්නවා (animated gradient) ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-100 via-indigo-50/70 to-slate-50">
        <div className="absolute -top-28 -left-28 w-[420px] h-[420px] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-28 w-[420px] h-[420px] rounded-full bg-fuchsia-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full bg-amber-200/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-14 pb-14 sm:pb-16">
          {/* ✅ Board of Directors heading — hero photo එකට යටින් */}
          <SectionHead
            badge={c.boardBadge}
            title={c.boardTitle}
            sub={c.boardSub}
            right={
              <Link href={L("/board")} className="btn btn-outline">
                {c.all}
              </Link>
            }
          />

          {/* සියලුම සාමාජිකයින් order පිළිවෙලට — පේලියකට 4ක් */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {sortedBoard.map((p) => (
              <BoardGlassCard key={p.id ?? `${p.order}-${p.name_en}`} person={p} onOpen={setPerson} />
            ))}
          </div>

          {/* Official Members — Administrative Officers (නිලධාරීන්) */}
          {officerList.length > 0 && (
            <div className="mt-12">
              {c.officersTitle && (
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-300/70" />
                  <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-center text-indigo-700">
                    {c.officersTitle}
                  </div>
                  <div className="h-px flex-1 bg-slate-300/70" />
                </div>
              )}
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {officerList.map((p) => (
                  <BoardGlassCard key={p.id ?? `${p.order}-${p.name_en}`} person={p} onOpen={setPerson} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {person && <PersonModal person={person} onClose={() => setPerson(null)} />}

      {/* gallery lightbox — photo එක හෝ photo set එක විශාලව + tagline එක්ක */}
      {gal && (
        <div
          className="fixed inset-0 z-[120] bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setGal(null)}
        >
          <div
            className="w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl bg-white/90 backdrop-blur-xl border border-white/50 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={galCurrent?.image} alt={gal.title} className="w-full max-h-[62vh] object-contain" />
              <button
                onClick={() => setGal(null)}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition"
              >
                ✕
              </button>
              {galList.length > 1 && (
                <>
                  <button
                    onClick={() => setGal(galList[(galIdx - 1 + galList.length) % galList.length])}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/25 hover:bg-white/45 text-white flex items-center justify-center text-xl font-black transition"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setGal(galList[(galIdx + 1) % galList.length])}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/25 hover:bg-white/45 text-white flex items-center justify-center text-xl font-black transition"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] uppercase text-indigo-600">
                <Images size={13} /> {lang === "si" ? "ඡායාරූප ගැලරිය" : "Photo Gallery"} · {galIdx + 1}/{galList.length}
              </div>
              <h3 className="mt-1.5 text-xl font-extrabold text-slate-900">{gal.title}</h3>
              {gal.description && <p className="mt-2 text-slate-600 text-[13.5px] leading-relaxed">{gal.description}</p>}
              {galCurrent && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <GallerySocial
                    item={galCurrent}
                    me={me as Me}
                    onLike={(n) => setGalItems((xs) => updateItem(xs, galCurrent.id, { likes: n }))}
                    onComment={(c: GalleryComment) =>
                      setGalItems((xs) => updateItem(xs, galCurrent.id, { comments: [...(xs.find((x) => x.id === galCurrent.id)?.comments ?? []), c] }))
                    }
                  />
                </div>
              )}
              <button onClick={() => setGal(null)} className="btn btn-primary mt-5 w-full">
                {lang === "si" ? "වසන්න" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ABOUT — glass quality + live stats ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="absolute top-10 -right-24 w-[380px] h-[380px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-0 -left-24 w-[380px] h-[380px] rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-2 items-start">
            {/* about glass card — unique gradient glass border */}
            <div className="rounded-3xl p-[2px] bg-gradient-to-br from-indigo-500/70 via-fuchsia-400/70 to-amber-400/70 shadow-[0_24px_60px_-18px_rgba(79,70,229,0.35)]">
            <div className="rounded-[22px] bg-white/70 backdrop-blur-xl p-8 sm:p-10 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-indigo-200/30 blur-3xl" />
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] uppercase text-indigo-700">
                <Landmark size={15} /> {c.aboutBadge}
              </div>
              <h2 className="mt-3 text-2xl sm:text-4xl font-black text-slate-900 leading-snug">{c.aboutTitle}</h2>
              <p className="mt-5 text-slate-600 leading-relaxed text-[15px]">{c.aboutP1}</p>
              <p className="mt-4 text-slate-600 leading-relaxed text-[15px]">{c.aboutP2}</p>
              <div className="mt-6 rounded-2xl bg-gradient-to-r from-indigo-50 to-fuchsia-50 border border-indigo-100 px-4 py-3 relative">
                <div className="text-[12.5px] font-bold text-indigo-700 tracking-wide">{c.principles}</div>
              </div>
            </div>
            </div>

            {/* stats (live refresh) — vision/mission එකට උඩින් */}
            <div className="grid gap-5">
              <div className="grid grid-cols-2 gap-4">
                <GlassStat kind="members" value={live.members} label={c.statMembers} tag="CSV / EXCEL" live resetKey={live.tick} />
                <GlassStat kind="voters" value={live.voters} label={c.statVoters} tag="ELECTORAL" live resetKey={live.tick} />
                <GlassStat kind="divisions" value={live.divisions} label={c.statDivisions} tag="BUSINESS" live resetKey={live.tick} />
                <GlassStat kind="years" value={live.years} suffix="+" label={c.statYears} tag="SINCE 1976" live resetKey={live.tick} />
              </div>

              {/* vision — glass */}
              <div className="rounded-3xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_20px_50px_-18px_rgba(15,23,42,0.22)] p-7 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-amber-200/40 blur-2xl" />
                <div className="relative flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
                    <Eye size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-600">Vision</div>
                    <h3 className="font-extrabold text-slate-900 text-[16px]">{c.vision}</h3>
                  </div>
                </div>
                <p className="mt-3.5 text-slate-600 text-[14.5px] leading-relaxed relative">{c.visionText}</p>
              </div>

              {/* mission — glass */}
              <div className="rounded-3xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_20px_50px_-18px_rgba(15,23,42,0.22)] p-7 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-200/40 blur-2xl" />
                <div className="relative flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Target size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-indigo-600">Mission</div>
                    <h3 className="font-extrabold text-slate-900 text-[16px]">{c.mission}</h3>
                  </div>
                </div>
                <p className="mt-3.5 text-slate-600 text-[14.5px] leading-relaxed relative">{c.missionText}</p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ================= BUSINESSES ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <SectionHead
          badge={c.bizBadge}
          title={c.bizTitle}
          sub={c.bizSub}
        />
        <HomeClientBits businesses={businesses} />
      </section>

      {/* ================= GALLERY ================= */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <SectionHead
            badge={c.galleryBadge}
            title={c.galleryTitle}
            sub={c.gallerySub}
            right={
              <Link href={L("/gallery")} className="btn btn-outline">
                {c.all}
              </Link>
            }
          />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {gallery.slice(0, 4).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGal(g)}
                className="group relative rounded-2xl overflow-hidden card card-hover text-left w-full"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-slate-200 to-slate-100 relative">
                  {g.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.image}
                      alt={g.title || "Gallery"}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3">
                    <div className="flex items-center gap-1.5 text-white text-[11.5px] font-bold">
                      <Images size={12} /> {g.title || "Photo"}
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-white/90 text-slate-900 px-4 py-2 text-[11.5px] font-bold">
                      {lang === "si" ? "🔍 විශාලව බලන්න" : "🔍 View Enlarged"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ================= NEWS ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <SectionHead
          badge={c.newsBadge}
          title={c.newsTitle}
          sub={c.newsSub}
          right={
            <Link href={L("/news")} className="btn btn-outline">
              {c.all}
            </Link>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {newsList.map((n) => (
            <Link key={n.id} href={L("/news")} className="card card-hover overflow-hidden">
              <div className="h-44 bg-gradient-to-br from-indigo-900 to-slate-800 relative overflow-hidden">
                {n.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/30">
                    <Newspaper size={44} />
                  </div>
                )}
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="badge-blue rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                    {n.category === "vacancy" ? "VACANCY" : "NOTICE"}
                  </span>
                  {n.pinned && (
                    <span className="badge-pinned rounded-full px-2.5 py-0.5 text-[10px] font-bold">📌 PINNED</span>
                  )}
                </div>
              </div>
              <div className="p-5">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <CalendarDays size={12} /> {n.date}
                </div>
                <h3 className="mt-2 font-extrabold text-slate-900 leading-snug line-clamp-2">
                  {lang === "si" ? n.title_si : n.title_en || n.title_si}
                </h3>
                <p className="mt-2 text-[12.5px] text-slate-500 leading-relaxed line-clamp-3">
                  {(lang === "si" ? n.desc_si : n.desc_en || n.desc_si).slice(0, 140)}…
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= MEMBERSHIP CTA ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="hero-dark rounded-[28px] p-10 sm:p-16 text-white relative overflow-hidden shadow-[0_32px_80px_-24px_rgba(15,23,42,0.55)]">
          {/* decorative glows */}
          <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute bottom-[-6rem] left-1/3 w-96 h-96 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="absolute top-6 right-8 hidden lg:flex items-center gap-3 opacity-40">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-24 h-24 rounded-3xl border border-white/15 rotate-12" />
            ))}
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-[11px] font-bold tracking-[0.2em] uppercase text-amber-300">
              <BadgeCheck size={15} /> {c.membershipBadge}
            </div>
            <h2 className="mt-5 text-2xl sm:text-[42px] font-black leading-[1.12]">
              {c.membershipTitle}
            </h2>
            <p className="mt-4 text-slate-300 text-[15px] leading-relaxed max-w-xl">{c.membershipText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={L("/membership/apply")} className="btn btn-amber shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-shadow">
                <Send size={16} /> {c.apply}
              </Link>
              <Link
                href={L("/membership/members")}
                className="btn btn-outline !bg-white/10 !text-white !border-white/25 hover:!bg-white/20 backdrop-blur"
              >
                {c.memberList}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5 text-[11px] text-white/55">
              <span className="flex items-center gap-1.5">✓ {lang === "si" ? "නොමිලේ ලියාපදිංචිය" : "Free registration"}</span>
              <span className="flex items-center gap-1.5">✓ {lang === "si" ? "සාමාජික දීමනා" : "Member benefits"}</span>
              <span className="flex items-center gap-1.5">✓ {lang === "si" ? "F28 ප්‍රවේශය" : "F28 access"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <SectionHead
            badge={c.contactBadge}
            title={c.contactTitle}
            sub={c.contactSub}
            right={
              <Link href={L("/contact")} className="btn btn-primary">
                <BoxIcon name="send" size={16} /> {c.inquire}
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* phone — glass */}
            <div className="group rounded-3xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_18px_45px_-16px_rgba(15,23,42,0.2)] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_60px_-16px_rgba(15,23,42,0.3)]">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                  <BoxIcon name="phone" size={19} />
                </div>
                <div className="font-extrabold text-slate-900 text-[14px]">{c.callUs}</div>
              </div>
              <div className="mt-4 space-y-2">
                {SITE.phones.map((p) => (
                  <a
                    key={p}
                    href={`tel:${p.replace(/\s/g, "")}`}
                    className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-[13.5px] font-semibold text-slate-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                  >
                    {p}
                    <span className="text-[10px] font-bold text-indigo-600 opacity-70 group-hover:opacity-100">
                      {lang === "si" ? "අමතන්න →" : "Call →"}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* address — glass */}
            <div className="group rounded-3xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_18px_45px_-16px_rgba(15,23,42,0.2)] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_60px_-16px_rgba(15,23,42,0.3)]">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                  <BoxIcon name="map" size={19} />
                </div>
                <div className="font-extrabold text-slate-900 text-[14px]">{c.visitUs}</div>
              </div>
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-[13px] text-slate-700 leading-relaxed">
                {lang === "si" ? SITE.address_si : SITE.address_en}
              </div>
              <a
                href="https://maps.app.goo.gl/JFbV9o8sknmp1jDy7"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-rose-600 hover:underline"
              >
                📍 {lang === "si" ? "සිතියමේ බලන්න" : "View on Map"} →
              </a>
            </div>

            {/* email — glass */}
            <div className="group rounded-3xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_18px_45px_-16px_rgba(15,23,42,0.2)] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_60px_-16px_rgba(15,23,42,0.3)]">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-sky-200">
                  <BoxIcon name="envelope" size={19} />
                </div>
                <div className="font-extrabold text-slate-900 text-[14px]">{c.emailUs}</div>
              </div>
              <a
                href={`mailto:${SITE.email}`}
                className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-[12px] font-semibold text-slate-700 whitespace-nowrap overflow-hidden hover:bg-sky-100 hover:border-sky-300 transition-colors"
              >
                {SITE.email}
                <span className="text-[10px] font-bold text-sky-600 opacity-70 group-hover:opacity-100 shrink-0 ml-2">
                  {lang === "si" ? "ලියන්න →" : "Write →"}
                </span>
              </a>
            </div>

            {/* hours — glass */}
            <div className="group rounded-3xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_18px_45px_-16px_rgba(15,23,42,0.2)] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_60px_-16px_rgba(15,23,42,0.3)]">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                  <BoxIcon name="clock" size={19} />
                </div>
                <div className="font-extrabold text-slate-900 text-[14px]">{c.hoursTitle}</div>
              </div>
              <div className="mt-4 space-y-1.5">
                {(lang === "si" ? SITE.hours_si : SITE.hours_en).map((h) => (
                  <div key={h} className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-2 text-[11.5px] text-slate-700 leading-relaxed">
                    {h}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


// ============================================================================
//  Glass profile card + popup modal + live-refreshing stats
// ============================================================================

const GLASS = "rounded-3xl bg-white/55 backdrop-blur-xl border border-white/70 shadow-[0_20px_50px_-18px_rgba(15,23,42,0.25)]";

function MiniCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0); // මුල සිට count වෙන්න
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    const from = 0;
    const dur = 900;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <>
      {n.toLocaleString()}
      {suffix}
    </>
  );
}

const GLASS_ICONS = { members: Users, voters: CheckCircle2, divisions: Building2, years: Clock } as const;

function GlassStat({
  kind,
  value,
  suffix = "",
  label,
  tag,
  live,
  resetKey,
}: {
  kind: keyof typeof GLASS_ICONS;
  value: number;
  suffix?: string;
  label: string;
  tag: string;
  live?: boolean;
  resetKey?: number;
}) {
  const Icon = GLASS_ICONS[kind];
  return (
    <div className="rounded-2xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22)] p-5 transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
          <Icon size={19} />
        </div>
        <div className="flex items-center gap-1.5">
          {live && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          <span className="text-[9px] font-bold tracking-[0.16em] text-slate-400 uppercase">{tag}</span>
        </div>
      </div>
      <div className="mt-2.5 text-[28px] font-black text-slate-900 tabular-nums leading-none">
        <MiniCounter key={resetKey} value={value} suffix={suffix} />
      </div>
      <div className="text-slate-500 text-[12.5px] mt-1">{label}</div>
    </div>
  );
}

function useLiveStats(init: { members: number; voters: number; divisions: number; years: number }) {
  const [stats, setStats] = useState(init);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    // ✅ REAL counts — member_rows / voter_rows / business_units ඇත්ත ගණන්
    async function pull() {
      try {
        const sb = createClient();
        const [m, v, b, st] = await Promise.all([
          sb.from("member_rows").select("id", { count: "exact", head: true }),
          sb.from("voter_rows").select("id", { count: "exact", head: true }),
          sb.from("business_units").select("slug,active"),
          sb.from("system_settings").select("key,value").eq("key", "years_of_service"),
        ]);
        if (!alive) return;
        const divisions = (b.data ?? []).filter((r: { active?: unknown }) => r.active === true || r.active === "true").length;
        const y = Number(st.data?.[0]?.value);
        setStats((s) => ({
          members: typeof m.count === "number" ? m.count : s.members,
          voters: typeof v.count === "number" ? v.count : s.voters,
          divisions,
          years: Number.isNaN(y) ? s.years : y,
        }));
        setTick((t) => t + 1); // counter එක ආයේ මුල ඉඳන් count වෙන්න
      } catch {
        /* offline — පෙර අගයම */
      }
    }
    pull();
    const iv = window.setInterval(pull, 3000); // හතරම — තත්පර 3න් 3ට රීෆ්‍රෙශ්
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);
  return { ...stats, tick };
}

function BoardGlassCard({ person, onOpen }: { person: BoardMember; onOpen: (p: BoardMember) => void }) {
  const { lang } = useLang();
  const pill: Record<BoardMember["category"], { label: string; cls: string }> = {
    chairman: { label: lang === "si" ? "සභාපති" : "Chairman", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    "vice-chairman": { label: lang === "si" ? "උප සභාපති" : "Vice Chairman", cls: "bg-sky-100 text-sky-700 border-sky-200" },
    director: { label: lang === "si" ? "අධ්‍යක්ෂ" : "Director", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    officer: { label: lang === "si" ? "නිලධාරී" : "Administrative Officer", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  };
  return (
    <button
      type="button"
      onClick={() => onOpen(person)}
      className={`group text-left ${GLASS} p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/75 hover:shadow-[0_28px_60px_-18px_rgba(15,23,42,0.35)] cursor-pointer`}
    >
      <div className="relative mx-auto w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-white/80 shadow-lg bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
        {person.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photo} alt={person.name_en} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl font-black text-indigo-700">
            {person.name_en.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
        )}
      </div>
      <div className="mt-3 text-center">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9.5px] font-bold border ${pill[person.category].cls}`}>
          {pill[person.category].label}
        </span>
        <div className="font-extrabold text-slate-900 mt-2 leading-snug text-[13.5px]">
          {lang === "si" ? person.name_si || person.name_en : person.name_en}
        </div>
        <div className="text-slate-500 text-[11.5px]">{lang === "si" ? person.position_si : person.position_en}</div>
        <div className="mt-2 text-[10.5px] text-slate-400 truncate">🎓 {person.qualification}</div>
        <div className="mt-2.5 text-[10.5px] font-bold text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity">
          {lang === "si" ? "වැඩි විස්තර බලන්න →" : "View Full Profile →"}
        </div>
      </div>
    </button>
  );
}

function PersonModal({ person, onClose }: { person: BoardMember; onClose: () => void }) {
  const { lang } = useLang();
  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-white/85 backdrop-blur-2xl border border-white/70 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-32 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 hover:bg-white/35 text-white flex items-center justify-center transition"
          >
            <X size={17} />
          </button>
        </div>
        <div className="px-8 pb-8">
          <div className="relative z-10 w-32 h-32 rounded-3xl overflow-hidden ring-4 ring-white shadow-xl -mt-16 bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
            {person.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.photo} alt={person.name_en} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-indigo-700">
                {person.name_en.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </span>
            )}
          </div>
          <h2 className="mt-4 text-2xl font-black text-slate-900 leading-tight">
            {lang === "si" ? person.name_si || person.name_en : person.name_en}
          </h2>
          <div className="text-slate-500 text-[13px] mt-0.5">
            {lang === "si" ? person.name_en : person.name_si} · {lang === "si" ? person.position_si : person.position_en}
          </div>

          <div className="mt-5 space-y-2.5">
            <div className="flex items-center gap-3 rounded-2xl bg-white/70 border border-white/80 px-4 py-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                <GraduationCap size={17} />
              </div>
              <div>
                <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400">
                  {lang === "si" ? "සුදුසුකම්" : "Qualification"}
                </div>
                <div className="text-slate-700 text-[13px] font-semibold">{person.qualification}</div>
              </div>
            </div>
            {person.phone && (
              <a
                href={`tel:${person.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 rounded-2xl bg-white/70 border border-white/80 px-4 py-3 hover:bg-white transition"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Phone size={17} />
                </div>
                <div>
                  <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400">
                    {lang === "si" ? "දුරකථනය" : "Phone"}
                  </div>
                  <div className="text-slate-700 text-[13px] font-semibold">{person.phone}</div>
                </div>
              </a>
            )}
            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="flex items-center gap-3 rounded-2xl bg-white/70 border border-white/80 px-4 py-3 hover:bg-white transition"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                  <Mail size={17} />
                </div>
                <div>
                  <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400">
                    {lang === "si" ? "විද්‍යුත් තැපෑල" : "Email"}
                  </div>
                  <div className="text-slate-700 text-[13px] font-semibold">{person.email}</div>
                </div>
              </a>
            )}
            {person.address && (
              <div className="flex items-center gap-3 rounded-2xl bg-white/70 border border-white/80 px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <MapPin size={17} />
                </div>
                <div>
                  <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400">
                    {lang === "si" ? "ලිපිනය" : "Address"}
                  </div>
                  <div className="text-slate-700 text-[13px] font-semibold">{person.address}</div>
                </div>
              </div>
            )}
          </div>

          <button onClick={onClose} className="btn btn-primary w-full mt-6">
            {lang === "si" ? "වසන්න" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
