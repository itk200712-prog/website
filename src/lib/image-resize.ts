"use client";

// ============================================================================
//  Image resize / compress — upload කරන පින්තූර ලොකු නම් කුඩා කර, තත්ත්වය තබාගෙන
//  (canvas + WebP). Bot avatar, hero, board photos වගේ හැම admin upload එකකටම.
// ============================================================================

export type ResizeOpts = {
  /** දිගම පැත්තේ උපරිම පික්සල (default 512) */
  maxSize?: number;
  /** 0–1 quality (default 0.9) */
  quality?: number;
};

/**
 * පින්තූරයක් කුඩා කර File එකක් ලෙස ආපසු දෙයි.
 * · SVG / GIF (animation) → වෙනස් නොකර එලෙසම
 * · දැනටමත් කුඩා නම් → වෙනස් නොකර
 */
export async function resizeImage(file: File, opts: ResizeOpts = {}): Promise<File> {
  const maxSize = opts.maxSize ?? 512;
  const quality = opts.quality ?? 0.9;

  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 220 * 1024) {
      bitmap.close?.();
      return file; // දැනටමත් කුඩා — නැවත encode කරන්න අවශ්‍ය නෑ
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/webp", quality);
    });
    if (!blob || blob.size >= file.size) return file; // වඩා කුඩා නැත්නම් පරණ එකම

    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${ext}`, { type: blob.type || "image/webp" });
  } catch {
    return file;
  }
}
