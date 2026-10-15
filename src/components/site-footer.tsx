"use client";

// ============================================================================
// Site footer — quick links + contact info + credit
// ============================================================================

import Link from "next/link";
import { MapPin, Phone, Mail, Clock, Facebook, MessageCircle, ExternalLink, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { SITE } from "@/lib/seed";

export function SiteFooter() {
  const { t, lang } = useLang();
  const L = (p: string) => `/${lang}${p === "/" ? "" : p}`;

  const quick = [
    ["/", "Home", "මුල් පිටුව"],
    ["/businesses/rural-bank", "Rural Banking", "ග්‍රාමීය බැංකු"],
    ["/membership/members", "Member Details", "සාමාජික විස්තර"],
    ["/membership/voters", "Eligible Voters", "ඡන්දදායකයින්"],
    ["/membership/apply", "Apply for Membership", "සාමාජිකත්වය අයදුම්"],
    ["/gallery", "Photo Gallery", "ඡායාරූප"],
    ["/news", "News & Notices", "පුවත් හා නිවේදන"],
    ["/contact", "Contact Us", "සම්බන්ධ වන්න"],
    ["/admin", "Admin Portal", "පරිපාලක ද්වාරය"],
  ];

  return (
    <footer className="mt-16">
      <div className="footer-strip" />
      <div className="bg-[#0b0f2c] text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-3">
          {/* identity */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white flex items-center justify-center text-[10px] font-black">
                coop
              </div>
              <div>
                <div className="text-white font-bold leading-tight text-[15px]">
                  {lang === "si" ? SITE.name_si : SITE.name_en}
                </div>
                <div className="text-[11px] text-slate-400">
                  {lang === "si" ? SITE.name_en : SITE.name_si}
                </div>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-400">
              {lang === "si"
                ? "ග්‍රාමීය බැංකු, පාරිභෝගික භාණ්ඩ, නිෂ්පාදන නියෝජිතායතන සහ ඉන්ධන සැපයුම එක් වහලක් යටතේ සපයන විශ්වාසනීය සමූපකාර ආයතනයකි."
                : "Trusted co-operative institution providing rural banking, consumer goods, product agencies and fuel supply under one roof for members."}
            </p>
            <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-slate-700 px-4 py-2 text-xs">
              <ShieldCheck size={15} className="text-emerald-400" />
              <span>Reg: {SITE.reg_no}</span>
              <span className="text-slate-600">|</span>
              <span>Est: {SITE.est}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <a href="#" className="w-9 h-9 rounded-full border border-slate-700 flex items-center justify-center hover:bg-white/10">
                <Facebook size={16} />
              </a>
              <a
                href={`https://wa.me/${SITE.phones[1].replace(/\s/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full border border-slate-700 flex items-center justify-center hover:bg-white/10"
              >
                <MessageCircle size={16} />
              </a>
            </div>
          </div>

          {/* quick links */}
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> {t.labels.quickLinks.toUpperCase()}
            </div>
            <ul className="space-y-2.5 text-[13px]">
              {quick.map(([href, en, si]) => (
                <li key={href}>
                  <Link href={L(href)} className="hover:text-white flex items-center gap-2">
                    <span className="text-slate-600">›</span> {lang === "si" ? si : en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* contact */}
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> {t.labels.contactInfo.toUpperCase()}
            </div>
            <ul className="space-y-4 text-[13px]">
              <li className="flex gap-3">
                <MapPin size={17} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-200">{lang === "si" ? SITE.address_si : SITE.address_en}</div>
                  <div className="text-slate-500 text-xs">{lang === "si" ? SITE.address_en : SITE.address_si}</div>
                </div>
              </li>
              <li className="flex gap-3">
                <Phone size={17} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">{t.labels.hotline} / Phone</div>
                  <div className="text-slate-200 font-semibold">
                    {SITE.phones[0]} <span className="text-slate-600">|</span> {SITE.phones[1]}
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <Mail size={17} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">Email</div>
                  <div className="text-slate-200 font-semibold">{SITE.email}</div>
                </div>
              </li>
              <li className="flex gap-3">
                <Clock size={17} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">{t.labels.hours}</div>
                  {(lang === "si" ? SITE.hours_si : SITE.hours_en).map((h) => (
                    <div key={h} className="text-slate-300">{h}</div>
                  ))}
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>© 2026 {lang === "si" ? SITE.short_si : SITE.short_en} — All Rights Reserved.</div>
            <div>
              Designed By <span className="text-white font-semibold">Induwara Thathsara</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <span className="text-slate-700">|</span>
              <a href="#" className="hover:text-white">Terms of Service</a>
              <span className="text-slate-700">|</span>
              <Link href={L("/admin")} className="hover:text-white flex items-center gap-1">
                <ShieldCheck size={13} /> Admin Portal <ExternalLink size={11} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
