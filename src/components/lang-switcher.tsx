"use client";

// ============================================================================
//  Professional language switcher — සිංහල | English
//  /si /en routes මත ඇති විට URL එක මාරු කරයි · admin/signin වල cookie මාරු කරයි
// ============================================================================

import { useLang } from "@/lib/i18n";
import { usePathname } from "next/navigation";

export function LangSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { lang, setLang } = useLang();
  const pathname = usePathname() || "/";

  const switchTo = (next: "si" | "en") => {
    if (next === lang) return;
    const m = pathname.match(/^\/(si|en)(\/.*)?$/);
    if (m) {
      const rest = m[2] || "/";
      const suffix = rest === "/" ? "" : rest;
      window.location.href = `/${next}${suffix}${window.location.search || ""}`;
    } else {
      setLang(next);
    }
  };

  const base =
    tone === "dark"
      ? "bg-white/10 border border-white/25"
      : "bg-slate-100 border border-slate-200";
  const active = "bg-indigo-700 text-white shadow-md";
  const idle =
    tone === "dark"
      ? "text-white/85 hover:text-white hover:bg-white/10"
      : "text-slate-600 hover:text-slate-900 hover:bg-white";

  return (
    <div
      role="group"
      aria-label="Language / භාෂාව"
      className={`inline-flex items-center rounded-full p-1 gap-1 ${base}`}
    >
      {(["si", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-pressed={lang === l}
          className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-bold transition-all duration-200 ${
            lang === l ? active : idle
          }`}
        >
          {l === "si" ? "සිංහල" : "English"}
        </button>
      ))}
    </div>
  );
}
