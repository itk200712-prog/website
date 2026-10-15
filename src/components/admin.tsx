"use client";

// ============================================================================
// Admin shared helpers — sidebar nav, stat cards, CRUD (Supabase + fallback)
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Building2, Database, ExternalLink, Fuel, Gauge, Images, LayoutDashboard, LogOut,
  Mail, Megaphone, Newspaper, Settings, ShieldCheck, UserRound, UsersRound, X,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

/* --------------------------------------------------------------- sidebar -- */
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, badge: "" },
  { href: "/admin/profile", label: "My Profile", icon: UserRound, badge: "SUPER" },
  { href: "/admin/members", label: "Registered Members", icon: UsersRound, badge: "2" },
  { href: "/admin/administrators", label: "Administrators", icon: ShieldCheck, badge: "SUPER" },
  { href: "/admin/applications", label: "Membership Applications", icon: Megaphone, badge: "0" },
  { href: "/admin/data", label: "Data & Live Metrics", icon: Database, badge: "" },
  { href: "/admin/board", label: "Board of Directors", icon: UsersRound, badge: "9" },
  { href: "/admin/news", label: "News & Notices", icon: Newspaper, badge: "3" },
  { href: "/admin/gallery", label: "Gallery Moderation", icon: Images, badge: "1" },
  { href: "/admin/messages", label: "Messages & Inquiries", icon: Mail, badge: "0" },
  { href: "/admin/businesses", label: "Businesses & Services", icon: Building2, badge: "" },
  { href: "/admin/fuel-prices", label: "Fuel Prices", icon: Fuel, badge: "" },
  { href: "/admin/settings", label: "System Settings", icon: Settings, badge: "" },
];

export function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="w-[250px] shrink-0 bg-[#0b1029] text-white min-h-screen sticky top-0 flex flex-col no-print">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white flex items-center justify-center text-[9px] font-black">
          coop
        </div>
        <div>
          <div className="font-extrabold text-[13px] leading-tight">PANDUWASNUWARA</div>
          <div className="text-[10px] text-slate-400">Admin Console</div>
        </div>
      </div>
      <div className="px-5 pt-4 pb-2 text-[9.5px] font-bold tracking-[0.18em] text-slate-500">NAVIGATION</div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-6">
        {NAV.map((n) => {
          const active = path === n.href;
          return (
            <Link key={n.href} href={n.href} className={`admin-nav-item ${active ? "active" : ""}`}>
              <n.icon size={16} />
              <span className="flex-1">{n.label}</span>
              {n.badge && (
                <span
                  className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${
                    n.badge === "SUPER" ? "bg-indigo-500/30 text-indigo-200" : "bg-white/10 text-slate-300"
                  }`}
                >
                  {n.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdminTopbar({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        <p className="text-slate-500 text-[12.5px] mt-0.5">{sub}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <a href="/" className="btn btn-outline !py-2 !px-3.5 !text-[12px]">
          <ExternalLink size={14} /> Live Website
        </a>
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[11px] font-black">SA</div>
          <div className="leading-tight">
            <div className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5">
              Super Administrator
              <span className="badge-amber rounded-full px-1.5 py-0.5 text-[8px] font-black">SUPER</span>
            </div>
            <div className="text-[10px] text-slate-400">superadmin</div>
          </div>
        </div>
        <button
          onClick={() => (window.location.href = "/")}
          className="btn btn-outline !py-2 !px-3.5 !text-[12px] !text-red-600 !border-red-200 hover:!bg-red-50"
        >
          <LogOut size={14} /> Log Out
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- cards -- */
export function AdminStatCard({
  tag, value, label, sub, icon, tone = "blue",
}: {
  tag: string; value: string; label: string; sub?: string; icon: React.ReactNode; tone?: "blue" | "amber" | "green" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    blue: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-bold tracking-[0.16em] uppercase text-slate-400">{tag}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{value}</div>
      <div className="text-slate-700 text-[13px] font-semibold mt-0.5">{label}</div>
      {sub && <div className="text-slate-400 text-[11px] mt-1">{sub}</div>}
    </div>
  );
}

export function AdminModal({
  title, sub, onClose, children, wide,
}: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[95] bg-slate-900/70 flex items-start justify-center p-4 overflow-y-auto no-print">
      <div className={`card w-full ${wide ? "max-w-3xl" : "max-w-xl"} p-0 my-6`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-7 pt-7">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Gauge size={20} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
              {sub && <p className="text-slate-500 text-[12px]">{sub}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <X size={17} />
          </button>
        </div>
        <div className="px-7 pb-7 pt-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ CRUD -- */
export async function dbInsert(table: string, row: Record<string, unknown>): Promise<string | null> {
  if (!isSupabaseConfigured()) return "Supabase වින්‍යාස වී නොමැත — demo mode";
  try {
    const { data, error } = await createClient().from(table).insert(row).select("*");
    if (error) return error.message;
    if (!data || data.length === 0) return "row save වුණේ නෑ — login/permission පරීක්ෂා කරන්න";
    return null;
  } catch (e) {
    return String(e);
  }
}

export async function dbUpdate(
  table: string,
  match: Record<string, unknown>,
  patch: Record<string, unknown>
): Promise<string | null> {
  if (!isSupabaseConfigured()) return "Supabase වින්‍යාස වී නොමැත — demo mode";
  try {
    let q = createClient().from(table).update(patch);
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { data, error } = await q.select("*");
    if (error) return error.message;
    if (!data || data.length === 0) return "rows 0ක් update වුණා — login/permission පරීක්ෂා කරන්න";
    return null;
  } catch (e) {
    return String(e);
  }
}

/** key-value table (e.g. system_settings) සඳහා upsert — row නැත්නම් නව එකක් හැදේ */
export async function dbUpsert(
  table: string,
  row: Record<string, unknown>,
  onConflict = "key"
): Promise<string | null> {
  if (!isSupabaseConfigured()) return "Supabase වින්‍යාස වී නොමැත — demo mode";
  try {
    const { error } = await createClient().from(table).upsert(row, { onConflict });
    return error ? error.message : null;
  } catch (e) {
    return String(e);
  }
}

export async function dbDelete(table: string, match: Record<string, unknown>): Promise<string | null> {
  if (!isSupabaseConfigured()) return "Supabase වින්‍යාස වී නොමැත — demo mode";
  try {
    let q = createClient().from(table).delete();
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { data, error } = await q.select("*");
    if (error) return error.message;
    if (!data || data.length === 0) return "delete වුණේ නෑ — row එක හමු නොවුණා/permission නෑ";
    return null;
  } catch (e) {
    return String(e);
  }
}

export function useNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  const show = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 3500);
  };
  const node = notice ? (
    <div className="fixed bottom-5 right-5 z-[99] rounded-2xl bg-slate-900 text-white text-[13px] px-5 py-3.5 shadow-2xl">
      {notice}
    </div>
  ) : null;
  return { show, node };
}

export const adminIcons = { BarChart3, Building2, Database, Fuel, Images, Mail, Megaphone, Newspaper, Settings, UserRound, UsersRound };
