"use client";

// ============================================================================
// Admin shared helpers — sidebar nav, stat cards, CRUD (Supabase + fallback)
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Building2, Database, ExternalLink, Fuel, Gauge, Images, LayoutDashboard, Lock, LogOut, AtSign, Mail, Megaphone, Newspaper, Settings, ShieldCheck, Sparkles, UserRound, UsersRound, X, Save, Activity,
} from "lucide-react";
import { MessageImageIcon as MessageCircle } from "@/components/site-icons";
import { authedClient, createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { logout } from "@/lib/auth";
import { SiteLogoBadge } from "@/components/site-logo";
import { logActivity } from "@/lib/activity";

function brief(v: Record<string, unknown>): string {
  try {
    return Object.entries(v)
      .map(([k, x]) => `${k}=${String(x ?? "").slice(0, 40)}`)
      .join(", ")
      .slice(0, 300);
  } catch {
    return "";
  }
}

/* --------------------------------------------------------------- sidebar -- */
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, badge: "", key: "dashboard" },
  { href: "/admin/profile", label: "My Profile", icon: UserRound, badge: "", key: "profile" },
  { href: "/admin/members", label: "Registered Members", icon: UsersRound, badge: "", key: "members" },
  { href: "/admin/administrators", label: "Administrators", icon: ShieldCheck, badge: "SUPER", key: "administrators" },
  { href: "/admin/applications", label: "Membership Applications", icon: Megaphone, badge: "", key: "applications" },
  { href: "/admin/data", label: "Data & Live Metrics", icon: Database, badge: "", key: "data" },
  { href: "/admin/board", label: "Board of Directors", icon: UsersRound, badge: "", key: "board" },
  { href: "/admin/news", label: "News & Notices", icon: Newspaper, badge: "", key: "news" },
  { href: "/admin/gallery", label: "Gallery Moderation", icon: Images, badge: "", key: "gallery" },
  { href: "/admin/messages", label: "Messages & Inquiries", icon: Mail, badge: "", key: "messages" },
  { href: "/admin/emails", label: "Emails", icon: AtSign, badge: "", key: "emails" },
  { href: "/admin/live-chat", label: "Live Chat", icon: MessageCircle, badge: "", key: "livechat" },
  { href: "/admin/businesses", label: "Businesses & Services", icon: Building2, badge: "", key: "businesses" },
  { href: "/admin/animation", label: "Animation", icon: Sparkles, badge: "NEW", key: "animation" },
  { href: "/admin/fuel-prices", label: "Fuel Prices", icon: Fuel, badge: "", key: "fuel" },
  { href: "/admin/f28", label: "F28", icon: Lock, badge: "", key: "f28" },
  { href: "/admin/settings", label: "System Settings", icon: Settings, badge: "", key: "settings" },
  { href: "/admin/backup", label: "Backup & Restore", icon: Save, badge: "SUPER", key: "backup" },
  { href: "/admin/activities", label: "Activities", icon: Activity, badge: "", key: "activities" },
];

/** section keys ලෙස භාවිතා වේ (administrators page එකෙන් grant කරයි) */
export const SECTION_KEYS = NAV.map((n) => n.key).filter((k) => k !== "dashboard" && k !== "profile" && k !== "backup" && k !== "activities");

export function AdminSidebar() {
  const path = usePathname();
  const [allowed, setAllowed] = useState<string[] | null>(null); // null = loading
  const [isSuper, setIsSuper] = useState(false);
  const [navQ, setNavQ] = useState("");
  const [navSearchArmed, setNavSearchArmed] = useState(false);

  // Section එකක් මාරු කළාම panel search එක ඉබේම හිස් වෙනවා — කලින් search එක අලුත් පිටුවට රැඳෙන්නේ නෑ.
  // Search එක user අතින් focus කරන තෙක් readOnly නිසා browser/password-manager එකට
  // login නම (උදා: SUPERADMIN) auto-fill කරලා navigation එක හංගන්න බෑ.
  useEffect(() => {
    setNavQ("");
    setNavSearchArmed(false);
  }, [path]);

  // section permissions load (superadmin/empty = සේරම ඉඩ)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isSupabaseConfigured()) { setAllowed(null); return; }
      try {
        const sb = createClient();
        const { data: u } = await sb.auth.getUser();
        if (!u?.user) { setAllowed(null); return; }
        const { data: prof } = await sb.from("profiles").select("role, sections").eq("id", u.user.id).single();
        if (!alive) return;
        setIsSuper(prof?.role === "superadmin");
        if (prof?.role === "superadmin" || !prof?.sections) setAllowed(null);
        else setAllowed(prof.sections.split(",").map((s: string) => s.trim()).filter(Boolean));
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const items = NAV.filter((n) => {
    if (n.key === "backup") return isSuper; // superadmin only — never grantable
    if (n.key === "activities") return true; // සියලුම admins ලට පෙනේ (superadmin + section admins)
    return !allowed || allowed.length === 0 || n.key === "dashboard" || n.key === "profile" || allowed.includes(n.key);
  });

  return (
    <aside className="w-[218px] shrink-0 bg-[#0b1029] text-white min-h-screen sticky top-0 flex flex-col no-print">
      <Link href="/admin" className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10 hover:bg-white/5 transition-colors">
        <SiteLogoBadge size={32} className="!shadow-none" />
        <div className="min-w-0">
          <div className="font-extrabold text-[11px] leading-tight truncate">PANDUWASNUWARA</div>
          <div className="text-[8.5px] text-slate-400 tracking-wide">Admin Console</div>
        </div>
      </Link>
      <div className="px-4 pt-3.5 pb-1.5 text-[8.5px] font-bold tracking-[0.18em] text-slate-500">NAVIGATION</div>
      {/* ✅ quick search — focus කරන තෙක් readOnly + අලුත් field නම නිසා browser/password-manager එක
          login නම (උදා: SUPERADMIN) මේකට auto-fill කරලා navigation එක හංගන්නේ නෑ */}
      <div className="px-2.5 pb-2">
        <div className="relative">
          <input
            type="search"
            id="mpcs-panel-filter-7f3a"
            name="mpcs-panel-filter-7f3a"
            aria-label="Search admin panels"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={!navSearchArmed}
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            value={navQ}
            onFocus={(e) => {
              e.currentTarget.readOnly = false;
              setNavSearchArmed(true);
            }}
            onPointerDown={(e) => {
              e.currentTarget.readOnly = false;
              setNavSearchArmed(true);
            }}
            onChange={(e) => {
              const value = e.target.value;
              if (!navSearchArmed || value.trim().toLowerCase() === "superadmin") {
                setNavQ("");
                return;
              }
              setNavQ(value);
            }}
            placeholder="Search panels…"
            className="w-full rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-slate-500 text-[10.5px] pl-7 pr-2 py-1.5 outline-none focus:border-indigo-400/60 focus:bg-white/15"
          />
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        </div>
      </div>
      <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto pb-6">
        {items
          .filter((n) => !navQ.trim() || n.label.toLowerCase().includes(navQ.trim().toLowerCase()))
          .map((n) => {
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`admin-nav-item !text-[11.5px] !py-[7px] transition-all duration-150 ${active ? "active" : ""}`}
              >
                <n.icon size={14} className={active ? "text-amber-300" : ""} />
                <span className="flex-1">{n.label}</span>
                {n.badge && (
                  <span className="text-[8px] font-bold rounded-full px-1.5 py-0.5 bg-indigo-500/30 text-indigo-200">{n.badge}</span>
                )}
              </Link>
            );
          })}
      </nav>
      <div className="px-3 py-3 border-t border-white/10 text-[8.5px] text-slate-500">
        © {new Date().getFullYear()} Panduwasnuwara MPCS
      </div>
    </aside>
  );
}

export function AdminTopbar({ title, sub }: { title: string; sub: string }) {
  // ✅ hardcoded නම වෙනුවට sign-in වී ඉන්න සැබෑ admin ගේ නම + role + photo
  const [who, setWho] = useState<{ name: string; role: string; avatar: string }>({ name: "", role: "", avatar: "" });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = await authedClient();
        const { data: u } = await sb.auth.getUser();
        if (!u?.user) return;
        const { data: prof } = await sb.from("profiles").select("full_name, role, avatar_url").eq("id", u.user.id).maybeSingle();
        if (!alive) return;
        setWho({
          name: (prof as { full_name?: string } | null)?.full_name || u.user.email || "Administrator",
          role: (prof as { role?: string } | null)?.role || "admin",
          avatar: (prof as { avatar_url?: string } | null)?.avatar_url || "",
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const initials = (who.name || "A").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        <p className="text-slate-500 text-[12.5px] mt-0.5">{sub}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <a href="/" target="_blank" rel="noreferrer" className="btn btn-outline !py-2 !px-3.5 !text-[12px]">
          <ExternalLink size={14} /> Live Website
        </a>
        <a href="/admin/profile" className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 hover:border-indigo-300 transition-colors">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-900 text-white flex items-center justify-center text-[11px] font-black shrink-0">
            {who.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={who.avatar} alt={who.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5 max-w-[160px]">
              <span className="truncate">{who.name || "Loading…"}</span>
              {who.role === "superadmin" && (
                <span className="badge-amber rounded-full px-1.5 py-0.5 text-[8px] font-black shrink-0">SUPER</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 capitalize">{who.role || "admin"}</div>
          </div>
        </a>
        <button
          onClick={async () => {
            // ✅ admin panel logout → site/dashboard session එකත් එකම වරට ඉවත්
            await logout("/");
          }}
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
    const { data, error } = await (await authedClient()).from(table).insert(row).select("*");
    if (error) return error.message;
    if (!data || data.length === 0) return "row save වුණේ නෑ — login/permission පරීක්ෂා කරන්න";
    void logActivity("INSERT", `${table} — ${brief(row)}`);
    return null;
  } catch (e) {
    return String(e);
  }
}

/** Batch insert — Save Changes වේගවත් කරන්න rows ඔක්කොම එක request එකකින් යවයි. */
export async function dbInsertMany(table: string, rows: Record<string, unknown>[]): Promise<string | null> {
  if (rows.length === 0) return null;
  if (!isSupabaseConfigured()) return "Supabase වින්‍යාස වී නොමැත — demo mode";
  try {
    const { data, error } = await (await authedClient()).from(table).insert(rows).select("*");
    if (error) return error.message;
    if (!data || data.length !== rows.length) return "rows save වුණේ නෑ — login/permission පරීක්ෂා කරන්න";
    void logActivity("INSERT", `${table} — ${rows.length} rows (batch)`);
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
    let q = (await authedClient()).from(table).update(patch);
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { data, error } = await q.select("*");
    if (error) return error.message;
    if (!data || data.length === 0) return "rows 0ක් update වුණා — login/permission පරීක්ෂා කරන්න";
    void logActivity("UPDATE", `${table} — set ${brief(patch)} where ${brief(match)}`);
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
    const { error } = await (await authedClient()).from(table).upsert(row, { onConflict });
    if (!error) void logActivity("UPSERT", `${table} — ${brief(row)}`);
    if (!error) return null;
    if (/row-level security|violates row-level/i.test(error.message)) {
      return "ඔබට මේ වගුවට ලියන්න අවසර නෑ — admin ගිණුමකින් නැවත sign in වන්න (RLS)";
    }
    return error.message;
  } catch (e) {
    return String(e);
  }
}

export async function dbDelete(
  table: string,
  match: Record<string, unknown>,
  opts: { allowEmpty?: boolean } = {}
): Promise<string | null> {
  if (!isSupabaseConfigured()) return "Supabase වින්‍යාස වී නොමැත — demo mode";
  try {
    let q = (await authedClient()).from(table).delete();
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { data, error } = await q.select("*");
    if (error) return error.message;
    // "Replace all rows" saves (contacts/branches) legitimately have nothing to
    // delete the first time. In that mode an empty delete is success, not an
    // error — otherwise the following inserts would be skipped entirely.
    if ((!data || data.length === 0) && !opts.allowEmpty) return "delete වුණේ නෑ — row එක හමු නොවුණා/permission නෑ";
    if (data && data.length > 0) void logActivity("DELETE", `${table} — where ${brief(match)}`);
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
