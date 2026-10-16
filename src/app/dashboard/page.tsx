"use client";

// ============================================================================
// User Dashboard — login වූ member කෙනෙකුගේ dashboard එක
//   උඩ section එකේ options: Dashboard | F28 (authenticate කරපු අයට පමනක්!)
// ============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileSpreadsheet, Home, Lock, LogOut, UserRound } from "lucide-react";
import { authedClient, clearTokens } from "@/lib/supabase/client";
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
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      </section>
      <SiteFooter />
    </>
  );
}
