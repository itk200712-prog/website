"use client";

// ============================================================================
// My Profile — Profile & Security Management
// password update = auth.users + profiles.password_display දෙකම යාවත්කාලීන වේ
// ============================================================================

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Save, ShieldCheck, UserRound } from "lucide-react";
import { AdminTopbar, dbUpdate, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import { decodePw, encodePw } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export default function AdminProfilePage() {
  const { show, node } = useNotice();
  const [showPw, setShowPw] = useState(false);

  const [uid, setUid] = useState("");
  const [role, setRole] = useState("admin");
  const [fullName, setFullName] = useState("");
  const [nic, setNic] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sb = await authedClient();
        const { data: u } = await sb.auth.getUser();
        if (!u?.user) return;
        setUid(u.user.id);
        const { data: prof } = await sb.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
        if (prof) {
          setFullName(prof.full_name ?? "");
          setNic(prof.nic ?? "");
          setPhone(prof.phone ?? "");
          setEmail(prof.auth_email ?? u.user.email ?? "");
          setRole(prof.role ?? "admin");
          setCurrentPw(decodePw(prof.password_display ?? ""));
        }
      } catch { /* ignore */ }
    })();
  }, []);

  async function saveProfile() {
    if (!uid) return;
    const err = await dbUpdate("profiles", { id: uid }, { full_name: fullName, nic, phone, auth_email: email });
    show(err ? `⚠ ${err}` : "✅ Profile saved");
  }

  async function updatePassword() {
    if (!uid) return show("⚠ Login වෙලා නෑ");
    if (newPw.length < 8) return show("⚠ අලුත් password එක අවම අකුරු 8ක් විය යුතුයි");
    if (newPw !== confirmPw) return show("⚠ අලුත් password දෙක ගැලපෙන්නෙ නෑ");
    setBusy(true);
    try {
      const sb = await authedClient();
      // 1) login password එක සැබෑ ලෙස වෙනස්
      const { error: authErr } = await sb.auth.updateUser({ password: newPw });
      if (authErr) {
        setBusy(false);
        return show(`⚠ ${authErr.message}`);
      }
      // 2) admin view එකේ "current password" එකට නව එක සුරකින්න (persist!)
      const err = await dbUpdate("profiles", { id: uid }, { password_display: encodePw(newPw) });
      if (err) {
        setBusy(false);
        return show(`⚠ ${err}`);
      }
      void logActivity("PASSWORD_CHANGE", "admin login password changed");
      setCurrentPw(newPw); // refresh නැතුවම current password field එකේ අලුත් එක පේනවා
      setNewPw("");
      setConfirmPw("");
      show("✅ Password updated — දැන් නව password එකෙන් login විය හැක (refresh කළත් නව එක ම තමයි)");
    } catch (e) {
      show(`⚠ ${(e as Error).message}`);
    }
    setBusy(false);
  }

  function generatePw() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!";
    let out = "";
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setNewPw(out);
    setConfirmPw(out);
    setShowPw(true);
  }

  return (
    <div>
      <AdminTopbar title="Profile & Security Management" sub="Update your personal credentials, contact information, and account security password" />
      {node}

      {/* header card */}
      <div className="card p-6 mb-6 border-l-4 border-indigo-600">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-extrabold text-slate-900">{fullName || "Administrator"}</span>
                <span className="badge-amber rounded-full px-3 py-1 text-[10px] font-black tracking-wider uppercase">{role}</span>
              </div>
              <div className="text-slate-500 text-[13px] mt-0.5">{email || "—"}</div>
            </div>
          </div>
          <span className="badge-green rounded-full px-4 py-2 text-[12px] font-bold">● Active Authenticated Session</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* personal info */}
        <div className="card p-6">
          <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-[16px]">
            <UserRound size={19} className="text-indigo-700" /> Personal &amp; Contact Information
          </div>
          <p className="text-slate-400 text-[11.5px] mt-1">Update your administrator profile attributes</p>
          <div className="border-t border-slate-100 my-5" />
          <div className="space-y-4">
            <div>
              <label className="field-label">Full Name *</label>
              <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">National Identity Card (NIC)</label>
              <input className="field" value={nic} onChange={(e) => setNic(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Phone Number</label>
              <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Official Email Address</label>
              <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" onClick={saveProfile}>
              <Save size={16} /> Save Profile Changes
            </button>
          </div>
        </div>

        {/* security */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-[16px]">
              <KeyRound size={19} className="text-amber-600" /> Security &amp; Password Management
            </div>
            <button className="btn btn-amber !py-1.5 !px-3.5 !text-[11.5px]" onClick={generatePw}>
              ✨ Generate
            </button>
          </div>
          <p className="text-slate-400 text-[11.5px] mt-1">Update your administrator login password</p>
          <div className="border-t border-slate-100 my-5" />
          <div className="space-y-4">
            <div>
              <label className="field-label">Current Password *</label>
              <div className="relative">
                <input className="field !pr-11" type={showPw ? "text" : "password"} value={currentPw} readOnly />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <div>
              <label className="field-label">New Password *</label>
              <input className="field" type={showPw ? "text" : "password"} placeholder="Minimum 8 characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Confirm New Password *</label>
              <input className="field" type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            <button className="btn btn-amber w-full disabled:opacity-60" disabled={busy} onClick={updatePassword}>
              <Lock size={16} /> {busy ? "Updating…" : "Update Password"}
            </button>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-[11px] text-emerald-800 leading-relaxed">
              ✅ Update කළාම <b>login password එකත්</b> මෙතන පේන <b>Current Password එකත්</b> දෙකම සැබෑ ලෙස වෙනස් වේ — refresh කළත් නව password එක ම තමයි පේන්නෙ.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
