"use client";

// Floating language switcher — device එකේ දකුණු පැත්තේ යටම (responsive)

import { useLang } from "@/lib/i18n";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";

export function FloatingLang() {
  const { lang, setLang } = useLang();
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/admin")) return null;

  const switchTo = (next: "si" | "en") => {
    if (next === lang) return;
    const m = pathname.match(/^\/(si|en)(\/.*)?$/);
    if (m) {
      const rest = m[2] || "/";
      window.location.href = `/${next}${rest === "/" ? "" : rest}${window.location.search || ""}`;
    } else {
      setLang(next);
    }
  };

  return (
    <div className="fixed z-[80] bottom-4 right-4 sm:bottom-6 sm:right-6 no-print">
      <div className="flex items-center gap-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-2xl p-1">
        <span className="pl-2 pr-0.5 text-white/70">
          <Languages size={15} />
        </span>
        {(["si", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => switchTo(l)}
            className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11.5px] sm:text-[12px] font-bold transition ${
              lang === l ? "bg-white text-slate-900 shadow" : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            {l === "si" ? "සිංහල" : "English"}
          </button>
        ))}
      </div>
    </div>
  );
}
