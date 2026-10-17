"use client";

// ============================================================================
//  Site image upload / delete — Supabase Storage ("site-images" bucket)
//  (hero backgrounds සහ site images; admin පරිපාලකයින්ට පමණයි — SQL policies)
// ============================================================================

import { authedClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { resizeImage, type ResizeOpts } from "@/lib/image-resize";

export const SITE_BUCKET = "site-images";

/** image file එකක් Supabase Storage එකට upload කර public URL එක දෙයි */
export async function uploadSiteImage(
  file: File,
  folder = "hero",
  opts?: ResizeOpts
): Promise<{ url?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      error: "Supabase වින්‍යාස වී නොමැත (.env.local) — දැනට path/URL එකක් ඇතුළත් කරන්න",
    };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "image file එකක් පමණයි (jpg, png, webp)" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "උපරිම ප්‍රමාණය 10MB" };
  }
  try {
    // ✅ upload කරන්න කලින් කුඩා කරයි — quality එක තියාගෙන (bot: 512px · අනිත්: 1600px)
    const cleaned = await resizeImage(file, opts ?? { maxSize: 1600, quality: 0.9 });
    const sb = await authedClient();
    const safe = cleaned.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "image.jpg";
    const path = `${folder}/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from(SITE_BUCKET).upload(path, cleaned, {
      contentType: cleaned.type || "image/jpeg",
      upsert: false,
    });
    if (error) return { error: error.message };
    const { data } = sb.storage.from(SITE_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed" };
  }
}

/** upload කළ image එකක් storage එකෙන් මකයි (best-effort; external URL නම් අත්හරියි) */
export async function deleteSiteImage(url: string): Promise<void> {
  if (!isSupabaseConfigured() || !url) return;
  try {
    const sb = await authedClient();
    const marker = `/object/public/${SITE_BUCKET}/`;
    const i = url.indexOf(marker);
    if (i === -1) return; // අපේ bucket එකේ image එකක් නොවේ
    const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
    if (!path) return;
    await sb.storage.from(SITE_BUCKET).remove([path]);
  } catch {
    /* best-effort — list එකෙන් ඉවත් වීම ප්‍රමාණවත් */
  }
}
