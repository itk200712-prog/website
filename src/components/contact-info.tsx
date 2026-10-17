"use client";

// HQ contact info card

import { Building2, ExternalLink } from "lucide-react";
import { BoxIcon } from "@/components/box-icon";
import { useLang } from "@/lib/i18n";
import { SITE } from "@/lib/seed";

export function ContactInfoCard() {
  const { t, lang } = useLang();
  return (
    <div className="card p-7">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
          <Building2 size={22} />
        </div>
        <div>
          <div className="font-extrabold text-slate-900">{t.contactPage.hq}</div>
          <div className="text-slate-500 text-[12px]">{lang === "si" ? SITE.name_si : SITE.name_en}</div>
        </div>
      </div>

      <div className="border-t border-slate-100 my-5" />

      <ul className="space-y-5">
        <li className="flex gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <BoxIcon name="map" size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Head Office / Address</div>
            <a
              href="https://maps.app.goo.gl/JFbV9o8sknmp1jDy7"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-slate-800 text-[13.5px] mt-0.5 flex items-center gap-2 hover:text-indigo-700 transition-colors"
            >
              {lang === "si" ? SITE.address_si : SITE.address_en}
              <ExternalLink size={13} className="text-indigo-700" />
            </a>
            <div className="text-slate-500 text-[12px]">{lang === "si" ? SITE.address_en : SITE.address_si}</div>
          </div>
        </li>
        <li className="flex gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <BoxIcon name="phone" size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Hotline / Phone</div>
            <div className="font-bold text-slate-900 text-[15px] tabular-nums mt-0.5">
              <a href={`tel:${SITE.phones[0].replace(/\s/g, "")}`} className="hover:text-indigo-700 transition-colors">{SITE.phones[0]}</a>
              <span className="text-slate-300"> | </span>
              <a href={`tel:${SITE.phones[1].replace(/\s/g, "")}`} className="hover:text-indigo-700 transition-colors">{SITE.phones[1]}</a>
            </div>
          </div>
        </li>
        <li className="flex gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <BoxIcon name="envelope" size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Email</div>
            <a href={`mailto:${SITE.email}`} className="font-semibold text-slate-800 text-[13.5px] mt-0.5 inline-block hover:text-indigo-700 transition-colors">{SITE.email}</a>
          </div>
        </li>
        <li className="flex gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <BoxIcon name="clock" size={18} />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-[14px]">Mon – Fri : 8.30 AM – 5.30 PM</div>
            <div className="text-slate-600 text-[12.5px]">Saturday : 8.30 AM – 1.30 PM</div>
            <div className="text-slate-400 text-[11.5px]">Closed on Sundays &amp; Public Holidays</div>
          </div>
        </li>
      </ul>
    </div>
  );
}
