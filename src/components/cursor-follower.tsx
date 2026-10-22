"use client";

// ============================================================================
// Desktop mouse cursor animation — Windows/macOS/Linux (Ubuntu) laptops/PCs
//   · native cursor එක හංගන්නේ නෑ; mouse/trackpad එක පස්සෙන් smooth ring එකක්
//   · `(pointer: fine)` එක විතරක් බලන්නේ නෑ: Ubuntu/Wayland + touch laptops
//     වල primary pointer එක coarse කියලා report වුණත්, any-pointer/any-hover
//     සහ ඇත්ත mouse/pen movement එකෙන්ම activate වෙනවා
//   · Pointer Events නැති පැරණි Linux browsers සඳහා MouseEvent fallback එකත්
//   · touch-only devices වල පෙන්වන්නේ නෑ; Windows Accessibility එකේ
//     Animation effects off කළාම එන `prefers-reduced-motion: reduce` එක
//     නිසාවත්, GNOME/Wayland නිසාවත් mouse/trackpad laptop එකේ cursor එක
//     නැති වෙන්නේ නෑ — ඇත්ත desktop pointer එකක් තියෙනවා නම් පේනවා
// ============================================================================

import { useEffect, useRef, useState } from "react";
import {
  isLinuxDesktopMotionEnv,
  readMotionEnvironment,
  shouldShowDesktopCursorEnv,
} from "@/lib/motion-compat";

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, select, textarea, label, summary, [data-cursor="hover"]';

type MoveEvent = PointerEvent | MouseEvent;

function pointerTypeOf(e: MoveEvent): string {
  return (e as PointerEvent).pointerType ?? "";
}

export function CursorFollower() {
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let ringX = x;
    let ringY = y;
    let scale = 1;
    let targetScale = 1;
    let raf = 0;
    let pressed = false;
    let sawMouseOrPen = false;
    let lastTouchAt = 0;

    const mq = (query: string): MediaQueryList | null => {
      try {
        return typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
      } catch {
        return null;
      }
    };

    const reducedQuery = mq("(prefers-reduced-motion: reduce)");
    const mediaQueries = [
      reducedQuery,
      mq("(pointer: fine)"),
      mq("(any-pointer: fine)"),
      mq("(hover: hover)"),
      mq("(any-hover: hover)"),
      mq("(pointer: coarse)"),
    ].filter(Boolean) as MediaQueryList[];

    const canShow = () => {
      const env = readMotionEnvironment(window, sawMouseOrPen);
      if (isLinuxDesktopMotionEnv(env)) {
        document.documentElement.classList.add("motion-compat");
      }
      // Cursor visibility is OS-agnostic. In particular, a Windows laptop
      // with Settings → Accessibility → Visual effects → Animation effects
      // turned off reports `prefers-reduced-motion: reduce`; that must not
      // hide a cursor effect that only follows the user's own mouse/trackpad.
      const ok = shouldShowDesktopCursorEnv(env);
      document.documentElement.classList.toggle("cursor-motion", ok);
      setActive(ok);
      if (!ok) document.body.classList.remove("cursor-fx-on");
      return ok;
    };

    const place = (el: HTMLSpanElement | null, px: number, py: number, s = 1) => {
      if (el) el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%) scale(${s})`;
    };

    const loop = () => {
      ringX += (x - ringX) * 0.18;
      ringY += (y - ringY) * 0.18;
      scale += (targetScale - scale) * 0.2;
      place(ringRef.current, ringX, ringY, scale);

      const settled =
        Math.abs(x - ringX) < 0.08 && Math.abs(y - ringY) < 0.08 && Math.abs(targetScale - scale) < 0.002;
      raf = settled ? 0 : window.requestAnimationFrame(loop);
    };
    const startLoop = () => {
      if (!raf) raf = window.requestAnimationFrame(loop);
    };

    const markTouch = () => {
      lastTouchAt = Date.now();
      pressed = false;
      document.body.classList.remove("cursor-fx-on");
    };

    const isMouseOrPenEvent = (e: MoveEvent) => {
      const pointerType = pointerTypeOf(e);
      if (pointerType === "touch") {
        markTouch();
        return false;
      }
      // Touch taps can synthesize compatibility mouse events. Ignore the
      // brief burst after a touch so phones/touch-only tablets stay clean,
      // while real Ubuntu trackpad/mouse movement activates immediately.
      if (!pointerType && Date.now() - lastTouchAt < 900) return false;
      if (pointerType && pointerType !== "mouse" && pointerType !== "pen") return false;
      return true;
    };

    const onMove = (e: MoveEvent) => {
      if (!isMouseOrPenEvent(e)) return;
      sawMouseOrPen = true;
      if (!canShow()) return;

      x = e.clientX;
      y = e.clientY;
      document.body.classList.add("cursor-fx-on");
      place(dotRef.current, x, y);

      const target = e.target instanceof Element ? e.target : null;
      const interactive = target?.closest(INTERACTIVE_SELECTOR);
      targetScale = pressed ? 0.82 : interactive ? 1.55 : 1;
      startLoop();
    };

    const onDown = (e: MoveEvent) => {
      if (!isMouseOrPenEvent(e)) return;
      sawMouseOrPen = true;
      if (!canShow()) return;
      pressed = true;
      targetScale = 0.82;
      startLoop();
    };

    const onUp = (e: MoveEvent) => {
      if (!isMouseOrPenEvent(e)) return;
      sawMouseOrPen = true;
      if (!canShow()) return;
      pressed = false;
      targetScale = 1;
      startLoop();
    };

    const onLeave = () => document.body.classList.remove("cursor-fx-on");
    const onMediaChange = () => canShow();

    place(dotRef.current, x, y);
    place(ringRef.current, ringX, ringY, scale);
    canShow();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    window.addEventListener("touchstart", markTouch, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    mediaQueries.forEach((query) => query.addEventListener?.("change", onMediaChange));

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchstart", markTouch);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      mediaQueries.forEach((query) => query.removeEventListener?.("change", onMediaChange));
      document.body.classList.remove("cursor-fx-on");
      document.documentElement.classList.remove("cursor-motion");
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="cursor-fx no-print"
      data-testid="cursor-follower"
      data-active={active ? "true" : "false"}
    >
      <span ref={ringRef} className="cursor-fx-ring" />
      <span ref={dotRef} className="cursor-fx-dot" />
    </div>
  );
}
