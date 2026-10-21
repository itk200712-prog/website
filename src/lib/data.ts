// ============================================================================
// Server-side data layer — Supabase නැති විට seed data fallback වේ
// ============================================================================

import { cache } from "react";
import { createAnonClient } from "@/lib/supabase/anon";
import { isSupabaseConfigured } from "@/lib/env";
import {
  BOARD,
  BUSINESSES,
  FUEL_PRICES,
  GALLERY,
  MEMBER_FILES,
  NEWS,
  REGISTERED_USERS,
  RURAL_BANK_BRANCHES,
  SETTINGS,
  VOTER_FILES,
} from "@/lib/seed";
import {
  BUSINESS_BRANCH_PHOTOS_KEY,
  RURAL_BANK_BRANCHES_KEY,
  parseBranchPhotos,
  parseRuralBankBranches,
  ruralBranchesToBusinessBranches,
  withBranchPhotos,
} from "@/lib/branch-settings";
import {
  BUSINESS_ANIMATION_KEY,
  getBusinessAnimation,
  parseBusinessAnimations,
} from "@/lib/animation-settings";
import type {
  BoardMember,
  BusinessBranch,
  BusinessUnit,
  DataFile,
  FuelPrice,
  GalleryItem,
  MemberRow,
  NewsItem,
  SiteSettings,
  VoterRow,
} from "@/lib/types";

export { RURAL_BANK_BRANCHES };

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const BUSINESS_SETTING_KEYS = [BUSINESS_BRANCH_PHOTOS_KEY, RURAL_BANK_BRANCHES_KEY, BUSINESS_ANIMATION_KEY];

type BusinessExtras = {
  services: { business_slug: string }[];
  contacts: { business_slug: string }[];
  branches: (BusinessBranch & { business_slug: string })[];
  branchPhotos: ReturnType<typeof parseBranchPhotos>;
  animations: ReturnType<typeof parseBusinessAnimations>;
  ruralBranches: BusinessBranch[];
  hasRuralSettings: boolean;
};

function businessExtras(
  settingsRows: { key: string; value: string }[] | null | undefined,
  services: BusinessExtras["services"],
  contacts: BusinessExtras["contacts"],
  branches: BusinessExtras["branches"]
): BusinessExtras {
  const settingsMap = new Map((settingsRows ?? []).map((r) => [r.key, r.value]));
  const hasRuralSettings = settingsMap.has(RURAL_BANK_BRANCHES_KEY);
  return {
    services,
    contacts,
    branches,
    hasRuralSettings,
    branchPhotos: parseBranchPhotos(settingsMap.get(BUSINESS_BRANCH_PHOTOS_KEY)),
    animations: parseBusinessAnimations(settingsMap.get(BUSINESS_ANIMATION_KEY)),
    ruralBranches: ruralBranchesToBusinessBranches(
      hasRuralSettings
        ? parseRuralBankBranches(settingsMap.get(RURAL_BANK_BRANCHES_KEY), RURAL_BANK_BRANCHES)
        : RURAL_BANK_BRANCHES
    ),
  };
}

function mapBusinessRow(b: Record<string, unknown>, ex: BusinessExtras): BusinessUnit {
  const slug = String(b.slug ?? "");
  const { branchPhotos, animations, ruralBranches, hasRuralSettings } = ex;
  const dbBranches = ex.branches
    .filter((x) => x.business_slug === slug)
    .map(({ business_slug: _slug, ...br }) => br as BusinessBranch);
  return {
    ...(b as unknown as BusinessUnit),
    animation: getBusinessAnimation(animations, slug),
    services: ex.services.filter((s) => s.business_slug === slug),
    contacts: ex.contacts.filter((c) => c.business_slug === slug),
    branches:
      slug === "rural-bank"
        ? hasRuralSettings || dbBranches.length === 0
          ? ruralBranches
          : withBranchPhotos(dbBranches, slug, branchPhotos)
        : withBranchPhotos(dbBranches, slug, branchPhotos),
  } as unknown as BusinessUnit;
}

// ⚡ වේගය: queries 5ම එකවර (parallel) + cache() එකෙන් එකම request එක තුළ dedupe වේ.
// (කලින්: business_units ඉවර වෙනකල් ඉඳලා ඊට පස්සේ අනිත් 4 — අමතර වටයක් නිසා delay වැඩියි)
export const getBusinesses = cache(async (): Promise<BusinessUnit[]> => {
  return safe(async () => {
    const sb = createAnonClient();
    const [units, svcs, contacts, branches, settingsRes] = await Promise.all([
      sb.from("business_units").select("*").order("order"),
      sb.from("business_services").select("*").order("order"),
      sb.from("business_contacts").select("*"),
      sb.from("business_branches").select("*"),
      sb.from("system_settings").select("key,value").in("key", BUSINESS_SETTING_KEYS),
    ]);
    if (units.error || !units.data) return BUSINESSES;
    const ex = businessExtras(settingsRes.data, svcs.data ?? [], contacts.data ?? [], branches.data ?? []);
    return (units.data as Record<string, unknown>[]).map((b) => mapBusinessRow(b, ex));
  }, BUSINESSES);
});

// ⚡ Detail පිටුවට: මුළු business ලැයිස්තුවම නොගෙන අදාළ slug එක විතරක් targeted ගනී.
// DB එකේ නැති slug එකක් නම් කලින් විදිහටම සම්පූර්ණ ලැයිස්තුවෙන් හොයයි (seed fallback සහිතව).
export const getBusiness = cache(async (slug: string): Promise<BusinessUnit | null> => {
  const targeted = await safe<BusinessUnit | null>(async () => {
    const sb = createAnonClient();
    const [unit, svcs, contacts, branches, settingsRes] = await Promise.all([
      sb.from("business_units").select("*").eq("slug", slug).maybeSingle(),
      sb.from("business_services").select("*").eq("business_slug", slug).order("order"),
      sb.from("business_contacts").select("*").eq("business_slug", slug),
      sb.from("business_branches").select("*").eq("business_slug", slug),
      sb.from("system_settings").select("key,value").in("key", BUSINESS_SETTING_KEYS),
    ]);
    if (unit.error || !unit.data) return null;
    const ex = businessExtras(settingsRes.data, svcs.data ?? [], contacts.data ?? [], branches.data ?? []);
    return mapBusinessRow(unit.data as Record<string, unknown>, ex);
  }, null);
  if (targeted) return targeted;
  const all = await getBusinesses();
  return all.find((b) => b.slug === slug) ?? null;
});

export async function getBoard(): Promise<BoardMember[]> {
  return safe(async () => {
    const sb = createAnonClient();
    const { data, error } = await sb.from("board_members").select("*").order("order");
    if (error || !data) return BOARD;
    // ✅ seed දෙපාරක් run වුණත් duplicate persons site එකේ නොපෙන්වන්න (email/name අනුව unique)
    const seen = new Set<string>();
    const rows = (data as unknown as BoardMember[]).filter((p) => {
      const k = (p.email || p.name_en || "").toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return rows;
  }, BOARD);
}

export async function getNews(): Promise<NewsItem[]> {
  return safe(async () => {
    const sb = createAnonClient();
    const { data, error } = await sb.from("news").select("*").eq("published", true);
    if (error || !data) return NEWS;
    return (data as unknown as NewsItem[]).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, NEWS);
}

export const getGallery = cache(async (): Promise<GalleryItem[]> => {
  return safe(async () => {
    const sb = createAnonClient();
    // ⚡ items + comments එකවර (parallel) — කලින් එකින් එක ගත් නිසා වටයක් වැඩියි
    const [itemsRes, commentsRes] = await Promise.all([
      sb.from("gallery_items").select("*"),
      sb.from("gallery_comments").select("*").order("created_at", { ascending: true }),
    ]);
    const { data, error } = itemsRes;
    if (error || !data) return GALLERY;
    // ✅ comments gallery_comments table එකෙන් එකතු කරන්න (bug fix)
    const cm = commentsRes.data;
    return (data as unknown as GalleryItem[]).map((g) => ({
      ...g,
      comments: (cm ?? [])
        .filter((c: { item_id: string }) => c.item_id === g.id)
        .map((c: { id: string; author: string; text: string; created_at: string }) => ({
          id: String(c.id),
          author: String(c.author ?? ""),
          text: String(c.text ?? ""),
          created_at: String(c.created_at ?? ""),
        })),
      likes: typeof g.likes === "number" ? g.likes : 0,
      aspect: g.aspect ?? "4:3",
    }));
  }, GALLERY);
});

export async function getFuelPrices(): Promise<FuelPrice[]> {
  return safe(async () => {
    const sb = createAnonClient();
    const { data, error } = await sb.from("fuel_prices").select("*");
    if (error || !data) return FUEL_PRICES;
    const byType = new Map(data.map((r: { type: string }) => [r.type, r]));
    return FUEL_PRICES.map((f) => {
      const row = byType.get(f.type) as { price?: number } | undefined;
      return row?.price != null ? { ...f, price: Number(row.price) } : f;
    });
  }, FUEL_PRICES);
}

const SITE_SETTING_KEYS = [
  "whatsapp_number",
  "years_of_service",
  "contact_email_1",
  "contact_email_2",
  "members_total",
  "voters_total",
  "members_files_count",
  "voters_files_count",
  "hero_images",
  "board_bg",
];

export const getSettings = cache(async (): Promise<SiteSettings> => {
  return safe(async () => {
    const sb = createAnonClient();
    // ⚡ ඕන keys විතරයි — මුළු system_settings එකම (branch/animation JSON සහිතව) ඇද්දේ නෑ
    const { data, error } = await sb.from("system_settings").select("key,value").in("key", SITE_SETTING_KEYS);
    if (error || !data) return SETTINGS;
    const map = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]));
    return {
      whatsapp_number: map.get("whatsapp_number") ?? SETTINGS.whatsapp_number,
      years_of_service: Number(map.get("years_of_service") ?? SETTINGS.years_of_service),
      contact_email_1: map.get("contact_email_1") ?? SETTINGS.contact_email_1,
      contact_email_2: map.get("contact_email_2") ?? SETTINGS.contact_email_2,
      members_total: Number(map.get("members_total") ?? SETTINGS.members_total),
      voters_total: Number(map.get("voters_total") ?? SETTINGS.voters_total),
      members_files_count: Number(map.get("members_files_count") ?? SETTINGS.members_files_count),
      voters_files_count: Number(map.get("voters_files_count") ?? SETTINGS.voters_files_count),
      hero_images: parseHeroImages(map.get("hero_images")),
      board_bg: map.get("board_bg") ?? "",
    };
  }, SETTINGS);
});

/** system_settings.hero_images = JSON string[] (max 10) */
function parseHeroImages(raw: string | undefined): string[] {
  if (!raw) return SETTINGS.hero_images;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, 10);
    }
  } catch {
    /* corrupt JSON → seed fallback */
  }
  return SETTINGS.hero_images;
}

export async function getMemberRows(): Promise<{ rows: MemberRow[]; files: DataFile[] }> {
  return safe(async () => {
    const sb = createAnonClient();
    const rows = await sb.from("member_rows").select("*").limit(500);
    const files = await sb.from("data_files").select("*").eq("kind", "member");
    // ✅ demo rows නෑ — real uploaded data පමණයි
    return {
      rows: (rows.data as unknown as MemberRow[]) ?? [],
      files: (files.data as unknown as DataFile[]) ?? [],
    };
  }, { rows: [], files: [] });
}

export async function getVoterRows(): Promise<{ rows: VoterRow[]; files: DataFile[] }> {
  return safe(async () => {
    const sb = createAnonClient();
    const rows = await sb.from("voter_rows").select("*").limit(500);
    const files = await sb.from("data_files").select("*").eq("kind", "voter");
    // ✅ demo rows නෑ — real uploaded data පමණයි
    return {
      rows: (rows.data as unknown as VoterRow[]) ?? [],
      files: (files.data as unknown as DataFile[]) ?? [],
    };
  }, { rows: [], files: [] });
}

export { REGISTERED_USERS };
