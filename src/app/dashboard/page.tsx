"use client";

// ============================================================================
// User Dashboard — login වූ member කෙනෙකුගේ dashboard එක
//   Profile: Name + NIC + Password Change · F28 (authenticate කරපු අයට පමනක්!)
// ============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Eye, EyeOff, FileSpreadsheet, Home, KeyRound, Lock, LogOut, Save, UserRound } from "lucide-react";
import { authedClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";
import { logout } from "@/lib/auth";
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
  avatar: string;
}

export default function DashboardPage() {
  const r = useRouter();
  const { lang } = useLang();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [avatarMsg, setAvatarMsg] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

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
        avatar: (prof?.avatar_url as string) || "",
      });
      setCurrentPw(decodePw(prof?.password_display ?? ""));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ profile photo upload — storage එකට දාලා profiles.avatar_url save කරනවා
  async function uploadAvatar(file: File) {
    if (!me) return;
    if (!file.type.startsWith("image/")) {
      setAvatarMsg("⚠ Image file එකක් තෝරන්න (jpg / png)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg("⚠ 5MB ට වඩා පොඩි image එකක් තෝරන්න");
      return;
    }
    setAvatarBusy(true);
    setAvatarMsg("");
    try {
      const sb = await authedClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `avatars/${me.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from("site-images").upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const url = sb.storage.from("site-images").getPublicUrl(path).data.publicUrl;
      const { error: dbErr } = await sb.from("profiles").update({ avatar_url: url }).eq("id", me.id);
      if (dbErr) {
        setAvatarMsg("⚠ SQL §18 (avatar_url column) run කරලා නෑ — Supabase SQL Editor එකේ run කරන්න");
        setAvatarBusy(false);
        return;
      }
      setMe({ ...me, avatar: url });
      setAvatarMsg("✅ Profile photo එක update විය!");
    } catch {
      setAvatarMsg("⚠ Photo upload කරන්න බැරි විය — නැවත උත්සාහ කරන්න");
    }
    setAvatarBusy(false);
  }

  async function removeAvatar() {
    if (!me) return;
    setAvatarBusy(true);
    try {
      const sb = await authedClient();
      await sb.from("profiles").update({ avatar_url: "" }).eq("id", me.id);
      setMe({ ...me, avatar: "" });
      setAvatarMsg("✅ Photo එක ඉවත් කළා");
    } catch {
      setAvatarMsg("⚠ ඉවත් කරන්න බැරි විය");
    }
    setAvatarBusy(false);
  }

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
            <Link href={`/${lang}/dashboard`} className="btn btn-primary !bg-white !text-slate-900 hover:!bg-slate-100">
              <Home size={15} /> Dashboard
            </Link>
            {me?.f28 && (
              <Link href={`/${lang}/dashboard/f28`} className="btn btn-primary !bg-amber-400 !text-amber-950 hover:!bg-amber-300">
                <FileSpreadsheet size={15} /> F28
              </Link>
            )}
            <button
              className="btn btn-outline !text-white/90 !border-white/30 hover:!bg-white/10"
              onClick={async () => {
                await logout("/");
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
            <div className="flex items-center gap-4">
              {/* ✅ avatar ball — photo එක පොඩිවට */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white flex items-center justify-center text-xl font-black ring-4 ring-white shadow-lg">
                  {me?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.avatar} alt={me.full_name} className="w-full h-full object-cover" />
                  ) : (
                    (me?.full_name || "M").trim().charAt(0).toUpperCase()
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center cursor-pointer shadow-md transition-colors" title="Photo එකක් දාන්න">
                  <Camera size={13} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={avatarBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAvatar(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-900">My Profile</h3>
                <p className="mt-0.5 text-slate-500 text-[12.5px] truncate">{me?.full_name} · {me?.nic}</p>
                <p className="text-slate-500 text-[12.5px]">{me?.phone}</p>
              </div>
            </div>
            {avatarBusy && <div className="mt-3 text-[11.5px] font-semibold text-indigo-600">Uploading…</div>}
            {!avatarBusy && avatarMsg && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-[11.5px] font-semibold ${avatarMsg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                {avatarMsg}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="btn btn-outline !py-1.5 !px-3 !text-[11.5px] cursor-pointer">
                <Camera size={13} /> {me?.avatar ? "Photo එක වෙනස් කරන්න" : "Photo එකක් දාන්න"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={avatarBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {me?.avatar && (
                <button className="btn btn-outline !py-1.5 !px-3 !text-[11.5px] !text-rose-600 !border-rose-200 hover:!bg-rose-50" disabled={avatarBusy} onClick={removeAvatar}>
                  ඉවත් කරන්න
                </button>
              )}
            </div>
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
