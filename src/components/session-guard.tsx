"use client";

// ============================================================================
//  Session guard — admin/site ඕනෑම තැනකින් logout වුණාම අනිත් open tabs වල
//  /admin · /dashboard pages auto sign-in එකට යවයි. (storage event + focus check)
//  ⚠ මේක root layout එකේ mount වන නිසා හැම පිටුවකම active.
// ============================================================================

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function SessionGuard() {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const protectedPath = () => /(^|\/)(admin|dashboard)(\/|$)/.test(pathname);

    const kick = () => {
      if (!protectedPath()) return;
      try {
        if (!localStorage.getItem("mpcs_at")) {
          window.location.replace("/signin?next=" + encodeURIComponent(pathname));
        }
      } catch {
        /* ignore */
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "mpcs_logged_out_at") kick();
    };
    const onFocus = () => kick();
    const onVisible = () => {
      if (document.visibilityState === "visible") kick();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}
