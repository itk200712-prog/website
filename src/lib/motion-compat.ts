// ============================================================================
//  Linux / Ubuntu desktop motion compatibility
//  ---------------------------------------------------------------------------
//  Some Ubuntu/GNOME laptop setups report `prefers-reduced-motion: reduce`
//  or a coarse *primary* pointer even when the person is using a normal
//  mouse/trackpad. That made the site's CSS animations and the decorative
//  cursor ring disappear on otherwise normal laptops/PCs. These helpers keep
//  reduced-motion behaviour for phones/tablets and non-Linux systems, while
//  re-enabling the owner's requested animations on Linux desktop browsers.
// ============================================================================

export interface MotionEnvironment {
  userAgent?: string;
  platform?: string;
  vendor?: string;
  anyFinePointer?: boolean;
  anyHover?: boolean;
  finePointer?: boolean;
  hover?: boolean;
  coarsePointer?: boolean;
  width?: number;
  maxTouchPoints?: number;
  sawMouseOrPen?: boolean;
}

const MOBILE_UA_RE = /android|iphone|ipad|ipod|mobile|windows phone/i;
const LINUX_DESKTOP_UA_RE = /ubuntu|linux|x11|wayland|debian|fedora|arch linux|linux mint/i;

export function hasDesktopPointerEnv(env: MotionEnvironment = {}): boolean {
  return Boolean(
    env.sawMouseOrPen ||
      env.anyFinePointer ||
      env.anyHover ||
      env.finePointer ||
      env.hover
  );
}

export function isLinuxDesktopMotionEnv(env: MotionEnvironment = {}): boolean {
  const text = `${env.userAgent ?? ""} ${env.platform ?? ""} ${env.vendor ?? ""}`;
  if (MOBILE_UA_RE.test(text)) return false;
  if (!LINUX_DESKTOP_UA_RE.test(text)) return false;

  // A non-mobile Linux UA is normally a desktop/laptop browser. The width
  // fallback helps older WebKitGTK/Firefox builds where any-pointer/any-hover
  // are missing or reported conservatively on Wayland/X11.
  return hasDesktopPointerEnv(env) || (env.width ?? 0) >= 900;
}

export function isLinuxDesktopUserAgent(userAgent: string | null | undefined): boolean {
  // Server-side first-paint check: UAs do not carry pointer/width details, so
  // a non-mobile Linux/X11 UA is treated as a desktop-class browser. The
  // client cursor code still waits for real mouse/pen movement before it
  // shows the cursor ring, so touch-only devices do not get a fake cursor.
  return isLinuxDesktopMotionEnv({ userAgent: userAgent ?? "", width: 1280 });
}

export function shouldReduceMotionForEnv(
  prefersReducedMotion: boolean,
  env: MotionEnvironment = {}
): boolean {
  return prefersReducedMotion && !isLinuxDesktopMotionEnv(env);
}

export function shouldShowDesktopCursorEnv(env: MotionEnvironment = {}): boolean {
  // The decorative cursor ring is user-driven: it only appears after/for a
  // real desktop-class mouse, pen, trackpad or hover-capable pointer. Do not
  // hide it just because Windows/macOS/Linux reports reduced motion or a
  // coarse *primary* pointer on a touchscreen laptop — that was why it
  // vanished on some Windows machines. Touch-only devices still stay clean
  // because the follower waits for mouse/pen movement before becoming visible.
  return hasDesktopPointerEnv(env);
}

function safeMatchMedia(win: Window, query: string): boolean {
  try {
    return typeof win.matchMedia === "function" && win.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function readMotionEnvironment(
  win: Window,
  sawMouseOrPen = false
): MotionEnvironment {
  const nav = win.navigator;
  const platform =
    (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    nav.platform ??
    "";

  return {
    userAgent: nav.userAgent ?? "",
    platform,
    vendor: nav.vendor ?? "",
    anyFinePointer: safeMatchMedia(win, "(any-pointer: fine)"),
    anyHover: safeMatchMedia(win, "(any-hover: hover)"),
    finePointer: safeMatchMedia(win, "(pointer: fine)"),
    hover: safeMatchMedia(win, "(hover: hover)"),
    coarsePointer: safeMatchMedia(win, "(pointer: coarse)"),
    width: win.innerWidth,
    maxTouchPoints: nav.maxTouchPoints,
    sawMouseOrPen,
  };
}

export function motionCompatEnabled(win?: Window, sawMouseOrPen = false): boolean {
  const w = win ?? (typeof window !== "undefined" ? window : undefined);
  if (!w) return false;
  if (w.document?.documentElement?.classList.contains("motion-compat")) return true;
  return isLinuxDesktopMotionEnv(readMotionEnvironment(w, sawMouseOrPen));
}

export function shouldReduceMotion(win?: Window): boolean {
  const w = win ?? (typeof window !== "undefined" ? window : undefined);
  if (!w) return false;
  const reduced = safeMatchMedia(w, "(prefers-reduced-motion: reduce)");
  return shouldReduceMotionForEnv(reduced, readMotionEnvironment(w));
}
