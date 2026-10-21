// ============================================================================
// Branch extras stored in system_settings (no new SQL table/columns needed)
//   · business_branch_photos — Coop City / regional branch card photos
//   · rural_bank_branches    — Admin-edited Rural Bank branch network rows
// ============================================================================

import type { BusinessBranch } from "@/lib/types";

export const BUSINESS_BRANCH_PHOTOS_KEY = "business_branch_photos";
export const RURAL_BANK_BRANCHES_KEY = "rural_bank_branches";

export interface RuralBankBranchRow {
  no: string;
  name: string;
  name_si: string;
  manager: string;
  phone: string;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const pad2 = (n: number): string => String(n).padStart(2, "0");

export function branchPhotoKey(slug: string, branchName: string): string {
  return `${slug.trim().toLowerCase()}:${branchName.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export function parseBranchPhotos(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const url = clean(v);
      if (k.trim() && url) out[k] = url;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeBranchPhotos(map: Record<string, string>): string {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    const url = clean(v);
    if (k.trim() && url) out[k] = url;
  }
  return JSON.stringify(out);
}

export function withBranchPhotos<T extends BusinessBranch>(
  branches: T[],
  slug: string,
  photos: Record<string, string>
): T[] {
  return branches.map((br) => ({ ...br, photo: photos[branchPhotoKey(slug, br.name)] ?? br.photo ?? "" }));
}

export function nextBranchPhotoMap(
  current: Record<string, string>,
  slug: string,
  branches: BusinessBranch[]
): Record<string, string> {
  const prefix = `${slug.trim().toLowerCase()}:`;
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (!k.startsWith(prefix) && clean(v)) next[k] = v;
  }
  for (const br of branches) {
    const photo = clean(br.photo);
    if (photo) next[branchPhotoKey(slug, br.name)] = photo;
  }
  return next;
}

export function normalizeRuralBankBranches(rows: unknown): RuralBankBranchRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, i) => {
      const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
      return {
        no: pad2(i + 1),
        name: clean(r.name ?? r.name_en),
        name_si: clean(r.name_si ?? r.location),
        manager: clean(r.manager),
        phone: clean(r.phone),
      };
    })
    .filter((r) => r.name || r.name_si || r.manager || r.phone)
    .map((r, i) => ({ ...r, no: pad2(i + 1) }));
}

export function parseRuralBankBranches(
  raw: string | undefined | null,
  fallback: RuralBankBranchRow[]
): RuralBankBranchRow[] {
  if (raw == null || raw === "") return normalizeRuralBankBranches(fallback);
  try {
    const parsed = JSON.parse(raw) as unknown;
    // An explicitly saved empty list means the admin deleted every branch.
    if (Array.isArray(parsed)) return normalizeRuralBankBranches(parsed);
  } catch {
    /* corrupt JSON → seed fallback */
  }
  return normalizeRuralBankBranches(fallback);
}

export function serializeRuralBankBranches(rows: RuralBankBranchRow[] | BusinessBranch[]): string {
  return JSON.stringify(normalizeRuralBankBranches(rows));
}

export function ruralBranchesToBusinessBranches(rows: RuralBankBranchRow[]): BusinessBranch[] {
  return normalizeRuralBankBranches(rows).map((r) => ({
    name: r.name,
    name_si: r.name_si,
    manager: r.manager,
    location: "",
    phone: r.phone,
    photo: "",
  }));
}

export function businessBranchesToRuralBranches(rows: BusinessBranch[]): RuralBankBranchRow[] {
  return normalizeRuralBankBranches(rows);
}
