"use client";

// ============================================================================
// Sign In — NIC + password login + WhatsApp password recovery
// Professional glass layout with animated password visibility and success animation.
// ============================================================================

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Lock, LogIn, ShieldCheck, UserRound, X } from "lucide-react";
import { MessageImageIcon as MessageCircle } from "@/components/site-icons";
import { AuthShell, AuthSuccessOverlay, PasswordVisibilityButton } from "@/components/auth-shell";
import { useLang } from "@/lib/i18n";
import { logActivity } from "@/lib/activity";
import { loginWithNic } from "@/lib/auth";

export default function SignInPage() {
  const { t, lang } = useLang();
  const si = lang === "si";
  // ✅ දැනටම sign in වෙලා නම් signin page එක ලෝඩ් නොවී යන්න ඕන තැනට යවනවා
  const [checking, setChecking] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [waOpen, setWaOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { createClient, isSupabaseConfigured } = await import("@/lib/supabase/client");
        if (!isSupabaseConfigured()) {
          if (alive) setChecking(false);
          return;
        }
        const sb = createClient();
        const { data } = await sb.auth.getSession();
        let role = "";
        if (!data.session) {
          // localStorage token (custom auth) එකක් තියෙනවද?
          const at = localStorage.getItem("mpcs_at");
          if (!at) {
            if (alive) setChecking(false);
            return;
          }
          const { data: u } = await sb.auth.getUser(at);
          if (!u?.user) {
            if (alive) setChecking(false);
            return;
          }
          const { data: prof } = await sb.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
          role = (prof as { role?: string } | null)?.role ?? "";
          if (alive) window.location.replace(role === "admin" || role === "superadmin" ? "/admin" : "/dashboard");
          return;
        }
        const { data: prof } = await sb.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
        role = (prof as { role?: string } | null)?.role ?? "";
        if (alive) window.location.replace(role === "admin" || role === "superadmin" ? "/admin" : "/dashboard");
      } catch {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || success) return;
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const nic = String(fd.get("nic") || "");
    const { error: err, role } = await loginWithNic(nic, String(fd.get("password") || ""));
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }

    // ✅ Successful log — professional check animation එක පෙන්වා redirect කරයි
    setSuccess(true);
    if (role === "superadmin" || role === "admin") {
      void logActivity("LOGIN", `logged in as ${role} (NIC: ${nic})`);
    }
    window.setTimeout(() => {
      window.location.href = role === "superadmin" || role === "admin" ? "/admin" : "/";
    }, 1500);
  }

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-bg-wash" aria-hidden="true" />
        <main className="auth-shell-wrap">
          <div className="auth-checking-card px-8 py-7 text-center">
            <div className="mx-auto h-10 w-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
            <div className="mt-3 text-[12px] font-semibold text-slate-500">
              {si ? "පරීක්ෂා කරමින්…" : "Checking session…"}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <AuthShell
        mode="signin"
        brand={t.brand}
        backLabel={t.auth.backHome}
        heroKicker={si ? "ආරක්ෂිත නිල ප්‍රවේශය" : "Secure Official Access"}
        heroTitle={si ? "නැවත සාදරයෙන් පිළිගනිමු" : "Welcome Back"}
        heroText={
          si
            ? "ඔබේ සාමාජික profile එක, F28 ඉන්ධන portal එක සහ පරිපාලන පැනල වෙත ප්‍රවේශ වීමට sign in කරන්න."
            : "Sign in to access your member profile, the F28 fuel portal, and administrative panels."
        }
        features={[
          {
            icon: <ShieldCheck size={15} />,
            label: si ? "ආරක්ෂිත NIC + මුරපද සත්‍යාපනය" : "Secure NIC + password authentication",
          },
          {
            icon: <UserRound size={15} />,
            label: si ? "සාමාජික dashboard සහ profile කළමනාකරණය" : "Member dashboard & profile management",
          },
          {
            icon: <BadgeCheck size={15} />,
            label: si ? "නිල සමිති portal එක · ලියාපදිංචි: කුරු/186" : "Official society portal · Reg: කුරු/186",
          },
        ]}
        title={t.auth.signinTitle}
        subtitle={t.auth.signinSub}
      >
        <form onSubmit={submit} className="auth-form space-y-4" aria-busy={busy || success}>
          <div className="auth-field-block">
            <div className="auth-label-row">
              <label htmlFor="signin-nic" className="auth-label">
                {t.auth.nic}
              </label>
            </div>
            <div className="auth-control">
              <span className="auth-control-icon" aria-hidden="true">
                <UserRound size={18} />
              </span>
              <input
                id="signin-nic"
                name="nic"
                required
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={success}
                className="field auth-input has-leading-icon"
                placeholder="e.g. 123456789V or 123456789012"
              />
            </div>
          </div>

          <div className="auth-field-block">
            <div className="auth-label-row">
              <label htmlFor="signin-password" className="auth-label">
                {t.auth.password}
              </label>
              <button type="button" onClick={() => setWaOpen(true)} className="auth-forgot-btn">
                {t.auth.forgot}
              </button>
            </div>
            <div className={`auth-control${show ? " is-password-visible" : ""}`}>
              <span className="auth-control-icon" aria-hidden="true">
                <Lock size={18} />
              </span>
              <input
                id="signin-password"
                name="password"
                required
                type={show ? "text" : "password"}
                autoComplete="current-password"
                disabled={success}
                className="field auth-input has-leading-icon has-trailing-action"
                placeholder="••••••••"
              />
              <PasswordVisibilityButton
                visible={show}
                onToggle={() => setShow((value) => !value)}
                showLabel={si ? "මුරපදය පෙන්වන්න" : "Show password"}
                hideLabel={si ? "මුරපදය සඟවන්න" : "Hide password"}
              />
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={busy || success} className="btn btn-primary auth-submit-btn w-full !text-[14px]">
            {busy ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>{si ? "පිවිසෙමින්…" : "Signing in…"}</span>
              </>
            ) : success ? (
              <>
                <BadgeCheck size={17} />
                <span>{si ? "සාර්ථකයි" : "Success"}</span>
              </>
            ) : (
              <>
                <LogIn size={17} />
                <span>{t.auth.signinBtn}</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-switch-card">
          {t.auth.noAccount}{" "}
          <Link href="/register">{t.auth.registerHere}</Link>
        </div>

        <div className="auth-trust-row">
          <ShieldCheck size={13} />
          {si ? "මෙය ආරක්ෂිත නිල ප්‍රවේශ portal එකකි" : "This is a secure official access portal"}
        </div>
      </AuthShell>

      <AuthSuccessOverlay
        open={success}
        title={si ? "සාදරයෙන් පිළිගනිමු!" : "Welcome back!"}
        description={si ? "Sign in සාර්ථකයි. ඔබේ ගිණුමට රැගෙන යමින්…" : "Sign in successful. Taking you to your account…"}
        progressLabel={si ? "යොමු කරමින්" : "Redirecting"}
      />

      {/* WhatsApp recovery modal */}
      {waOpen && <WhatsAppRecovery onClose={() => setWaOpen(false)} />}
    </>
  );
}

function WhatsAppRecovery({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="card auth-modal-card p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <MessageCircle size={21} />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">{t.auth.waTitle}</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">{t.auth.waDesc}</p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const text = encodeURIComponent(
              `Password Reset Request (Forgot Password)\nName: ${fd.get("name")}\nNIC: ${fd.get("nic")}\nPhone: ${fd.get("phone")}`
            );
            // Admin settings එකේ WhatsApp number එකට — seed default
            const number = "94742352670";
            window.open(`https://wa.me/${number}?text=${text}`, "_blank");
            onClose();
          }}
        >
          <div>
            <label htmlFor="recovery-name" className="field-label">
              {t.auth.fullname} *
            </label>
            <input id="recovery-name" name="name" required autoComplete="name" className="field" placeholder="e.g. Maduranga" />
          </div>
          <div>
            <label htmlFor="recovery-nic" className="field-label">
              {t.auth.nic} *
            </label>
            <input
              id="recovery-nic"
              name="nic"
              required
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              className="field"
              placeholder="E.G. 123456789V OR 123456789012"
            />
          </div>
          <div>
            <label htmlFor="recovery-phone" className="field-label">
              {t.auth.phone} *
            </label>
            <input id="recovery-phone" name="phone" required autoComplete="tel" inputMode="tel" className="field" placeholder="e.g. 0764212345" />
          </div>
          <button type="submit" className="btn btn-green w-full">
            <MessageCircle size={16} /> {t.auth.waSend}
          </button>
        </form>
      </div>
    </div>
  );
}
