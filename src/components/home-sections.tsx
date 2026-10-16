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
import { useEffect, useState } from "react";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { createClient } from "@/lib/supabase/client";
import { SectionHead, StatCard, PersonCard } from "@/components/site-sections";
import { HomeClientBits } from "@/components/home-client";
import { useLang } from "@/lib/i18n";
import { SITE } from "@/lib/seed";
import type { BusinessUnit, NewsItem, BoardMember, SiteSettings, GalleryItem } from "@/lib/types";

const HOME_COPY = {
  si: {
    heroTag: "සමූපකාර ශක්තියෙන් ප්‍රජාව සවිබල ගන්වමින්",
    heroDesc:
      "සාමාජික ජනතාවට විශ්වාසනීය ග්‍රාමීය බැංකු, පාරිභෝගික සහ අත්‍යවශ්‍ය සේවාවන් එකම වහලක් යටින් සපයයි.",
    cta1: "සාමාජිකත්වයට අයදුම් කරන්න",
    cta2: "ව්‍යාපාර හා සේවා",
    estBadge: "ස්ථාපිත 1976 — විශ්වාසනීය සේවය",
    reg: "ලියාපදිංචි අංකය",
    boardBadge: "පාලනය සහ නායකත්වය",
    boardTitle: "අධ්‍යක්ෂ මණ්ඩලය",
    boardSub: "සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතියේ උපායමාර්ගික පාලනය සහ පරිපාලන නායකත්වය.",
    officersTitle: "නිල සාමාජිකයින් · පරිපාලන නිලධාරීන්",
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
    bizBadge: "අපගේ ව්‍යාපාර අංශ",
    bizTitle: "ව්‍යාපාර හා සේවා අංශ",
    bizSub: "සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය මගින් පවත්වාගෙන යනු ලබන ප්‍රධාන ව්‍යාපාරික හා ප්‍රජා සේවා අංශ.",
    galleryBadge: "මතකයන් සහ ප්‍රජාව",
    galleryTitle: "ඡායාරූප ගැලරිය",
    gallerySub: "අපගේ ශාඛා, ප්‍රජා සේවා සහ සාමාජික මෙහෙවරවල මතක මොහොත්.",
    newsBadge: "නිල නිවේදන සහ යාවත්කාලීන",
    newsTitle: "පුවත් හා නිවේදන",
    newsSub: "සමිතියේ නවතම රැකියා අවස්ථා, සාමාජික නිවේදන සහ නිල ප්‍රකාශන.",
    contactBadge: "අප අමතන්න",
    contactTitle: "නිල විමසුම් සහ ඇමතුම්",
    contactSub: "අපගේ ප්‍රධාන කාර්යාල කළමනාකරණය අමතන්න හෝ ඔබේ විමසුම් සෘජුව යවන්න.",
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
    boardBadge: "Governance & Leadership",
    boardTitle: "Board of Directors",
    boardSub:
      "Strategic governance and administrative leadership of the Panduwasnuwara New Multi Purpose Co-Operative Society.",
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
    bizBadge: "Our Businesses & Services",
    bizTitle: "Our Businesses",
    bizSub:
      "Key business and community service divisions operated by the Panduwasnuwara New Multi Purpose Co-Operative Society.",
    galleryBadge: "Moments & Community",
    galleryTitle: "Photo Gallery",
    gallerySub: "Capturing our branches, community services, and cooperative member milestones.",
    newsBadge: "Official Notices & Updates",
    newsTitle: "News & Announcements",
    newsSub: "Stay informed with the latest cooperative recruitment calls, member notices, and official announcements.",
    contactBadge: "Contact Us",
    contactTitle: "Get in Touch & Official Inquiries",
    contactSub: "Reach out to our headquarters management or submit your inquiries, requests, and feedback directly.",
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
  const newsList = [...pinned, ...rest].slice(0, 3);

  const [person, setPerson] = useState<BoardMember | null>(null);
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
      <section className="hero-dark relative overflow-hidden text-white">
        <HeroSlideshow images={settings.hero_images} />
        <div className="hero-overlay" />
        <div className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 min-h-[80vh] flex flex-col justify-center">
          <h1 className="text-3xl sm:text-5xl font-black leading-[1.15] max-w-4xl">{t.brandFull}</h1>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={L("/membership/apply")} className="btn btn-amber">
              {c.cta1} <ArrowRight size={17} />
            </Link>
            <Link
              href={L("/businesses")}
              className="btn btn-outline !bg-white/10 !text-white !border-white/25 hover:!bg-white/20"
            >
              {c.cta2}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 text-[12px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2">
              <ShieldCheck size={14} className="text-emerald-300" /> {c.reg}: {SITE.reg_no}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2">
              <CalendarDays size={14} className="text-amber-300" /> {SITE.est}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2">
              <Phone size={14} className="text-sky-300" /> {SITE.phones[0]} | {SITE.phones[1]}
            </span>
          </div>
        </div>
      </section>

      {/* ================= BOARD — background සීමාවට යටින්, glass profile cards ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-100 via-indigo-50/70 to-slate-50">
        <div className="absolute -top-28 -left-28 w-[420px] h-[420px] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-28 w-[420px] h-[420px] rounded-full bg-fuchsia-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full bg-amber-200/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
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
              <BoardGlassCard key={`${p.order}-${p.name_en}`} person={p} onOpen={setPerson} />
            ))}
          </div>

          {/* Official Members — Administrative Officers (නිලධාරීන්) */}
          {officerList.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-300/70" />
                <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-indigo-700 text-center">
                  {c.officersTitle}
                </div>
                <div className="h-px flex-1 bg-slate-300/70" />
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {officerList.map((p) => (
                  <BoardGlassCard key={`${p.order}-${p.name_en}`} person={p} onOpen={setPerson} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {person && <PersonModal person={person} onClose={() => setPerson(null)} />}

      {/* ================= ABOUT — glass quality + live stats ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="absolute top-10 -right-24 w-[380px] h-[380px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-0 -left-24 w-[380px] h-[380px] rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-2 items-start">
            {/* about glass card */}
            <div className="rounded-3xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_20px_50px_-18px_rgba(15,23,42,0.22)] p-8 sm:p-10">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] uppercase text-indigo-700">
                <Landmark size={15} /> {c.aboutBadge}
              </div>
              <h2 className="mt-3 text-2xl sm:text-4xl font-black text-slate-900 leading-snug">{c.aboutTitle}</h2>
              <p className="mt-5 text-slate-600 leading-relaxed text-[15px]">{c.aboutP1}</p>
              <p className="mt-4 text-slate-600 leading-relaxed text-[15px]">{c.aboutP2}</p>
              <div className="mt-6 rounded-2xl bg-gradient-to-r from-indigo-50 to-fuchsia-50 border border-indigo-100 px-4 py-3">
                <div className="text-[12.5px] font-bold text-indigo-700 tracking-wide">{c.principles}</div>
              </div>
            </div>

            {/* stats (live refresh) — vision/mission එකට උඩින් */}
            <div className="grid gap-5">
              <div className="grid grid-cols-2 gap-4">
                <GlassStat kind="members" value={live.members} label={c.statMembers} tag="CSV / EXCEL" live />
                <GlassStat kind="voters" value={live.voters} label={c.statVoters} tag="ELECTORAL" live />
                <GlassStat kind="divisions" value={live.divisions} label={c.statDivisions} tag="BUSINESS" live />
                <GlassStat kind="years" value={live.years} suffix="+" label={c.statYears} tag="SINCE 1976" live />
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

              <div className="flex">
                <Link href={L("/businesses")} className="btn btn-primary">{c.all}</Link>
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
          right={
            <Link href={L("/businesses")} className="btn btn-outline">
              {c.all}
            </Link>
          }
        />
        <HomeClientBits businesses={businesses.slice(0, 8)} />
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
              <Link key={g.id} href={L("/gallery")} className="group relative rounded-2xl overflow-hidden card card-hover">
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
                </div>
              </Link>
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
        <div className="grid gap-5 md:grid-cols-3">
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
        <div className="hero-dark rounded-3xl p-10 sm:p-14 text-white relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase text-amber-300">
              <BadgeCheck size={16} /> {c.membershipBadge}
            </div>
            <h2 className="mt-3 text-2xl sm:text-4xl font-black leading-snug">{c.membershipTitle}</h2>
            <p className="mt-3 text-slate-300">{c.membershipText}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={L("/membership/apply")} className="btn btn-amber">
                <Send size={16} /> {c.apply}
              </Link>
              <Link
                href={L("/membership/members")}
                className="btn btn-outline !bg-white/10 !text-white !border-white/25 hover:!bg-white/20"
              >
                {c.memberList}
              </Link>
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
                <Send size={15} /> {c.inquire}
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-6">
              <div className="flex items-center gap-2 text-indigo-700">
                <Phone size={17} /> <div className="font-extrabold text-slate-900 text-[14px]">{c.callUs}</div>
              </div>
              <div className="mt-3 space-y-1 text-[13.5px] text-slate-600">
                {SITE.phones.map((p) => (
                  <a key={p} href={`tel:${p.replace(/\s/g, "")}`} className="block hover:text-indigo-700">
                    {p}
                  </a>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-2 text-indigo-700">
                <MapPin size={17} /> <div className="font-extrabold text-slate-900 text-[14px]">{c.visitUs}</div>
              </div>
              <div className="mt-3 text-[13.5px] text-slate-600">
                {lang === "si" ? SITE.address_si : SITE.address_en}
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-2 text-indigo-700">
                <Mail size={17} /> <div className="font-extrabold text-slate-900 text-[14px]">{c.emailUs}</div>
              </div>
              <a href={`mailto:${SITE.email}`} className="mt-3 block text-[13.5px] text-slate-600 hover:text-indigo-700">
                {SITE.email}
              </a>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-2 text-indigo-700">
                <Clock size={17} /> <div className="font-extrabold text-slate-900 text-[14px]">{c.hoursTitle}</div>
              </div>
              <div className="mt-3 space-y-1 text-[12.5px] text-slate-600">
                {(lang === "si" ? SITE.hours_si : SITE.hours_en).map((h) => (
                  <div key={h}>{h}</div>
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
  const [n, setN] = useState(value);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    const from = n;
    const dur = 800;
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
}: {
  kind: keyof typeof GLASS_ICONS;
  value: number;
  suffix?: string;
  label: string;
  tag: string;
  live?: boolean;
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
        <MiniCounter value={value} suffix={suffix} />
      </div>
      <div className="text-slate-500 text-[12.5px] mt-1">{label}</div>
    </div>
  );
}

function useLiveStats(init: { members: number; voters: number; divisions: number; years: number }) {
  const [stats, setStats] = useState(init);
  useEffect(() => {
    let alive = true;
    async function pullSettings(onlyMembers: boolean) {
      try {
        const sb = createClient();
        const { data } = await sb.from("system_settings").select("key,value");
        if (!alive || !data) return;
        const map = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]));
        setStats((s) => {
          const next = { ...s };
          if (map.has("members_total")) {
            const m = Number(map.get("members_total"));
            if (!Number.isNaN(m)) next.members = m;
          }
          if (!onlyMembers) {
            if (map.has("voters_total")) {
              const v = Number(map.get("voters_total"));
              if (!Number.isNaN(v)) next.voters = v;
            }
            if (map.has("years_of_service")) {
              const y = Number(map.get("years_of_service"));
              if (!Number.isNaN(y)) next.years = y;
            }
          }
          return next;
        });
      } catch {
        /* offline — පෙර අගයම තියෙනවා */
      }
    }
    async function pullBiz() {
      try {
        const sb = createClient();
        const { data } = await sb.from("business_units").select("id,active");
        if (!alive || !data) return;
        const count = data.filter((r: { active?: unknown }) => r.active !== false && r.active !== "false").length;
        setStats((s) => ({ ...s, divisions: count }));
      } catch {
        /* offline */
      }
    }
    pullSettings(true);
    pullBiz();
    const t2 = window.setInterval(() => pullSettings(true), 2000); // members — තත්පර 2න් 2ට
    const t3 = window.setInterval(() => {
      pullSettings(false);
      pullBiz();
    }, 3000); // voters / divisions / years — තත්පර 3න් 3ට
    return () => {
      alive = false;
      clearInterval(t2);
      clearInterval(t3);
    };
  }, []);
  return stats;
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
      className={`group text-left ${GLASS} p-5 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/75 hover:shadow-[0_28px_60px_-18px_rgba(15,23,42,0.35)] cursor-pointer`}
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
          <div className="w-28 h-28 rounded-3xl overflow-hidden ring-4 ring-white shadow-xl -mt-14 bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
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
