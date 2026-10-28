"use client";

// ============================================================================
// Register — member registration
// Professional glass layout with animated password visibility + success state.
// ============================================================================

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, BadgeCheck, Lock, ShieldCheck, Sparkles, UserPlus, UserRound, UsersRound } from "lucide-react";
import { PhoneImageIcon as Phone } from "@/components/site-icons";
import { AuthShell, AuthSuccessMark, PasswordVisibilityButton } from "@/components/auth-shell";
import { useLang } from "@/lib/i18n";
import { registerMember, validateNic, validatePassword, validatePhone } from "@/lib/auth";

export default function RegisterPage() {
  const { t, lang } = useLang();
  const si = lang === "si";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");
    const nicErr = validateNic(String(fd.get("nic") || ""));
    if (nicErr) {
      setError(nicErr);
      return;
    }
    const phoneErr = validatePhone(String(fd.get("phone") || ""));
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    const pwErr = validatePassword(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (password !== confirm) {
      setError(si ? "මුරපද දෙක එක සමාන නොවේ — නැවත පරීක්ෂා කරන්න" : "Passwords do not match — please check again");
      return;
    }
    setBusy(true);
    const { error: err } = await registerMember({
      full_name: String(fd.get("full_name") || ""),
      nic: String(fd.get("nic") || ""),
      phone: String(fd.get("phone") || ""),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell
      mode="register"
      brand={t.brand}
      backLabel={t.auth.backHome}
      heroKicker={si ? "නිල සාමාජික ලියාපදිංචිය" : "Official Member Registration"}
      heroTitle={si ? "සාමාජිකයෙකු වන්න" : "Become a Member"}
      heroText={
        si
          ? "නිල සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිති සාමාජික ගිණුම නිර්මාණය කර සියලු සේවාවන්ට ප්‍රවේශ වන්න."
          : "Create your official Panduwasnuwara New MPCS member account and get access to every society service."
      }
      features={[
        {
          icon: <Sparkles size={15} />,
          label: si ? "නොමිලේ නිල සාමාජික ගිණුමක්" : "Free official member account",
        },
        {
          icon: <UsersRound size={15} />,
          label: si ? "සාමාජික ලේඛනය සහ ඡන්ද සුදුසුකම්" : "Member directory & voter eligibility",
        },
        {
          icon: <BadgeCheck size={15} />,
          label: si ? "F28 ඉන්ධන portal එක සහ සාමාජික දීමනා" : "F28 fuel portal & member offers",
        },
      ]}
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSub}
    >
      {done ? (
        <div className="auth-success-panel" role="status" aria-live="polite">
          <AuthSuccessMark compact />
          <div className="text-[17px] font-extrabold text-emerald-900">
            {si ? "ලියාපදිංචිය සාර්ථකයි!" : "Registration successful!"}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-emerald-800/75">
            {si ? "දැන් ඔබට sign in කර ඔබේ ගිණුමට ප්‍රවේශ විය හැක." : "You can now sign in and access your account."}
          </p>
          <Link href="/signin" className="btn btn-primary auth-submit-btn mt-5 w-full">
            {t.auth.signinBtn}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-form space-y-4" aria-busy={busy}>
          <div className="auth-field-block">
            <div className="auth-label-row">
              <label htmlFor="register-full-name" className="auth-label">
                {t.auth.fullname} *
              </label>
            </div>
            <div className="auth-control">
              <span className="auth-control-icon" aria-hidden="true">
                <UserRound size={18} />
              </span>
              <input
                id="register-full-name"
                name="full_name"
                required
                autoComplete="name"
                className="field auth-input has-leading-icon"
                placeholder="e.g. Maduranga"
              />
            </div>
          </div>

          <div className="auth-field-block">
            <div className="auth-label-row">
              <label htmlFor="register-nic" className="auth-label">
                {t.auth.nic} *
              </label>
            </div>
            <div className="auth-control">
              <span className="auth-control-icon" aria-hidden="true">
                <BadgeCheck size={18} />
              </span>
              <input
                id="register-nic"
                name="nic"
                required
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                className="field auth-input has-leading-icon"
                placeholder="E.G. 123456789V OR 123456789012"
              />
            </div>
          </div>

          <div className="auth-field-block">
            <div className="auth-label-row">
              <label htmlFor="register-phone" className="auth-label">
                {t.auth.phone} *
              </label>
            </div>
            <div className="auth-control">
              <span className="auth-control-icon" aria-hidden="true">
                <Phone size={18} />
              </span>
              <input
                id="register-phone"
                name="phone"
                required
                autoComplete="tel"
                inputMode="tel"
                className="field auth-input has-leading-icon"
                placeholder="07X XXXXXXX"
              />
            </div>
          </div>

          <div className="auth-field-block">
            <div className="auth-label-row">
              <label htmlFor="register-password" className="auth-label">
                {t.auth.password} *
              </label>
            </div>
            <div className={`auth-control${showPassword ? " is-password-visible" : ""}`}>
              <span className="auth-control-icon" aria-hidden="true">
                <Lock size={18} />
              </span>
              <input
                id="register-password"
                name="password"
                required
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="field auth-input has-leading-icon has-trailing-action"
                placeholder="••••••••"
              />
              <PasswordVisibilityButton
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                showLabel={si ? "මුරපදය පෙන්වන්න" : "Show password"}
                hideLabel={si ? "මුරපදය සඟවන්න" : "Hide password"}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              {si ? "අවම අකුරු 6ක් සහිත, පහසුවෙන් අනුමාන කළ නොහැකි මුරපදයක් තෝරන්න." : "Use at least 6 characters and avoid an easy-to-guess password."}
            </p>
          </div>

          <div className="auth-field-block">
            <div className="auth-label-row">
              <label htmlFor="register-confirm-password" className="auth-label">
                {t.auth.confirm} *
              </label>
            </div>
            <div className={`auth-control${showConfirm ? " is-password-visible" : ""}`}>
              <span className="auth-control-icon" aria-hidden="true">
                <Lock size={18} />
              </span>
              <input
                id="register-confirm-password"
                name="confirm"
                required
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                className="field auth-input has-leading-icon has-trailing-action"
                placeholder="••••••••"
              />
              <PasswordVisibilityButton
                visible={showConfirm}
                onToggle={() => setShowConfirm((value) => !value)}
                showLabel={si ? "තහවුරු කිරීමේ මුරපදය පෙන්වන්න" : "Show confirmation password"}
                hideLabel={si ? "තහවුරු කිරීමේ මුරපදය සඟවන්න" : "Hide confirmation password"}
              />
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary auth-submit-btn w-full !text-[14px]">
            {busy ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>{si ? "ගිණුම හදමින්…" : "Creating account…"}</span>
              </>
            ) : (
              <>
                <UserPlus size={17} />
                <span>{t.auth.registerBtn}</span>
              </>
            )}
          </button>

          <div className="auth-trust-row !mt-1">
            <ShieldCheck size={13} />
            {si ? "ඔබේ දත්ත ආරක්ෂිතව ගබඩා වේ" : "Your data is stored securely"}
          </div>
        </form>
      )}

      {!done && (
        <div className="auth-switch-card">
          {t.auth.haveAccount}{" "}
          <Link href="/signin">{t.auth.signinHere}</Link>
        </div>
      )}
    </AuthShell>
  );
}
