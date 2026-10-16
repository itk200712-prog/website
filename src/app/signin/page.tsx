"use client";

// ============================================================================
// Sign In — NIC + password login + WhatsApp password recovery
// ============================================================================

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, MessageCircle, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { loginWithNic } from "@/lib/auth";

export default function SignInPage() {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waOpen, setWaOpen] = useState(false);

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
    window.location.href = role === "superadmin" || role === "admin" ? "/admin" : "/dashboard";
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 sm:p-10">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 text-[13px] font-semibold hover:text-slate-800">
          <ArrowLeft size={15} /> {t.auth.backHome}
        </Link>
        <div className="flex flex-col items-center mt-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Lock size={24} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-slate-900">{t.auth.signinTitle}</h1>
          <p className="text-slate-500 text-[13px] mt-1.5">{t.auth.signinSub}</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="field-label">{t.auth.nic}</label>
            <input name="nic" required className="field" placeholder="e.g. 200478922123 or 851234567V" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="field-label">{t.auth.password}</label>
              <button type="button" onClick={() => setWaOpen(true)} className="text-indigo-700 text-[12px] font-bold hover:underline">
                {t.auth.forgot}
              </button>
            </div>
            <div className="relative">
              <input name="password" required type={show ? "text" : "password"} className="field !pr-11" placeholder="••••••••" />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12.5px] px-4 py-2.5">{error}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            <LogIn size={16} /> {busy ? "..." : t.auth.signinBtn}
          </button>
        </form>

        <div className="mt-6 text-center text-[13px] text-slate-500">
          {t.auth.noAccount}{" "}
          <Link href="/register" className="text-indigo-700 font-bold hover:underline">
            {t.auth.registerHere}
          </Link>
        </div>
      </div>

      {/* WhatsApp recovery modal */}
      {waOpen && <WhatsAppRecovery onClose={() => setWaOpen(false)} />}
    </div>
  );
}

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
