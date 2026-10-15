// Privacy Policy — professional content (si/en)

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { headers } from "next/headers";
import Link from "next/link";

export const metadata = { title: "Terms of Service | Panduwasnuwara New MPCS" };

const CONTENT = {
  en: {
    badge: "Legal",
    title: "Privacy Policy",
    sub: "How we collect, use, and protect your personal information",
    body: [
      ["1. Acceptance of Terms", "By accessing or using the website of the Panduwasnuwara New Multi Purpose Co-Operative Society LTD, you agree to be bound by these terms and conditions. If you do not agree, please do not use the site."],
      ["2. Use of the Website", "The content of this website is provided for general information about our co-operative, its services, and official notices. You may not misuse, copy, or distribute content for commercial purposes without written permission from the Society."],
      ["3. Member Portal & Accounts", "Members are responsible for keeping their login credentials confidential. Activities performed through your account are your responsibility. Notify the Secretariat immediately if you suspect unauthorized use."],
      ["4. Services & Availability", "We strive to keep information accurate and services available; however, the Society does not guarantee uninterrupted access and may modify, suspend, or discontinue any part of the website or services at any time."],
      ["5. Limitation of Liability", "The Society shall not be liable for any direct or indirect loss arising from the use of this website or reliance on its content, to the maximum extent permitted by law."],
      ["6. Changes to These Terms", "We may revise these terms from time to time. Continued use of the website after changes constitutes acceptance of the revised terms. Governing law: Sri Lanka."],
    ],

  },
  si: {
    badge: "නීතිමය",
    title: "පෞද්ගලිකත්ව ප්‍රතිපත්තිය",
    sub: "ඔබේ පෞද්ගලික තොරතුරු එකතු කිරීම, භාවිතය සහ ආරක්ෂා කිරීම",
    body: [
      ["1. කොන්දේසි පිළිගැනීම", "සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතියේ වෙබ් අඩවිය ප්‍රවේශ වීම හෝ භාවිතා කිරීම මගින් ඔබ මෙම කොන්දේසි වලට බැඳීමට එකඟ වේ. එකඟ නොවන්නේ නම් කරුණාකර අඩවිය භාවිතා නොකරන්න."],
      ["2. වෙබ් අඩවිය භාවිතය", "මෙම වෙබ් අඩවියේ අන්තර්ගතය අපගේ සමූපකාරය, එහි සේවා සහ නිල නිවේදන පිළිබඳ සාමාන්‍ය තොරතුරු සඳහා සපයනු ලැබේ. සමිතියේ ලිඛිත අවසරයකින් තොරව වාණිජ අරමුණු සඳහා අන්තර්ගතය අනිසි ලෙස භාවිතා කිරීම, පිටපත් කිරීම හෝ බෙදා හැරීම කළ නොහැක."],
      ["3. සාමාජික ද්වාරය සහ ගිණුම්", "ඔබේ පිවිසුම් තොරතුරු රහසිගතව තබා ගැනීමේ වගකීම සාමාජිකයින් සතුය. ඔබේ ගිණුම හරහා සිදු කරන ක්‍රියාකාරකම් සඳහා ඔබ වගකීමෙන් යුක්ත වේ. අනවසර භාවිතයක් සැක කරන්නේ නම් වහාම ලේකම් කාර්යාලය දැනුවත් කරන්න."],
      ["4. සේවා සහ ප්‍රවේශ්‍යතාවය", "තොරතුරු නිවැරදිව තබා ගැනීමට සහ සේවා ලබා ගත හැකිව තැබීමට අපි උත්සාහ කරමු; නමුත් අඛණ්ඩ ප්‍රවේශය සහතික නොකරන අතර, ඕනෑම අවස්ථාවක වෙබ් අඩවියේ හෝ සේවාවල කොටසක් වෙනස් කිරීම, අත්හිටුවීම හෝ නතර කිරීම සමිතියට හැක."],
      ["5. වගකීම් සීමා", "නීතිය ඉඩ දෙන උපරිම ප්‍රමාණයට, මෙම වෙබ් අඩවිය භාවිතයෙන් හෝ එහි අන්තර්ගතය මත විශ්වාසය තැබීමෙන් ඇති වන කෙලින්ම හෝ වක්‍රව සිදුවන අලාභයකට සමිතිය වගකිව යුතු නොවේ."],
      ["6. කොන්දේසි වෙනස් කිරීම", "අවශ්‍ය විට අපි මෙම කොන්දේසි සංශෝධනය කළ හැක. වෙනස්කම් වලින් පසු වෙබ් අඩවිය දිගටම භාවිතා කිරීම සංශෝධිත කොන්දේසි පිළිගැනීමක් ලෙස සැලකේ. පාලන නීතිය: ශ්‍රී ලංකාව."],
    ],

  },
};

export default async function TermsPage() {
  const h = await headers();
  const lang = h.get("x-locale") === "en" ? "en" : "si";
  const c = CONTENT[lang];
  return (
    <>
      <SiteHeader />
      <section className="hero-dark text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
          <div className="section-badge !text-amber-300">{c.badge}</div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black">{c.title}</h1>
          <p className="mt-3 text-slate-300">{c.sub}</p>
        </div>
      </section>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="card p-8 sm:p-10 space-y-7">
          {c.body.map(([h2, p]) => (
            <div key={h2}>
              <h2 className="font-extrabold text-slate-900 text-[17px]">{h2}</h2>
              <p className="mt-2 text-slate-600 leading-relaxed text-[14.5px]">{p}</p>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-6">
            <Link href={`/${lang}`} className="btn btn-primary">← {lang === "si" ? "මුල් පිටුවට" : "Back to Home"}</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
