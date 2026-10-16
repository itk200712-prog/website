// ============================================================================
// Server-side data layer — Supabase නැති විට seed data fallback වේ
// ============================================================================

import { createAnonClient } from "@/lib/supabase/anon";
import { getMemberRows as genMemberRows, getVoterRows as genVoterRows } from "@/lib/directory-rows";
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
import type {
  BoardMember,
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

export async function getBusinesses(): Promise<BusinessUnit[]> {
  return safe(async () => {
    const sb = createAnonClient();
    const { data, error } = await sb.from("business_units").select("*").order("order");
    if (error || !data) return BUSINESSES;
    const svcs = await sb.from("business_services").select("*").order("order");
    const contacts = await sb.from("business_contacts").select("*");
    const branches = await sb.from("business_branches").select("*");
    return data.map((b: Record<string, unknown>) => ({
      ...(b as unknown as BusinessUnit),
      services: (svcs.data ?? []).filter((s: { business_slug: string }) => s.business_slug === b.slug),
      contacts: (contacts.data ?? []).filter((c: { business_slug: string }) => c.business_slug === b.slug),
      branches: (branches.data ?? []).filter((x: { business_slug: string }) => x.business_slug === b.slug),
    })) as BusinessUnit[];
  }, BUSINESSES);
}

export async function getBusiness(slug: string): Promise<BusinessUnit | null> {
  const all = await getBusinesses();
  return all.find((b) => b.slug === slug) ?? null;
}

export async function getBoard(): Promise<BoardMember[]> {
  return safe(async () => {
    const sb = createAnonClient();
    const { data, error } = await sb.from("board_members").select("*").order("order");
    if (error || !data) return BOARD;
    return data as unknown as BoardMember[];
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

export async function getGallery(): Promise<GalleryItem[]> {
  return safe(async () => {
    const sb = createAnonClient();
    const { data, error } = await sb.from("gallery_items").select("*");
    if (error || !data) return GALLERY;
    // ✅ comments gallery_comments table එකෙන් එකතු කරන්න (bug fix)
    const { data: cm } = await sb.from("gallery_comments").select("*").order("created_at", { ascending: true });
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
}

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

export async function getSettings(): Promise<SiteSettings> {
  return safe(async () => {
    const sb = createAnonClient();
    const { data, error } = await sb.from("system_settings").select("*");
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
    };
  }, SETTINGS);
}

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
    return {
      rows: (rows.data as unknown as MemberRow[])?.length ? (rows.data as unknown as MemberRow[]) : genMemberRows(),
      files: (files.data as unknown as DataFile[])?.length ? (files.data as unknown as DataFile[]) : MEMBER_FILES,
    };
  }, { rows: genMemberRows(), files: MEMBER_FILES });
}

export async function getVoterRows(): Promise<{ rows: VoterRow[]; files: DataFile[] }> {
  return safe(async () => {
    const sb = createAnonClient();
    const rows = await sb.from("voter_rows").select("*").limit(500);
    const files = await sb.from("data_files").select("*").eq("kind", "voter");
    return {
      rows: (rows.data as unknown as VoterRow[])?.length ? (rows.data as unknown as VoterRow[]) : genVoterRows(),
      files: (files.data as unknown as DataFile[])?.length ? (files.data as unknown as DataFile[]) : VOTER_FILES,
    };
  }, { rows: genVoterRows(), files: VOTER_FILES });
}

export { REGISTERED_USERS };
