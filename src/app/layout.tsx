import type { Metadata } from "next";
import { FloatingLang } from "@/components/floating-lang";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export const metadata: Metadata = {
  title:
    "සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය | Panduwasnuwara New Multi Purpose Co-Operative Society LTD",
  description:
    "Panduwasnuwara New Multi Purpose Co-Operative Society LTD — rural banking, consumer goods, product agencies and fuel supply under one roof. සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const cookieStore = await cookies();
  const raw = h.get("x-locale") ?? cookieStore.get("lang")?.value;
  const lang: Lang = raw === "en" ? "en" : "si";
  return (
    <html lang={lang}>
      <head>
        {/* භාෂාව අනුව fonts: English = Inter · සිංහල = Noto Sans Sinhala */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Sinhala:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <FloatingLang />
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
