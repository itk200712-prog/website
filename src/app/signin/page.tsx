"use client";

// ============================================================================
// Sign In — NIC + password login + WhatsApp password recovery (professional split layout)
// ============================================================================

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Eye, EyeOff, Lock, LogIn, MessageCircle, ShieldCheck, UserRound, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { logActivity } from "@/lib/activity";
import { loginWithNic } from "@/lib/auth";

export default function SignInPage() {
  const { t, lang } = useLang();
  // ✅ දැනටම sign in වෙලා නම් signin page එක ලෝඩ් නොවී යන්න ඕන තැනට යවනවා
  const [checking, setChecking] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const { error: err, role } = await loginWithNic(String(fd.get("nic")), String(fd.get("password")));
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (role === "superadmin" || role === "admin") await logActivity("LOGIN", `logged in as ${role} (NIC: ${String(fd.get("nic"))})`);
    window.location.href = role === "superadmin" || role === "admin" ? "/admin" : "/";
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto w-10 h-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <div className="mt-3 text-[12px] font-semibold text-slate-500">{lang === "si" ? "පරීක්ෂා කරමින්…" : "Checking session…"}</div>
        </div>
      </div>
    );
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
            {lang === "si" ? "නැවත සාදරයෙන් පිළිගනිමු" : "Welcome Back"}
          </h2>
          <p className="mt-4 text-white/75 text-[14px] leading-relaxed">
            {lang === "si"
              ? "ඔබේ සාමාජික profile එක, F28 ඉන්ධන portal එක සහ පරිපාලන පැනල වෙත ප්‍රවේශ වීමට sign in කරන්න."
              : "Sign in to access your member profile, the F28 fuel portal, and administrative panels."}
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: <ShieldCheck size={16} />, en: "Secure NIC + password authentication", si: "ආරක්ෂිත NIC + මුරපද සත්‍යාපනය" },
              { icon: <UserRound size={16} />, en: "Member dashboard & profile management", si: "සාමාජික dashboard සහ profile කළමනාකරණය" },
              { icon: <BadgeCheck size={16} />, en: "Official society portal · Reg: කුරු/186", si: "නිල සමිති portal එක · ලියාපදිංචි: කුරු/186" },
            ].map((f) => (
              <div key={f.en} className="flex items-center gap-3 text-white/85 text-[13px]">
                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-emerald-300 shrink-0">
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
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                <Lock size={21} />
              </div>
              <div>
                <h1 className="text-[26px] font-extrabold text-slate-900 leading-tight">{t.auth.signinTitle}</h1>
                <p className="text-slate-500 text-[12.5px]">{t.auth.signinSub}</p>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="field-label">{t.auth.nic}</label>
              <input name="nic" required className="field !py-3 !text-[14px]" placeholder="e.g. 200478922123 or 851234567V" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="field-label">{t.auth.password}</label>
                <button type="button" onClick={() => setWaOpen(true)} className="text-indigo-700 text-[12px] font-bold hover:underline">
                  {t.auth.forgot}
                </button>
              </div>
              <div className="relative">
                <input name="password" required type={show ? "text" : "password"} className="field !pr-11 !py-3 !text-[14px]" placeholder="••••••••" />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12.5px] px-4 py-2.5">{error}</div>}
            <button type="submit" disabled={busy} className="btn btn-primary w-full !py-3 !text-[14px]">
              <LogIn size={17} /> {busy ? "..." : t.auth.signinBtn}
            </button>
          </form>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center">
            <div className="text-[13px] text-slate-500">
              {t.auth.noAccount}{" "}
              <Link href="/register" className="text-indigo-700 font-bold hover:underline">
                {t.auth.registerHere}
              </Link>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck size={13} className="text-emerald-500" />
            {lang === "si" ? "මෙය ආරක්ෂිත නිල ප්‍රවේශ portal එකකි" : "This is a secure official access portal"}
          </div>
        </div>
      </div>

      {/* WhatsApp recovery modal */}
      {waOpen && <WhatsAppRecovery onClose={() => setWaOpen(false)} />}
    </div>
  );
}

const SITE_REG = "කුරු/186";

function WhatsAppRecovery({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-[95] bg-slate-900/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle size={21} />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">{t.auth.waTitle}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <p className="text-slate-500 text-[12.5px] mt-3 leading-relaxed">{t.auth.waDesc}</p>

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
            <label className="field-label">{t.auth.fullname} *</label>
            <input name="name" required className="field" placeholder="e.g. Induwara Perera" />
          </div>
          <div>
            <label className="field-label">{t.auth.nic} *</label>
            <input name="nic" required className="field" placeholder="E.G. 200478922123 OR 851234567V" />
          </div>
          <div>
            <label className="field-label">{t.auth.phone} *</label>
            <input name="phone" required className="field" placeholder="e.g. 0764212345" />
          </div>
          <button type="submit" className="btn btn-green w-full">
            <MessageCircle size={16} /> {t.auth.waSend}
          </button>
        </form>
      </div>
    </div>
  );
}
