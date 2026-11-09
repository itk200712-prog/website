import { SCHEMA_BACKUP_TABLES } from "@/lib/backup-catalog.generated";

// ============================================================================
//  📋 BACKUP COVERAGE — "site එකේ හැම දෙයක්ම backup එකට එනවද?" කියා බලන ලැයිස්තුව
// ----------------------------------------------------------------------------
//  Admin → Backup & Restore එකේ "Coverage" card එකෙන් පෙන්වන්නේ මේ එකයි:
//  user details · admin details · login accounts · images · Excel data ·
//  settings · chat · logs — **හැම කොටසක්ම** backup එකට යනවද කියා.
//
//  ⚠ මෙතන ලියලා තියෙන table එකක් `supabase/schema.sql` එකේ නැත්නම් හෝ
//    `BACKUP_TABLES` එකේ නැත්නම් `scripts/test.mts` එකේ test එකක් fail වේ.
//    ඒ නිසා අලුත් table එකක් දැම්මම backup එකෙන් ඇත්තටම යන බව ස්ථිර වේ.
// ============================================================================

export type CoverageKind = "table" | "images" | "assets" | "source" | "registers";

export type CoverageItem = {
  /** table නම (කෙලින්ම BACKUP_TABLES එකට map වේ) හෝ විශේෂ key එකක් */
  key: string;
  /** Admin එකේ පෙන්වන නම */
  label: string;
  kind: CoverageKind;
  /** කුඩා පැහැදිලි කිරීමක් */
  note?: string;
};

export type CoverageGroup = { title: string; icon: string; items: CoverageItem[] };

export const BACKUP_COVERAGE: CoverageGroup[] = [
  {
    title: "ගිණුම් · Admin · රහස්",
    icon: "👤",
    items: [
      { key: "profiles", label: "User + Admin විස්තර (නම, NIC, දුරකථන, role, email, password)", kind: "table" },
      { key: "login_accounts", label: "Login recovery (profiles හි email/password ඇති ගිණුම් පමණයි)", kind: "registers", note: "database.sql → LOGIN ACCOUNTS" },
      { key: "special_download_access", label: "Download With Special අවසර", kind: "table" },
      { key: "backup_secrets", label: "රහස් (Gemini key, MEGA login, cron secret, encryption)", kind: "table" },
      { key: "system_settings", label: "Site settings (සියලු toggles, WhatsApp, notice…)", kind: "table" },
    ],
  },
  {
    title: "සාමාජික · ඡන්ද හිමි · Excel",
    icon: "📊",
    items: [
      { key: "member_rows", label: "සාමාජික විස්තර (52,000+)", kind: "table" },
      { key: "voter_rows", label: "ඡන්ද හිමි විස්තර", kind: "table" },
      { key: "Members-Register.xlsx", label: "Members Excel (Register)", kind: "registers" },
      { key: "Voters-Register.xlsx", label: "Voters Excel (Register)", kind: "registers" },
      { key: "data_files", label: "Import කළ Excel file ලැයිස්තුව", kind: "table" },
      { key: "data_imports", label: "Import history", kind: "table" },
      { key: "f28_members", label: "F28 සාමාජිකයින්", kind: "table" },
      { key: "f28_items", label: "F28 දත්ත", kind: "table" },
      { key: "membership_applications", label: "Membership අයදුම්පත්", kind: "table" },
    ],
  },
  {
    title: "Images · Files · Design",
    icon: "🖼️",
    items: [
      { key: "site_images_backup", label: "Upload කළ images (සියල්ල base64 විදිහට)", kind: "images" },
      { key: "site-assets", label: "Site icons / photos / fonts (public/)", kind: "assets" },
      { key: "site-source", label: "Design source files (CSS, animation, components)", kind: "source" },
    ],
  },
  {
    title: "Site අන්තර්ගතය",
    icon: "🌐",
    items: [
      { key: "board_members", label: "අධ්‍යක්ෂ මණ්ඩලය", kind: "table" },
      { key: "business_units", label: "ව්‍යාපාර", kind: "table" },
      { key: "business_services", label: "ව්‍යාපාර සේවා", kind: "table" },
      { key: "business_contacts", label: "ව්‍යාපාර සම්බන්ධතා", kind: "table" },
      { key: "business_branches", label: "ව්‍යාපාර ශාඛා", kind: "table" },
      { key: "news", label: "පුවත්", kind: "table" },
      { key: "gallery_items", label: "Gallery images", kind: "table" },
      { key: "gallery_comments", label: "Gallery comments", kind: "table" },
      { key: "fuel_prices", label: "ඉන්ධන මිල", kind: "table" },
      { key: "fuel_stock", label: "ඉන්ධන තොග", kind: "table" },
      { key: "notify_emails", label: "Notify email ලැයිස්තුව", kind: "table" },
    ],
  },
  {
    title: "සන්නිවේදනය · Logs",
    icon: "💬",
    items: [
      { key: "messages", label: "Contact පණිවිඩ", kind: "table" },
      { key: "chat_sessions", label: "Live chat sessions", kind: "table" },
      { key: "chat_messages", label: "Live chat messages", kind: "table" },
      { key: "live_chat_events", label: "Live chat log", kind: "table" },
      { key: "admin_activity_logs", label: "Admin ක්‍රියා log", kind: "table" },
      { key: "backup_history", label: "Backup history", kind: "table" },
    ],
  },
];

const catalogExtras = SCHEMA_BACKUP_TABLES.filter((table) => !BACKUP_COVERAGE.some((g) => g.items.some((i) => i.key === table.name)));
if (catalogExtras.length) BACKUP_COVERAGE.push({ title: "අලුත් schema tables", icon: "🗄", items: catalogExtras.map((t) => ({ key: t.name, label: t.name, kind: "table" })) });

/** Backup එකේ table එකකට නොවන (file/විශේෂ) items — count එක manifest එකෙන් එයි */
export const NON_TABLE_COVERAGE_KEYS = ["login_accounts", "site-assets", "site-source", "Members-Register.xlsx", "Voters-Register.xlsx"];

/** `supabase/schema.sql` එකේ තියෙන `create table public.X` නම් (test එකට + coverage එකට) */
export function tablesFromSchemaSql(sql: string): string[] {
  const out = new Set<string>();
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) out.add(m[1].toLowerCase());
  return [...out].sort();
}

export type CoverageCounts = {
  /** table නම → row ගණන */
  tables?: Record<string, number>;
  /** storage එකේ + public assets images */
  images?: number;
  siteAssets?: number;
  siteSource?: number;
  /** login accounts ගණන (profiles වල password තියෙන ගාණ) */
  loginAccounts?: number;
  memberRows?: number;
  voterRows?: number;
};

export type CoverageStatus = "ok" | "empty" | "unknown";
export type CoverageRow = CoverageItem & { count: number | null; status: CoverageStatus };
export type CoverageGroupReport = { title: string; icon: string; rows: CoverageRow[]; ok: number; empty: number };

export type CoverageReport = {
  groups: CoverageGroupReport[];
  total: number;
  ok: number;
  empty: number;
  unknown: number;
  /**
   * හැම item එකක්ම **ගණන් කරලා තහවුරු කරලාද**? (count නොදන්නා ඒවා 0)
   * `complete === true` නම් site එකේ හැම කොටසක්ම backup එකට එන බව තහවුරුයි.
   * (row 0ක් තියෙන table එකක් = දත්ත නෑ, coverage gap එකක් නෙවෙයි.)
   */
  complete: boolean;
};

function itemCount(item: CoverageItem, c: CoverageCounts): number | null {
  if (item.kind === "table") {
    const v = c.tables?.[item.key];
    return typeof v === "number" ? v : null;
  }
  if (item.kind === "images") return typeof c.images === "number" ? c.images : null;
  if (item.kind === "assets") return typeof c.siteAssets === "number" ? c.siteAssets : null;
  if (item.kind === "source") return typeof c.siteSource === "number" ? c.siteSource : null;
  // registers
  if (item.key === "login_accounts") return typeof c.loginAccounts === "number" ? c.loginAccounts : null;
  if (item.key === "Members-Register.xlsx") return typeof c.memberRows === "number" ? c.memberRows : null;
  if (item.key === "Voters-Register.xlsx") return typeof c.voterRows === "number" ? c.voterRows : null;
  return null;
}

/** Coverage report එකක් හදයි — count නැති ඒවා "unknown" (තාම backup එකක් දුවලා නෑ) */
export function buildCoverageReport(counts: CoverageCounts): CoverageReport {
  const groups: CoverageGroupReport[] = BACKUP_COVERAGE.map((g) => {
    const rows: CoverageRow[] = g.items.map((item) => {
      const count = itemCount(item, counts);
      const status: CoverageStatus = count == null ? "unknown" : count > 0 ? "ok" : "empty";
      return { ...item, count, status };
    });
    return {
      title: g.title,
      icon: g.icon,
      rows,
      ok: rows.filter((r) => r.status === "ok").length,
      empty: rows.filter((r) => r.status === "empty").length,
    };
  });
  const flat = groups.flatMap((g) => g.rows);
  return {
    groups,
    total: flat.length,
    ok: flat.filter((r) => r.status === "ok").length,
    empty: flat.filter((r) => r.status === "empty").length,
    unknown: flat.filter((r) => r.status === "unknown").length,
    // "complete" = හැම item එකකටම count එකක් තියෙනවා (0 වුණත් ගණන් කරලා)
    complete: flat.every((r) => r.status !== "unknown"),
  };
}
