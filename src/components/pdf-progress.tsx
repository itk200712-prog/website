"use client";

// ============================================================================
// PDF Progress Overlay — "ඉතිරි වෙලාව" (time remaining) + powerful animation
//  · වටේ කැරකෙන conic glow ring + පිටු ගණනට අනුව පිරෙන gradient ring
//  · orbit කරන dots, shimmer sweep, pulse වෙන countdown
//  · පිටු ගණන (3 / 26), ප්‍රතිශතය, ගත වූ වේලාව
//  · ඉවර වුණාම check mark + burst rings
//  · reduced-motion user ලාට animation නවත්තලා සරල විදිහට (motion-compat)
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Timer, Zap } from "lucide-react";
import { shouldReduceMotion } from "@/lib/motion-compat";

export type PdfProgressState = {
  label: string;
  pct: number;
  page: number;
  totalPages: number;
  elapsedMs: number;
  etaMs: number | null;
  done: boolean;
};

/** ms → "0:42" / "1:05" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const RING = 118;
const STROKE = 9;
const CIRC = 2 * Math.PI * (RING / 2 - STROKE / 2);

export function PdfProgressOverlay({
  state,
  kind,
  lang = "si",
}: {
  state: PdfProgressState;
  kind: "member" | "voter";
  lang?: "si" | "en";
}) {
  const [reduce, setReduce] = useState(false);
  // 📈 තිරයේ පෙන්වන "smooth" අගයන් — report එකක් එනකන් බලා නොසිට තත්පරයේ කොටසකින් කොටසකට තමයි අඩු වෙන්නේ
  const [view, setView] = useState({ pct: state.pct, etaMs: state.etaMs, elapsedMs: state.elapsedMs });

  useEffect(() => {
    setReduce(shouldReduceMotion());
  }, []);

  // අලුත් report එකක් (පිටුවක් ඉවර වුණාම) ආවම — anchor එක යාවත්කාලීන වේ
  const reportRef = useRef({ at: 0, eta: state.etaMs, pct: state.pct, elapsed: state.elapsedMs });
  const dispRef = useRef({ pct: state.pct, eta: state.etaMs ?? 0, etaReady: state.etaMs !== null });

  useEffect(() => {
    reportRef.current = { at: performance.now(), eta: state.etaMs, pct: state.pct, elapsed: state.elapsedMs };
    if (state.etaMs !== null && !dispRef.current.etaReady) {
      // පළවෙනි අගය 0:00 → 0:41 ලෙස උඩට ගණන් කරන්නේ නැතුව කෙලින්ම දානවා
      dispRef.current.eta = state.etaMs;
      dispRef.current.etaReady = true;
    }
  }, [state.pct, state.etaMs, state.elapsedMs, state.page, state.totalPages]);

  // ✨ smooth interpolation loop (≈7 fps) — මිනිස්සුන්ට ස්වභාවික විදිහට අඩු වෙන කවුන්ටරයක්
  useEffect(() => {
    if (state.done || reduce) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.max(16, Math.min(400, now - last));
      last = now;
      const r = reportRef.current;
      const since = now - r.at; // report එකෙන් පස්සේ ගත වූ වේලාව
      // ETA එක තමන්ම අඩු වෙනවා (පිටුවක් ඉවර වෙනකන් නතර වෙන්නේ නෑ)
      const etaTarget = r.eta === null ? null : Math.max(0, r.eta - since);
      // ප්‍රතිශතයත් හෙමින් ඉස්සරහට යනවා (ring එක එක තැනක stuck වෙන්නේ නෑ)
      const pctTarget =
        r.eta && r.eta > 0 ? Math.min(99, r.pct + (100 - r.pct) * Math.min(0.9, since / r.eta)) : r.pct;
      const d = dispRef.current;
      // exponential smoothing → පැනීමක් නෑ, නමුත් අලුත් (නිවැරදි) අගයට ඉක්මනින් යනවා
      d.pct += (pctTarget - d.pct) * (1 - Math.exp(-dt / 520));
      if (etaTarget !== null) {
        if (!d.etaReady) {
          d.eta = etaTarget;
          d.etaReady = true;
        } else {
          d.eta += (etaTarget - d.eta) * (1 - Math.exp(-dt / 900));
        }
      }
      setView({
        pct: Math.min(99, Math.max(r.pct, d.pct)),
        etaMs: etaTarget === null ? null : Math.max(0, Math.round(d.eta)),
        elapsedMs: r.elapsed + since,
      });
    }, 140);
    return () => window.clearInterval(id);
  }, [state.done, reduce]);

  useEffect(() => {
    if (state.done) setView({ pct: 100, etaMs: 0, elapsedMs: state.elapsedMs });
  }, [state.done, state.elapsedMs]);

  const si = lang === "si";
  const pct = Math.max(0, Math.min(100, state.done ? 100 : view.pct));
  const dash = CIRC * (1 - pct / 100);
  const eta = state.done ? 0 : view.etaMs;
  const etaText = state.done
    ? si
      ? "නිමයි"
      : "done"
    : eta === null
      ? si
        ? "ගණනය වෙමින්…"
        : "calculating…"
      : formatClock(Math.max(eta, 900)); // ඉවර වෙනකන් 0:00 ලෙස නතර නොවී 0:01 තියාගන්නවා

  const stage = useMemo(() => {
    if (state.done) return si ? "සම්පූර්ණයි" : "Complete";
    if (state.totalPages === 0) return si ? "දත්ත කියවමින්" : "Reading rows";
    if (state.page === 0) return si ? "පිටු සකසමින්" : "Laying out pages";
    return si ? "පිටු render වෙමින්" : "Rendering pages";
  }, [state.done, state.totalPages, state.page, si]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* backdrop */}
      <div className={`absolute inset-0 bg-slate-950/70 backdrop-blur-md ${reduce ? "" : "pdf-fade-in"}`} />

      {/* card */}
      <div
        className={`relative w-full max-w-[420px] overflow-hidden rounded-[30px] border border-white/15 bg-[#0b1029] px-7 pt-8 pb-7 text-center shadow-[0_30px_90px_-20px_rgba(67,56,202,0.75)] ${reduce ? "" : "pdf-pop-in"}`}
      >
        {/* rotating conic glow */}
        {!reduce && <div className="pdf-aurora pointer-events-none absolute -inset-[45%] opacity-[0.34]" />}
        {/* aurora එක card එකේ මෘදු glow එකක් විතරයි — කියවීමට බාධා නොවෙන්න අඳුරු veil එකක් */}
        <div className="pointer-events-none absolute inset-0 bg-[#0b1029]/62" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.55),transparent_62%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-[30px] ring-1 ring-inset ring-white/10" />

        <div className="relative">
          {/* header */}
          <div className="flex items-center justify-center gap-2 text-[10.5px] font-bold tracking-[0.22em] text-indigo-200/80">
            <FileText size={12} />
            {kind === "member" ? (si ? "සාමාජික ලේඛනය" : "MEMBER REGISTER") : si ? "චන්ද හිමි ලේඛනය" : "VOTER REGISTER"}
          </div>
          <div className="mt-1.5 truncate text-[13.5px] font-extrabold text-white/95">{state.label}</div>

          {/* progress ring + orbit dots */}
          <div className="relative mx-auto mt-6 h-[140px] w-[140px]">
            {!reduce && (
              <>
                <span className="pdf-orbit absolute inset-0 rounded-full" style={{ animationDuration: "3.4s" }}>
                  <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_12px_3px_rgba(110,231,183,0.8)]" />
                </span>
                <span className="pdf-orbit absolute inset-[8px] rounded-full" style={{ animationDuration: "2.2s", animationDirection: "reverse" }}>
                  <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-indigo-300 shadow-[0_0_10px_2px_rgba(165,180,252,0.9)]" />
                </span>
              </>
            )}
            <svg viewBox={`0 0 ${RING} ${RING}`} className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="pdfRingGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="55%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
                <filter id="pdfRingGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3.2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx={RING / 2} cy={RING / 2} r={RING / 2 - STROKE / 2} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={STROKE} />
              <circle
                cx={RING / 2}
                cy={RING / 2}
                r={RING / 2 - STROKE / 2}
                fill="none"
                stroke="url(#pdfRingGrad)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dash}
                filter="url(#pdfRingGlow)"
                style={{ transition: reduce ? "none" : "stroke-dashoffset 200ms linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {state.done ? (
                <div className="pdf-burst relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check size={26} className="text-emerald-300" strokeWidth={3.5} />
                </div>
              ) : (
                <>
                  <div className="text-[26px] font-black leading-none tabular-nums text-white">{pct}%</div>
                  <div className="mt-1 text-[9.5px] font-bold tracking-[0.18em] text-indigo-200/70">
                    {state.totalPages ? `${state.page} / ${state.totalPages} ${si ? "පිටු" : "pages"}` : si ? "සූදානම් වෙමින්" : "preparing"}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* time remaining */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-indigo-200/70">
              <Timer size={11} />
              {state.done ? (si ? "ඉවරයි" : "FINISHED") : si ? "ඉතිරි වෙලාව" : "TIME REMAINING"}
            </div>
            <div
              key={etaText}
              className={`mt-1 text-[34px] font-black leading-none tabular-nums tracking-tight text-white ${reduce || state.done || eta === null ? "" : "pdf-tick"}`}
            >
              {etaText}
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-3 text-[10.5px] font-semibold text-indigo-200/60 tabular-nums">
              <span>
                {si ? "ගත විය" : "elapsed"} {formatClock(state.done ? state.elapsedMs : view.elapsedMs)}
              </span>
              <span className="h-1 w-1 rounded-full bg-indigo-300/40" />
              <span className="inline-flex items-center gap-1">
                <Zap size={10} className="text-emerald-300" /> {stage}
              </span>
            </div>
          </div>

          {/* bar */}
          <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400"
              style={{ width: `${pct}%`, transition: reduce ? "none" : "width 200ms linear" }}
            />
            {!reduce && !state.done && <div className="pdf-shimmer absolute inset-0" />}
          </div>

          <div className="mt-3 text-[10.5px] text-indigo-100/50">
            {state.done
              ? si
                ? "PDF එක download වුණා — ලේඛනය සම්පූර්ණයි"
                : "PDF downloaded — register complete"
              : si
                ? "සියලු විස්තර සහිතව නිල ලේඛනය සකසමින්…"
                : "Building the official register with every detail…"}
          </div>
        </div>
      </div>
    </div>
  );
}
