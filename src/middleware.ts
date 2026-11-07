import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// ============================================================================
//  Locale routes (/si /en) + Session refresh + admin route protection
//  /si/* , /en/*  -> same pages, language set by URL (professional switcher)
//  /admin         -> login වූ admin / superadmin භූමිකාව ඇති අයට පමණයි
// ============================================================================

const BARE_PREFIXES = ["/admin", "/signin", "/register", "/api", "/auth", "/hub"];

/**
 * 🌐 Locale prefix එකක් නොදා යා යුතු root-level files — pentest/SEO tools කෙලින්ම
 * `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt` ඉල්ලන නිසා ඒවා /en/... වලට
 * redirect කළොත් හමු නොවේ (pentest report: "robots.txt Not found").
 */
const ROOT_FILES = [
  "/robots.txt",
  "/sitemap.xml",
  "/security.txt",
  "/.well-known",
  "/manifest.webmanifest",
  "/manifest.json",
  "/icon.svg",
  "/apple-icon.svg",
  "/favicon.ico",
];
function isRootFile(pathname: string): boolean {
  return ROOT_FILES.some((f) => pathname === f || pathname.startsWith(`${f}/`));
}

// ============================================================================
//  🔐 CSP with per-request NONCE (pentestnet: "Unsafe source 'unsafe-inline'
//     in directive script-src")
//  · nonce එක request එකට අලුත් (crypto.randomUUID) → guess කරන්න බෑ
//  · Next.js app-router එකේ inline bootstrap scripts වලට Next.js එකෙන්ම
//    මේ nonce එක auto add වේ (CSP header එක request headers වල තියෙන නිසා)
//  · script-src: 'self' 'nonce-…' 'strict-dynamic' — 'unsafe-inline' නෑ
//  · style-src වලට 'unsafe-inline' අවශ්‍යයි (Tailwind inline styles)
// ============================================================================
const SUPABASE_ORIGIN = "https://*.supabase.co";
const SUPABASE_WS = "wss://*.supabase.co";

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // ⚠ 'unsafe-inline' එකක් නෑ — modern browsers nonce එකක් තියෙනවා නම් inline script ignore කරයි
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: blob:",
    "media-src 'self' data: blob: https:",
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS} https://*.supabase.in https://vitals.vercel-insights.com`,
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = makeNonce();
  const csp = buildCsp(nonce, isDev);

  // Next.js මේ request header එකෙන් තමන්ගේ inline scripts වලට nonce එක දාගන්නවා
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const { pathname } = request.nextUrl;

  // ---- /si /en locale detection -------------------------------------------
  const m = pathname.match(/^\/(si|en)(\/.*)?$/);
  const isPrefixed = !!m;
  const stripped = m ? m[2] || "/" : pathname;
  const locale: "si" | "en" = isPrefixed
    ? (m![1] as "si" | "en")
    : request.cookies.get("lang")?.value === "si"
      ? "si"
      : "en"; // default = English ✅
  const isBareKept = BARE_PREFIXES.some((p) => stripped === p || stripped.startsWith(`${p}/`));

  // ---- Supabase session (admin protection) — /admin එකට පමණයි ------------
  // ⚡ public pages වලට Supabase getUser() නැති නිසා navigation delay එක අඩුයි
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anon && stripped.startsWith("/admin")) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set("Content-Security-Policy", csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Session නැවුම් කිරීම (required for Server Components)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (stripped.startsWith("/admin")) {
      if (!user) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/signin";
        redirectUrl.searchParams.set("next", stripped);
        return NextResponse.redirect(redirectUrl);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role !== "admin" && profile?.role !== "superadmin") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // ---- /si /en -> render same page with locale header + cookie ------------
  if (isPrefixed) {
    // 🔐 CSP (nonce සහිත) request header එකේම තියෙන්න ඕනේ — Next.js ඒකෙන් තමන්ගේ
    //    inline scripts වලට nonce එක දාගන්නවා. ඒ නිසා requestHeaders පාවිච්චි කරයි.
    requestHeaders.set("x-locale", locale);
    const res = NextResponse.rewrite(
      new URL(stripped + request.nextUrl.search, request.url),
      { request: { headers: requestHeaders } }
    );
    // Supabase refresh එකෙන් සැකසූ cookies රැගෙන යන්න
    response.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    res.cookies.set("lang", locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
    res.headers.set("Content-Security-Policy", csp);
    res.headers.set("x-nonce", nonce);
    return res;
  }

  // ---- root-level files (robots/sitemap/security.txt) -> redirect නොකර පිටත් කරයි ----
  if (isRootFile(stripped)) return response;

  // ---- bare public paths -> /si/... or /en/... (cookie එක අනුව) ----------
  if (!isBareKept) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${stripped === "/" ? "" : stripped}`;
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
