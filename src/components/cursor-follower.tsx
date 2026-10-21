"use client";

// ============================================================================
// Desktop mouse cursor animation — laptop/PC (fine pointer) විතරයි
//   · native cursor එක හංගන්නේ නෑ; යම්‍යි පස්සෙන් smooth ring එකක් එනවා
//   · link/button/input උඩින් යද්දී ring එක ලොකු වෙනවා, click කරද්දී හැකිලෙනවා
//   · touch devices + reduced-motion වලදී සම්පූර්ණයෙන්ම නෑ
// ============================================================================

import { useEffect, useRef, useState } from "react";

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, select, textarea, label, summary, [data-cursor="hover"]';

export function CursorFollower() {
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    setEnabled(true);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let ringX = x;
    let ringY = y;
    let scale = 1;
    let targetScale = 1;
    let raf = 0;
    let pressed = false;

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

    const onMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      x = e.clientX;
      y = e.clientY;
      document.body.classList.add("cursor-fx-on");
      place(dotRef.current, x, y);

      const target = e.target instanceof Element ? e.target : null;
      const interactive = target?.closest(INTERACTIVE_SELECTOR);
      targetScale = pressed ? 0.82 : interactive ? 1.55 : 1;
      startLoop();
    };
    const onDown = () => {
      pressed = true;
      targetScale = 0.82;
      startLoop();
    };
    const onUp = () => {
      pressed = false;
      targetScale = 1;
      startLoop();
    };
    const onLeave = () => document.body.classList.remove("cursor-fx-on");

    place(dotRef.current, x, y);
    place(ringRef.current, ringX, ringY, scale);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.body.classList.remove("cursor-fx-on");
    };
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="cursor-fx no-print" data-testid="cursor-follower">
      <span ref={ringRef} className="cursor-fx-ring" />
      <span ref={dotRef} className="cursor-fx-dot" />
    </div>
  );
}
