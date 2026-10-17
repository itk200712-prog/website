import type { Metadata } from "next";
import { Inter, Noto_Sans_Sinhala } from "next/font/google";
import { FloatingLang } from "@/components/floating-lang";
import { OnlinePresence } from "@/components/online-presence";
import { LiveChat } from "@/components/live-chat";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-sinhala",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Panduwasnuwara MPCS",
  description:
    "Panduwasnuwara New Multi Purpose Co-Operative Society LTD — rural banking, consumer goods, product agencies and fuel supply under one roof. සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const cookieStore = await cookies();
  const raw = h.get("x-locale") ?? cookieStore.get("lang")?.value;
  const lang: Lang = raw === "si" ? "si" : "en"; // default = English
  return (
    <html lang={lang}>
      <body className={`${inter.variable} ${sinhala.variable}`}>
        <LanguageProvider initialLang={lang}>
          {children}
          <FloatingLang />
          <OnlinePresence />
          <LiveChat />
        </LanguageProvider>
      </body>
    </html>
  );
}
