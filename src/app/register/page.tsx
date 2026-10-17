"use client";

// ============================================================================
// Register — member registration (professional split layout)
// ============================================================================

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, Eye, EyeOff, ShieldCheck, Sparkles, UserPlus, UsersRound } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { registerMember, validateNic, validatePassword, validatePhone } from "@/lib/auth";

const SITE_REG = "කුරු/186";

export default function RegisterPage() {
  const { t, lang } = useLang();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
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
    setBusy(true);
    const { error: err } = await registerMember({
      full_name: String(fd.get("full_name")),
      nic: String(fd.get("nic")),
      phone: String(fd.get("phone")),
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
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* ================= branding panel ================= */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero/hero-1.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, rgba(11,18,48,0.94) 0%, rgba(23,37,84,0.86) 55%, rgba(30,42,120,0.72) 100%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white flex items-center justify-center text-[11px] font-black tracking-wide shadow">
            coop
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-white text-[14px]">{t.brand}</div>
            <div className="text-[9.5px] text-white/60 tracking-wide uppercase">Panduwasnuwara New MPCS</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-black leading-tight">
            {lang === "si" ? "සාමාජිකයෙකු වන්න" : "Become a Member"}
          </h2>
          <p className="mt-4 text-white/75 text-[14px] leading-relaxed">
            {lang === "si"
              ? "නිල සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිති සාමාජික ගිණුම නිර්මාණය කර සියලු සේවාවන්ට ප්‍රවේශ වන්න."
              : "Create your official Panduwasnuwara New MPCS member account and get access to every society service."}
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: <Sparkles size={16} />, en: "Free official member account", si: "නොමිලේ නිල සාමාජික ගිණුමක්" },
              { icon: <UsersRound size={16} />, en: "Member directory & voter eligibility", si: "සාමාජික ලේඛනය සහ ඡන්ද සුදුසුකම්" },
              { icon: <BadgeCheck size={16} />, en: "F28 fuel portal & member offers", si: "F28 ඉන්ධන portal එක සහ සාමාජික දීමනා" },
            ].map((f) => (
              <div key={f.en} className="flex items-center gap-3 text-white/85 text-[13px]">
                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-300 shrink-0">
                  {f.icon}
                </div>
                {lang === "si" ? f.si : f.en}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-[11px] text-white/50">
          © {new Date().getFullYear()} Panduwasnuwara New Multi Purpose Co-Operative Society LTD · {SITE_REG}
        </div>
      </div>

      {/* ================= form panel ================= */}
      <div className="relative flex items-center justify-center p-5 sm:p-10 bg-slate-50 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute bottom-[-6rem] -left-24 w-96 h-96 rounded-full bg-fuchsia-200/35 blur-3xl" />
        <div className="relative w-full max-w-[430px]">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 text-[12.5px] font-semibold hover:text-slate-800 transition-colors">
            <ArrowLeft size={15} /> {t.auth.backHome}
          </Link>

          <div className="mt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                <UserPlus size={21} />
              </div>
              <div>
                <h1 className="text-[26px] font-extrabold text-slate-900 leading-tight">{t.auth.registerTitle}</h1>
                <p className="text-slate-500 text-[12.5px]">{t.auth.registerSub}</p>
              </div>
            </div>
          </div>

          {done ? (
            <div className="mt-8 rounded-2xl bg-emerald-50 border border-emerald-200 p-7 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <BadgeCheck size={28} />
              </div>
              <div className="font-extrabold text-emerald-800 text-[16px] mt-3">Registration successful! / ලියාපදිංචිය සාර්ථකයි!</div>
              <p className="text-emerald-700/80 text-[12.5px] mt-1.5">
                {lang === "si" ? "දැන් ඔබට sign in කර ඔබේ ගිණුමට ප්‍රවේශ විය හැක." : "You can now sign in and access your account."}
              </p>
              <Link href="/signin" className="btn btn-primary mt-5 w-full !py-3">
                {t.auth.signinBtn}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="field-label">{t.auth.fullname} *</label>
                <input name="full_name" required className="field !py-3 !text-[14px]" placeholder="e.g. Induwara Perera" />
              </div>
              <div>
                <label className="field-label">{t.auth.nic} *</label>
                <input name="nic" required className="field !py-3 !text-[14px]" placeholder="E.G. 200478922123 OR 851234567V" />
              </div>
              <div>
                <label className="field-label">{t.auth.phone} *</label>
                <input name="phone" required className="field !py-3 !text-[14px]" placeholder="07X XXXXXXX" />
              </div>
              <div>
                <label className="field-label">{t.auth.password} *</label>
                <div className="relative">
                  <input name="password" required type={show ? "text" : "password"} className="field !pr-11 !py-3 !text-[14px]" placeholder="••••••••" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShow(!show)}>
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label">{t.auth.confirm} *</label>
                <input name="confirm" required type={show ? "text" : "password"} className="field !py-3 !text-[14px]" placeholder="••••••••" />
              </div>
              {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12.5px] px-4 py-2.5">{error}</div>}
              <button type="submit" disabled={busy} className="btn btn-primary w-full !py-3 !text-[14px]">
                {busy ? "..." : t.auth.registerBtn}
              </button>
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
                <ShieldCheck size={13} className="text-emerald-500" />
                {lang === "si" ? "ඔබේ දත්ත ආරක්ෂිතව ගබඩා වේ" : "Your data is stored securely"}
              </div>
            </form>
          )}

          <div className="mt-7 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center">
            <div className="text-[13px] text-slate-500">
              {t.auth.haveAccount}{" "}
              <Link href="/signin" className="text-indigo-700 font-bold hover:underline">
                {t.auth.signinHere}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
