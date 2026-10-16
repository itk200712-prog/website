"use client";

// ============================================================================
// User Dashboard — login වූ member කෙනෙකුගේ dashboard එක
//   Profile: Name + NIC + Password Change · F28 (authenticate කරපු අයට පමනක්!)
// ============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, FileSpreadsheet, Home, KeyRound, Lock, LogOut, Save, UserRound } from "lucide-react";
import { authedClient, clearTokens } from "@/lib/supabase/client";
import { decodePw, encodePw } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

interface Me {
  id: string;
  full_name: string;
  nic: string;
  role: string;
  phone: string;
  f28: boolean;
}

export default function DashboardPage() {
  const r = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const sb = await authedClient();
      const { data: u } = await sb.auth.getUser();
      if (!u?.user) {
        r.replace("/signin");
        return;
      }
      const { data: prof } = await sb.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      const { data: f28 } = await sb.from("f28_members").select("status").eq("user_id", u.user.id).maybeSingle();
      setMe({
        id: u.user.id,
        full_name: (prof?.full_name as string) || u.user.email || "Member",
        nic: (prof?.nic as string) || "",
        role: (prof?.role as string) || "member",
        phone: (prof?.phone as string) || "",
        f28: f28?.status === "active",
      });
      setCurrentPw(decodePw(prof?.password_display ?? ""));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changePassword() {
    if (!me) return;
    if (newPw.length < 8) return setMsg("⚠ අලුත් password එක අවම අකුරු 8ක් විය යුතුයි");
    if (newPw !== confirmPw) return setMsg("⚠ අලුත් password දෙක ගැලපෙන්නෙ නෑ");
    setBusy(true);
    setMsg("");
    try {
      const sb = await authedClient();
      const { error: authErr } = await sb.auth.updateUser({ password: newPw });
      if (authErr) {
        setMsg(`⚠ ${authErr.message}`);
        setBusy(false);
        return;
      }
      const { error: dbErr } = await sb.from("profiles").update({ password_display: encodePw(newPw) }).eq("id", me.id);
      if (dbErr) {
        setMsg(`⚠ ${dbErr.message}`);
        setBusy(false);
        return;
      }
      setCurrentPw(newPw);
      setNewPw("");
      setConfirmPw("");
      setMsg("✅ Password එක වෙනස් කළා — දැන් නව password එකෙන් login විය හැක!");
    } catch (e) {
      setMsg(`⚠ ${(e as Error).message}`);
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-[13px] font-semibold">Loading dashboard...</div>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <section className="hero-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="section-badge !text-amber-300">USER DASHBOARD</div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black">ආයුබෝවන්, {me?.full_name}!</h1>
          <p className="mt-2 text-slate-300 text-[13.5px]">NIC: {me?.nic} · {me?.role}</p>

          {/* ✅ උඩ section එකේ options — F28 authenticate කරපු අයට පමනක් */}
          <div className="flex flex-wrap gap-2.5 mt-6">
            <Link href="/dashboard" className="btn btn-primary !bg-white !text-slate-900 hover:!bg-slate-100">
              <Home size={15} /> Dashboard
            </Link>
            {me?.f28 && (
              <Link href="/dashboard/f28" className="btn btn-primary !bg-amber-400 !text-amber-950 hover:!bg-amber-300">
                <FileSpreadsheet size={15} /> F28
              </Link>
            )}
            <button
              className="btn btn-outline !text-white/90 !border-white/30 hover:!bg-white/10"
              onClick={async () => {
                const sb = await authedClient();
                await sb.auth.signOut();
                clearTokens();
                window.location.href = "/";
              }}
            >
              <LogOut size={15} /> Log Out
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-6">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><UserRound size={20} /></div>
            <h3 className="mt-3 font-extrabold text-slate-900">My Profile</h3>
            <p className="mt-1 text-slate-500 text-[12.5px]">{me?.full_name} · {me?.nic}</p>
            <p className="text-slate-500 text-[12.5px]">{me?.phone}</p>
          </div>
          <div className="card p-6">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center"><FileSpreadsheet size={20} /></div>
            <h3 className="mt-3 font-extrabold text-slate-900">F28 — සමිතියේ ගිනුම්</h3>
            {me?.f28 ? (
              <p className="mt-1 text-emerald-600 text-[12.5px] font-semibold">ඔබට access තියෙනවා — උඩ F28 button එකෙන් බලන්න.</p>
            ) : (
              <p className="mt-1 text-slate-400 text-[12.5px] flex items-center gap-1.5"><Lock size={13} /> මේ අංශය තෝරාගත් සාමාජිකයන්ට පමනක්.</p>
            )}
          </div>
          <div className="card p-6">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Home size={20} /></div>
            <h3 className="mt-3 font-extrabold text-slate-900">Website</h3>
            <p className="mt-1 text-slate-500 text-[12.5px]">සමිතියේ නවතම පුවත්, සේවා සහ තොරතුරු බලන්න.</p>
            <Link href="/si" className="btn btn-outline mt-3 !py-1.5 !text-[12px]">වෙබ් අඩවිය →</Link>
          </div>
        </div>

        {/* ✅ Profile details + password change */}
        <div className="grid gap-5 lg:grid-cols-2 mt-6">
          <div className="card p-6">
            <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-[16px]">
              <UserRound size={19} className="text-indigo-700" /> මගේ විස්තර (My Details)
            </div>
            <div className="border-t border-slate-100 my-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Name</span>
                <span className="text-[13.5px] font-extrabold text-slate-900">{me?.full_name || "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">NIC</span>
                <span className="text-[13.5px] font-extrabold text-slate-900 tabular-nums">{me?.nic || "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Phone</span>
                <span className="text-[13.5px] font-extrabold text-slate-900 tabular-nums">{me?.phone || "—"}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-[16px]">
              <KeyRound size={19} className="text-amber-600" /> Password එක වෙනස් කරන්න
            </div>
            <div className="border-t border-slate-100 my-4" />
            <div className="space-y-3.5">
              <div>
                <label className="field-label">දැනට තියෙන Password එක</label>
                <div className="relative">
                  <input className="field !pr-11" type={showPw ? "text" : "password"} value={currentPw} readOnly />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label">අලුත් Password එක *</label>
                <input className="field" type={showPw ? "text" : "password"} placeholder="අවම අකුරු 8ක්" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <div>
                <label className="field-label">අලුත් Password එක ආයේ *</label>
                <input className="field" type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
              </div>
              {msg && (
                <div className={`rounded-xl px-4 py-2.5 text-[11.5px] font-semibold ${msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                  {msg}
                </div>
              )}
              <button className="btn btn-amber w-full disabled:opacity-60" disabled={busy} onClick={changePassword}>
                <Save size={16} /> {busy ? "Updating…" : "Password එක වෙනස් කරන්න"}
              </button>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
