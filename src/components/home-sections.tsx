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
  Images,
} from "lucide-react";
import { HeroSlideshow } from "@/components/hero-slideshow";
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

  return (
    <main>
      {/* ================= HERO ================= */}
      <section className="hero-dark relative overflow-hidden text-white">
        <HeroSlideshow images={settings.hero_images} />
        <div className="hero-overlay" />
        <div className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-40 sm:pb-56 min-h-[82vh] flex flex-col justify-center">
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

      {/* ================= BOARD — hero photo එකේ යට කොටස උඩින් floating ================= */}
      <section className="relative z-40 -mt-24 sm:-mt-32 max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 sm:p-10">
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
          {/* සියලුම අධ්‍යක්ෂවරුන් — යටට යන්න ලැයිස්තුවක්, details එක්ක */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {board
              .filter((p) => p.category !== "officer")
              .map((p) => (
                <PersonCard key={`${p.order}-${p.name_en}`} person={p} />
              ))}
          </div>

          {/* Official Members — Administrative Officers (නිලධාරීන්) */}
          {board.some((p) => p.category === "officer") && (
            <div className="mt-10">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-indigo-700 text-center">
                  {c.officersTitle}
                </div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {board
                  .filter((p) => p.category === "officer")
                  .map((p) => (
                    <PersonCard key={`${p.order}-${p.name_en}`} person={p} />
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================= ABOUT ================= */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2 items-start">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] uppercase text-indigo-700">
                <Landmark size={15} /> {c.aboutBadge}
              </div>
              <h2 className="mt-3 text-2xl sm:text-4xl font-black text-slate-900 leading-snug">{c.aboutTitle}</h2>
              <p className="mt-5 text-slate-600 leading-relaxed text-[15px]">{c.aboutP1}</p>
              <p className="mt-4 text-slate-600 leading-relaxed text-[15px]">{c.aboutP2}</p>
              <p className="mt-5 text-[12.5px] font-bold text-indigo-700 tracking-wide">{c.principles}</p>
            </div>
            <div className="grid gap-5">
              {/* stats — vision/mission එකට උඩින් (2ක්) */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard kind="members" value={settings.members_total} label={c.statMembers} tag="CSV / EXCEL" />
                <StatCard kind="voters" value={settings.voters_total} label={c.statVoters} tag="ELECTORAL" />
              </div>
              <div className="card p-7">
                <div className="flex items-center gap-2.5 text-indigo-700">
                  <Eye size={18} /> <h3 className="font-extrabold text-slate-900">{c.vision}</h3>
                </div>
                <p className="mt-3 text-slate-600 text-[14.5px] leading-relaxed">{c.visionText}</p>
              </div>
              <div className="card p-7">
                <div className="flex items-center gap-2.5 text-indigo-700">
                  <Target size={18} /> <h3 className="font-extrabold text-slate-900">{c.mission}</h3>
                </div>
                <p className="mt-3 text-slate-600 text-[14.5px] leading-relaxed">{c.missionText}</p>
              </div>
              {/* stats — යටින් (2ක්) */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard kind="divisions" value={businesses.length} label={c.statDivisions} tag="BUSINESS" />
                <StatCard kind="years" value={settings.years_of_service} suffix="+" label={c.statYears} tag="SINCE 1976" />
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
