"use client";

// ============================================================================
// Auth shell — Sign In + Register professional glass experience
// Shared layout, animated password visibility and success animation.
// The actual auth calls stay in each page.
// ============================================================================

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, Eye } from "lucide-react";

export type AuthFeature = {
  icon: ReactNode;
  label: string;
};

type AuthShellProps = {
  mode: "signin" | "register";
  brand: string;
  backLabel: string;
  heroKicker: string;
  heroTitle: string;
  heroText: string;
  features: AuthFeature[];
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({
  mode,
  brand,
  backLabel,
  heroKicker,
  heroTitle,
  heroText,
  features,
  title,
  subtitle,
  children,
}: AuthShellProps) {
  return (
    <div className="auth-page">
      <div className="auth-bg-wash" aria-hidden="true" />
      <div className="auth-bg-orb auth-bg-orb-one" aria-hidden="true" />
      <div className="auth-bg-orb auth-bg-orb-two" aria-hidden="true" />
      <div className="auth-bg-grid" aria-hidden="true" />

      <main className="auth-shell-wrap">
        <section className={`auth-glass-shell is-${mode}`} aria-label={title}>
          <aside className="auth-brand-panel">
            <div className="auth-brand-aura" aria-hidden="true" />
            <div className="auth-brand-shade" aria-hidden="true" />

            <div className="auth-brand-top">
              <div className="auth-logo-mark" aria-hidden="true">
                coop
              </div>
              <div className="min-w-0 leading-tight">
                <div className="auth-brand-name">{brand}</div>
                <div className="auth-brand-sub">Panduwasnuwara New MPCS LTD</div>
              </div>
            </div>

            <div className="auth-hero-card">
              <div className="auth-hero-kicker">{heroKicker}</div>
              <h2>{heroTitle}</h2>
              <p>{heroText}</p>
              <div className="auth-feature-list">
                {features.map((feature) => (
                  <div key={feature.label} className="auth-feature">
                    <span className="auth-feature-icon" aria-hidden="true">
                      {feature.icon}
                    </span>
                    <span>{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="auth-brand-footer">
              <span>Est. 1976</span>
              <span aria-hidden="true">•</span>
              <span>Reg. කුරු/186</span>
              <span aria-hidden="true">•</span>
              <span>Hettipola</span>
            </div>
          </aside>

          <div className="auth-form-panel">
            <div className="auth-form-inner">
              <Link href="/" className="auth-back-link">
                <ArrowLeft size={15} /> {backLabel}
              </Link>

              <div className="auth-heading">
                <div className="min-w-0">
                  <div className="auth-form-kicker">Official Member Portal</div>
                  <h1>{title}</h1>
                  <p>{subtitle}</p>
                </div>
              </div>

              {children}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export function PasswordVisibilityButton({
  visible,
  onToggle,
  showLabel,
  hideLabel,
}: {
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  const label = visible ? hideLabel : showLabel;
  return (
    <button
      type="button"
      className="auth-eye-toggle"
      data-visible={visible ? "true" : "false"}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={visible}
      title={label}
    >
      <span key={visible ? "visible" : "hidden"} className="auth-eye-pop" aria-hidden="true">
        <Eye size={18} strokeWidth={2.15} />
        <span className="auth-eye-slash" />
      </span>
    </button>
  );
}

export function AuthSuccessMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`auth-success-mark${compact ? " is-compact" : ""}`} aria-hidden="true">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <span
          key={angle}
          className="auth-success-spark"
          style={{ "--auth-spark-angle": `${angle}deg` } as CSSProperties}
        />
      ))}
      <svg viewBox="0 0 100 100" focusable="false">
        <defs>
          <linearGradient id="auth-success-gradient" x1="8" y1="8" x2="92" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#34d399" />
            <stop offset="0.55" stopColor="#10b981" />
            <stop offset="1" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <circle className="auth-success-track" cx="50" cy="50" r="43" />
        <circle className="auth-success-circle" cx="50" cy="50" r="43" />
        <path className="auth-success-check" d="M31 51.5 44 64 70 36" />
      </svg>
    </div>
  );
}

export function AuthSuccessOverlay({
  open,
  title,
  description,
  progressLabel,
}: {
  open: boolean;
  title: string;
  description: string;
  progressLabel: string;
}) {
  if (!open) return null;
  return (
    <div className="auth-success-overlay" role="status" aria-live="polite" aria-label={title}>
      <div className="auth-success-card">
        <AuthSuccessMark />
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="auth-success-progress" aria-hidden="true">
          <span />
        </div>
        <div className="auth-success-progress-label">{progressLabel}</div>
      </div>
    </div>
  );
}
