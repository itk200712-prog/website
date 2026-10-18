"use client";

// ============================================================================
// Site footer — quick links + contact info + credit
// ============================================================================

import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteLogoBadge } from "@/components/site-logo";
import { MapPin, Phone, Mail, Clock, Facebook, MessageCircle, ExternalLink, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { SITE } from "@/lib/seed";


// provided brand icons
function FacebookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M16,2c-7.732,0-14,6.268-14,14,0,6.566,4.52,12.075,10.618,13.588v-9.31h-2.887v-4.278h2.887v-1.843c0-4.765,2.156-6.974,6.835-6.974,.887,0,2.417,.174,3.043,.348v3.878c-.33-.035-.904-.052-1.617-.052-2.296,0-3.183,.87-3.183,3.13v1.513h4.573l-.786,4.278h-3.787v9.619c6.932-.837,12.304-6.74,12.304-13.897,0-7.732-6.268-14-14-14Z"></path>
    </svg>
  );
}
function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M25.873,6.069c-2.619-2.623-6.103-4.067-9.814-4.069C8.411,2,2.186,8.224,2.184,15.874c-.001,2.446,.638,4.833,1.852,6.936l-1.969,7.19,7.355-1.929c2.026,1.106,4.308,1.688,6.63,1.689h.006c7.647,0,13.872-6.224,13.874-13.874,.001-3.708-1.44-7.193-4.06-9.815h0Zm-9.814,21.347h-.005c-2.069,0-4.099-.557-5.87-1.607l-.421-.25-4.365,1.145,1.165-4.256-.274-.436c-1.154-1.836-1.764-3.958-1.763-6.137,.003-6.358,5.176-11.531,11.537-11.531,3.08,.001,5.975,1.202,8.153,3.382,2.177,2.179,3.376,5.077,3.374,8.158-.003,6.359-5.176,11.532-11.532,11.532h0Zm6.325-8.636c-.347-.174-2.051-1.012-2.369-1.128-.318-.116-.549-.174-.78,.174-.231,.347-.895,1.128-1.098,1.359-.202,.232-.405,.26-.751,.086-.347-.174-1.464-.54-2.788-1.72-1.03-.919-1.726-2.054-1.929-2.402-.202-.347-.021-.535,.152-.707,.156-.156,.347-.405,.52-.607,.174-.202,.231-.347,.347-.578,.116-.232,.058-.434-.029-.607-.087-.174-.78-1.88-1.069-2.574-.281-.676-.567-.584-.78-.595-.202-.01-.433-.012-.665-.012s-.607,.086-.925,.434c-.318,.347-1.213,1.186-1.213,2.892s1.242,3.355,1.416,3.587c.174,.232,2.445,3.733,5.922,5.235,.827,.357,1.473,.571,1.977,.73,.83,.264,1.586,.227,2.183,.138,.666-.1,2.051-.839,2.34-1.649,.289-.81,.289-1.504,.202-1.649s-.318-.232-.665-.405h0Z" fillRule="evenodd"></path>
    </svg>
  );
}

export function SiteFooter() {
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data } = await createClient().from("system_settings").select("key,value");
        if (!alive || !data) return;
        const map = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]));
        setSocialLinks({ wa: map.get("social_whatsapp") || "", fb: map.get("social_facebook") || "" });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const [socialLinks, setSocialLinks] = useState<{ wa: string; fb: string } | null>(null);
  const [showDesigner, setShowDesigner] = useState(false);
  const { t, lang } = useLang();
  const L = (p: string) => `/${lang}${p === "/" ? "" : p}`;

  // උඩ තියෙන සමාජ icons දෙක (Image‑1) = Admin → Settings එකේ Social links විතරයි.
  // Designer popup එක මේවා පාවිච්චි කරන්නේ නෑ — ඒකට SITE.designer links වෙනමයි.
  const footerFbHref = socialLinks?.fb || "#";
  const footerWaHref =
    socialLinks?.wa || `https://wa.me/94${SITE.phones[1].replace(/\D/g, "").replace(/^0/, "")}`;

  const quick = [
    ["/", "Home", "මුල් පිටුව"],
    ["/businesses/rural-bank", "Rural Banking", "ග්‍රාමීය බැංකු"],
    ["/membership/members", "Member Details", "සාමාජික විස්තර"],
    ["/membership/voters", "Eligible Voters", "ඡන්දදායකයින්"],
    ["/membership/apply", "Apply for Membership", "සාමාජිකත්වය අයදුම්"],
    ["/board", "Board of Directors", "අධ්‍යක්ෂ මණ්ඩලය"],
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
              <SiteLogoBadge size={44} />
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
              <a
                href={footerFbHref}
                target={footerFbHref === "#" ? undefined : "_blank"}
                rel={footerFbHref === "#" ? undefined : "noreferrer"}
                title="Facebook" aria-label="Facebook"
                className="w-10 h-10 rounded-full border border-white/15 bg-white/5 text-white flex items-center justify-center hover:bg-white/20 transition"
              >
                <Facebook size={17} />
              </a>
              <a
                href={footerWaHref}
                target="_blank"
                rel="noreferrer"
                title="WhatsApp" aria-label="WhatsApp"
                className="w-10 h-10 rounded-full border border-white/15 bg-white/5 text-white flex items-center justify-center hover:bg-white/20 transition"
              >
                <MessageCircle size={17} />
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
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(SITE.address_en)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-200 hover:text-white hover:underline"
                  >
                    {lang === "si" ? SITE.address_si : SITE.address_en}
                  </a>
                  <div className="text-slate-500 text-xs">{lang === "si" ? SITE.address_en : SITE.address_si}</div>
                </div>
              </li>
              <li className="flex gap-3">
                <Phone size={17} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">{t.labels.hotline} / Phone</div>
                  <div className="text-slate-200 font-semibold">
                    <a href={`tel:${SITE.phones[0].replace(/\s/g, "")}`} className="hover:text-white hover:underline">{SITE.phones[0]}</a>
                    <span className="text-slate-600"> | </span>
                    <a href={`tel:${SITE.phones[1].replace(/\s/g, "")}`} className="hover:text-white hover:underline">{SITE.phones[1]}</a>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <Mail size={17} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">Email</div>
                  <a href={`mailto:${SITE.email}`} className="text-slate-200 font-semibold hover:text-white hover:underline">{SITE.email}</a>
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDesigner((v) => !v)}
                className="hover:text-white"
              >
                Designed By <span className="text-white font-semibold underline decoration-dotted underline-offset-4">Induwara Thathsara</span>
              </button>
              {showDesigner && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex items-center gap-2.5 rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 shadow-2xl whitespace-nowrap pop-in">
                  <a
                    href={SITE.designer.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    title="WhatsApp"
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center hover:scale-110 hover:shadow-lg hover:shadow-emerald-500/40 transition-all border border-white/20"
                  >
                    <WhatsAppIcon size={19} />
                  </a>
                  <a
                    href={SITE.designer.facebook}
                    target="_blank"
                    rel="noreferrer"
                    title="Facebook"
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center hover:scale-110 hover:shadow-lg hover:shadow-blue-500/40 transition-all border border-white/20"
                  >
                    <FacebookIcon size={19} />
                  </a>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link href={L("/privacy")} className="hover:text-white">Privacy Policy</Link>
              <span className="text-slate-700">|</span>
              <Link href={L("/terms")} className="hover:text-white">Terms of Service</Link>
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
