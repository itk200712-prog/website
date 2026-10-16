import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// ============================================================================
//  Locale routes (/si /en) + Session refresh + admin route protection
//  /si/* , /en/*  -> same pages, language set by URL (professional switcher)
//  /admin         -> login වූ admin / superadmin භූමිකාව ඇති අයට පමණයි
// ============================================================================

const BARE_PREFIXES = ["/admin", "/signin", "/register", "/api", "/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // ---- /si /en locale detection -------------------------------------------
  const m = pathname.match(/^\/(si|en)(\/.*)?$/);
  const isPrefixed = !!m;
  const stripped = m ? m[2] || "/" : pathname;
  const locale: "si" | "en" = isPrefixed
    ? (m![1] as "si" | "en")
    : request.cookies.get("lang")?.value === "en"
      ? "en"
      : "si";
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
          response = NextResponse.next({ request });
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
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set("x-locale", locale);
    const res = NextResponse.rewrite(
      new URL(stripped + request.nextUrl.search, request.url),
      { request: { headers: reqHeaders } }
    );
    // Supabase refresh එකෙන් සැකසූ cookies රැගෙන යන්න
    response.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    res.cookies.set("lang", locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return res;
  }

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
