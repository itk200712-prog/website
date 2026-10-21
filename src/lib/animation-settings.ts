// ============================================================================
// Business page animation extras stored in system_settings (no new SQL needed)
//   · business_animation_settings — slug එක අනුව: { bgImage, brightness, products[] }
//     bgImage    = මුළු business පිටුවේම පසුබිමට වැටෙන watermark image එක
//     brightness = watermark එක පේන තද බව % (Admin → Animation slider එක)
//     products   = පිටුවේ උඩින් animate වෙලා පේන product images
// system_settings + site-images දෙකම Backup එකේ තියෙන නිසා මේ settings ත්
// Download/Import backup එකත් එක්කම යනවා.
// ============================================================================

import type { BusinessAnimation } from "@/lib/types";

export const BUSINESS_ANIMATION_KEY = "business_animation_settings";
export const DEFAULT_ANIMATION_BRIGHTNESS = 55;
export const MIN_ANIMATION_BRIGHTNESS = 10;
export const MAX_ANIMATION_BRIGHTNESS = 120;
export const MAX_ANIMATION_PRODUCTS = 8;

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const cleanSlug = (v: unknown): string => clean(v).toLowerCase();

export function clampAnimationBrightness(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(clean(v));
  if (!Number.isFinite(n)) return DEFAULT_ANIMATION_BRIGHTNESS;
  return Math.min(MAX_ANIMATION_BRIGHTNESS, Math.max(MIN_ANIMATION_BRIGHTNESS, Math.round(n)));
}

/**
 * පිටුවේ පසුබිම් watermark එක පේන තද බව (opacity) — brightness slider එක අනුව.
 * අඩු brightness = ලාවට · වැඩි brightness = තදින් (අකුරු කියවන්න පුළුවන් ගානට උපරිම 0.35).
 */
export function animationWatermarkOpacity(brightness: unknown): number {
  const b = clampAnimationBrightness(brightness);
  return Math.round(Math.min(0.35, Math.max(0.03, (b / 100) * 0.3)) * 1000) / 1000;
}

export function emptyBusinessAnimation(): BusinessAnimation {
  return { bgImage: "", brightness: DEFAULT_ANIMATION_BRIGHTNESS, products: [] };
}

export function normalizeBusinessAnimation(v: unknown): BusinessAnimation {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const rawProducts = Array.isArray(r.products) ? r.products : [];
  const products: string[] = [];
  for (const p of rawProducts) {
    const url = clean(p);
    if (url && !products.includes(url)) products.push(url);
    if (products.length >= MAX_ANIMATION_PRODUCTS) break;
  }
  return {
    bgImage: clean(r.bgImage ?? r.bg_image ?? r.background),
    brightness: clampAnimationBrightness(r.brightness),
    products,
  };
}

export function hasBusinessAnimation(a: BusinessAnimation | undefined | null): boolean {
  return Boolean(a && (a.bgImage || a.products.length > 0));
}

/** system_settings JSON එක → slug අනුව settings (හිස් entries අයින් කරයි) */
export function parseBusinessAnimations(
  raw: string | undefined | null
): Record<string, BusinessAnimation> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, BusinessAnimation> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const slug = cleanSlug(k);
      const anim = normalizeBusinessAnimation(v);
      if (slug && hasBusinessAnimation(anim)) out[slug] = anim;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeBusinessAnimations(map: Record<string, BusinessAnimation>): string {
  const out: Record<string, BusinessAnimation> = {};
  for (const [k, v] of Object.entries(map)) {
    const slug = cleanSlug(k);
    const anim = normalizeBusinessAnimation(v);
    if (slug && hasBusinessAnimation(anim)) out[slug] = anim;
  }
  return JSON.stringify(out);
}

export function getBusinessAnimation(
  map: Record<string, BusinessAnimation>,
  slug: string
): BusinessAnimation | undefined {
  const anim = map[cleanSlug(slug)];
  return hasBusinessAnimation(anim) ? anim : undefined;
}
