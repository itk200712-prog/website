"use client";

// ============================================================================
//  Hero background slideshow — admin settings වලින් එකතු කරන images (5ක්+)
//  auto-change වේ crossfade + Ken Burns animation එකක් සමඟ.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { shouldReduceMotion } from "@/lib/motion-compat";

const INTERVAL_MS = 6000;

export function HeroSlideshow({ images }: { images: string[] }) {
  const slides = images.length > 0 ? images : ["/images/hero/hero-1.jpg"];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = typeof window !== "undefined" && shouldReduceMotion(window);
  }, []);

  const next = useCallback(() => setIdx((i) => (i + 1) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const id = setInterval(next, INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, next, slides.length]);

  return (
    <div
      className="hero-slideshow"
      aria-hidden
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((src, i) => (
        <div key={`${src}-${i}`} className={`hero-slide ${i === idx ? "is-active" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="hero-slide-img" loading={i === 0 ? "eager" : "lazy"} />
        </div>
      ))}

      {/* dots */}
      {slides.length > 1 && (
        <div className="hero-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Hero image ${i + 1}`}
              className={`hero-dot ${i === idx ? "is-active" : ""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
