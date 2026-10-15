// Privacy Policy — professional content (si/en)

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { headers } from "next/headers";
import Link from "next/link";

export const metadata = { title: "Privacy Policy | Panduwasnuwara New MPCS" };

const CONTENT = {
  en: {
    badge: "Legal",
    title: "Privacy Policy",
    sub: "How we collect, use, and protect your personal information",
    body: [
      ["1. Information We Collect", "When you contact us, apply for membership, or use our services, we may collect your name, NIC number, phone number, email address, postal address, and details related to your membership or inquiries."],
      ["2. How We Use Your Information", "We use your information to process membership applications, respond to official inquiries, provide co-operative services (banking, consumer goods, fuel, and other divisions), maintain member records as required by law, and improve our services."],
      ["3. Data Protection", "Member and visitor data is stored securely in our protected systems. Access is restricted to authorized officials of the Society only. We do not sell, rent, or share your personal information with third parties for marketing purposes."],
      ["4. Cookies", "Our website uses essential cookies to remember your language preference (Sinhala / English) and to keep you signed in to the member portal. No advertising or tracking cookies are used."],
      ["5. Your Rights", "You may request access to, correction of, or deletion of your personal data held by us, subject to statutory record-keeping obligations. Contact the Secretariat to make such a request."],
      ["6. Contact", "For any privacy-related question, write to us at panduwasnuwara@mpcs.lk or call 037 229 1011 / 076 424 7716."],
    ],
  },
  si: {
    badge: "නීතිමය",
    title: "පෞද්ගලිකත්ව ප්‍රතිපත්තිය",
    sub: "ඔබේ පෞද්ගලික තොරතුරු එකතු කිරීම, භාවිතය සහ ආරක්ෂා කිරීම",
    body: [
      ["1. අප එකතු කරන තොරතුරු", "ඔබ අප හා සම්බන්ධ වන විට, සාමාජිකත්වයට අයදුම් කරන විට හෝ සේවා ලබා ගන්නා විට, ඔබේ නම, හැඳුනුම්පත් අංකය, දුරකථන අංකය, විද්‍යුත් තැපැල් ලිපිනය, තැපැල් ලිපිනය සහ සාමාජිකත්වය හෝ විමසුම් සම්බන්ධ විස්තර එකතු කළ හැක."],
      ["2. තොරතුරු භාවිත කරන ආකාරය", "සාමාජිකත්ව අයදුම්පත් සැකසීම, නිල විමසුම්වලට පිළිතුරු දීම, සමූපකාර සේවා (බැංකු, පාරිභෝගික භාණ්ඩ, ඉන්ධන සහ අනෙකුත් අංශ) සැපයීම, නීතියට අනුව සාමාජික වාර්තා පවත්වාගෙන යාම සහ සේවා වැඩිදියුණු කිරීම සඳහා ඔබේ තොරතුරු භාවිතා කරයි."],
      ["3. දත්ත ආරක්ෂාව", "සාමාජික හා නරඹන්නන්ගේ දත්ත ආරක්ෂිත පද්ධති තුළ ගබඩා කෙරේ. ප්‍රවේශය සමිතියේ බලයලත් නිලධාරීන්ට පමණක් සීමා වේ. අලෙවිකරණ අරමුණු සඳහා ඔබේ පෞද්ගලික තොරතුරු තෙවන පාර්ශවයන්ට විකිණීමට හෝ බෙදා දීමට අපි නොකළ යුතුය."],
      ["4. කුකීස්", "ඔබේ භාෂා මනාපය (සිංහල / ඉංග්‍රීසි) මතක තබා ගැනීමට සහ සාමාජික ද්වාරයට පිවිසී තැබීමට අපගේ වෙබ් අඩවිය අත්‍යවශ්‍ය කුකීස් භාවිතා කරයි. ප්‍රචාරණ හෝ ලුහුබැඳීමේ කුකීස් භාවිතා නොකෙරේ."],
      ["5. ඔබේ අයිතිවාසිකම්", "නීත්‍යානුකූල වාර්තා තබා ගැනීමේ බැඳීම් වලට යටත්ව, අප සතුව ඇති ඔබේ පෞද්ගලික දත්ත පිළිබඳ ප්‍රවේශය, ౐දුම් කිරීම හෝ මැකීම ඔබට ඉල්ලා සිටිය හැක. එවැනි ඉල්ලීමක් සඳහා ලේකම් කාර්යාලය හා සම්බන්ධ වන්න."],
      ["6. සම්බන්ධතාවය", "පෞද්ගලිකත්වය සම්බන්ධ ඕනෑම ප්‍රශ්නයක් සඳහා panduwasnuwara@mpcs.lk වෙත ලියන්න හෝ 037 229 1011 / 076 424 7716 අමතන්න."],
    ],
  },
};

export default async function PrivacyPage() {
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
