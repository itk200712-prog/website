// ============================================================================
// Professional image-size helpers
// Gallery/News/Admin තැන්වල raw "4:3" වගේ පෙන්වනවා වෙනුවට
// dimensions + ratio + orientation/name + format + file size පිළිවෙලට පෙන්වන්න.
// ============================================================================

export type GalleryAspect = "4:3" | "16:9" | "1:1" | "3:2";
export type MediaLang = "si" | "en" | string;
export type MediaOrientation = "landscape" | "portrait" | "square";

export interface AspectInfo {
  width: number;
  height: number;
  ratio: number;
  label: string;
  css: string;
}

export interface GalleryAspectOption {
  value: GalleryAspect;
  nameEn: string;
  nameSi: string;
  hintEn: string;
  hintSi: string;
}

export const GALLERY_ASPECT_OPTIONS: GalleryAspectOption[] = [
  {
    value: "4:3",
    nameEn: "Classic",
    nameSi: "සම්මත",
    hintEn: "Balanced gallery photos",
    hintSi: "සාමාන්‍ය gallery photos",
  },
  {
    value: "16:9",
    nameEn: "Widescreen",
    nameSi: "පුළුල් තිරස්",
    hintEn: "Events & wide scenes",
    hintSi: "උත්සව සහ පුළුල් දර්ශන",
  },
  {
    value: "1:1",
    nameEn: "Square",
    nameSi: "හතරැස්",
    hintEn: "Products & portraits",
    hintSi: "නිෂ්පාදන සහ මුහුණු",
  },
  {
    value: "3:2",
    nameEn: "Photo",
    nameSi: "ඡායාරූප",
    hintEn: "Camera-style photos",
    hintSi: "කැමරා ඡායාරූප",
  },
];

const STANDARD_RATIOS: Array<{ label: string; value: number }> = [
  { label: "21:9", value: 21 / 9 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:2", value: 3 / 2 },
  { label: "4:3", value: 4 / 3 },
  { label: "5:4", value: 5 / 4 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:4", value: 3 / 4 },
  { label: "2:3", value: 2 / 3 },
  { label: "9:16", value: 9 / 16 },
];

function cleanPositive(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function trimDecimal(value: number, digits = 2): string {
  return value
    .toFixed(digits)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

export function parseAspectRatio(value?: string | null): AspectInfo | null {
  const raw = String(value ?? "").trim();
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const divider = gcd(width, height);
  const labelWidth = Number.isInteger(width) && Number.isInteger(height) ? width / divider : width;
  const labelHeight = Number.isInteger(width) && Number.isInteger(height) ? height / divider : height;
  return {
    width,
    height,
    ratio: width / height,
    label: `${trimDecimal(labelWidth)}:${trimDecimal(labelHeight)}`,
    css: `${width} / ${height}`,
  };
}

export function aspectCssValue(aspect?: string | null): string {
  return parseAspectRatio(aspect)?.css ?? "4 / 3";
}

export function aspectFromDimensions(width?: number | null, height?: number | null): string | null {
  const w = cleanPositive(width);
  const h = cleanPositive(height);
  if (!w || !h) return null;

  const wi = Math.round(w);
  const hi = Math.round(h);
  const divider = gcd(wi, hi);
  const simpleW = wi / divider;
  const simpleH = hi / divider;
  if (simpleW <= 32 && simpleH <= 32) return `${simpleW}:${simpleH}`;

  const ratio = wi / hi;
  let closest: { label: string; value: number } | null = null;
  let closestDiff = Infinity;
  for (const item of STANDARD_RATIOS) {
    const diff = Math.abs(ratio - item.value) / item.value;
    if (diff < closestDiff) {
      closest = item;
      closestDiff = diff;
    }
  }
  if (closest && closestDiff <= 0.025) return closest.label;
  return ratio >= 1 ? `${trimDecimal(ratio)}:1` : `1:${trimDecimal(1 / ratio)}`;
}

export function formatAspectRatio(
  width?: number | null,
  height?: number | null,
  fallbackAspect?: string | null
): string | null {
  return aspectFromDimensions(width, height) ?? parseAspectRatio(fallbackAspect)?.label ?? null;
}

export function orientationForRatio(ratio?: number | null): MediaOrientation {
  if (!ratio || !Number.isFinite(ratio) || (ratio >= 0.98 && ratio <= 1.02)) return "square";
  return ratio > 1.02 ? "landscape" : "portrait";
}

export function orientationForAspect(
  aspect?: string | null,
  width?: number | null,
  height?: number | null
): MediaOrientation {
  const w = cleanPositive(width);
  const h = cleanPositive(height);
  if (w && h) return orientationForRatio(w / h);
  return orientationForRatio(parseAspectRatio(aspect)?.ratio);
}

export function orientationLabel(orientation: MediaOrientation, lang: MediaLang = "en"): string {
  const si = lang === "si";
  if (orientation === "portrait") return si ? "සිරස්" : "Portrait";
  if (orientation === "square") return si ? "හතරැස්" : "Square";
  return si ? "තිරස්" : "Landscape";
}

export function aspectName(aspect?: string | null, lang: MediaLang = "en"): string {
  const info = parseAspectRatio(aspect);
  const si = lang === "si";
  if (!info) return si ? "පින්තූරය" : "Image";
  const names: Record<string, { en: string; si: string }> = {
    "21:9": { en: "Ultrawide", si: "අති පුළුල් තිරස්" },
    "16:9": { en: "Widescreen", si: "පුළුල් තිරස්" },
    "3:2": { en: "Photo Landscape", si: "ඡායාරූප තිරස්" },
    "4:3": { en: "Classic Landscape", si: "සම්මත තිරස්" },
    "5:4": { en: "Classic Photo", si: "සම්මත ඡායාරූප" },
    "1:1": { en: "Square", si: "හතරැස්" },
    "4:5": { en: "Portrait", si: "සිරස්" },
    "3:4": { en: "Portrait", si: "සිරස්" },
    "2:3": { en: "Photo Portrait", si: "ඡායාරූප සිරස්" },
    "9:16": { en: "Tall Portrait", si: "උස සිරස්" },
  };
  return names[info.label] ? (si ? names[info.label].si : names[info.label].en) : orientationLabel(orientationForRatio(info.ratio), lang);
}

export function aspectOption(aspect?: string | null): GalleryAspectOption | null {
  const label = parseAspectRatio(aspect)?.label;
  return GALLERY_ASPECT_OPTIONS.find((x) => x.value === label) ?? null;
}

export function formatDimensions(width?: number | null, height?: number | null): string | null {
  const w = cleanPositive(width);
  const h = cleanPositive(height);
  if (!w || !h) return null;
  const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  return `${fmt.format(Math.round(w))} × ${fmt.format(Math.round(h))} px`;
}

export function formatMegapixels(width?: number | null, height?: number | null): string | null {
  const w = cleanPositive(width);
  const h = cleanPositive(height);
  if (!w || !h) return null;
  const mp = (Math.round(w) * Math.round(h)) / 1_000_000;
  if (mp < 0.01) return `${Math.round(w * h).toLocaleString("en-US")} pixels`;
  return `${trimDecimal(mp, mp >= 10 ? 1 : 2)} MP`;
}

export function imageFormatFromUrl(src?: string | null): string | null {
  const raw = String(src ?? "").trim();
  if (!raw) return null;
  const data = raw.match(/^data:image\/([^;,+]+)(?:\+[^;,]+)?/i);
  if (data) return data[1].toUpperCase() === "JPEG" ? "JPG" : data[1].toUpperCase();

  let path = raw.split(/[?#]/)[0];
  try {
    path = new URL(raw, "https://example.invalid").pathname;
  } catch {
    /* keep raw path */
  }
  const ext = path.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (!ext) return null;
  if (ext === "jpeg" || ext === "jpg") return "JPG";
  if (ext === "svg") return "SVG";
  return ext.toUpperCase();
}

export function formatFileSize(bytes?: number | null): string | null {
  const n = cleanPositive(bytes) ?? (bytes === 0 ? 0 : null);
  if (n == null) return null;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${trimDecimal(n / 1024, n >= 100 * 1024 ? 0 : 1)} KB`;
  return `${trimDecimal(n / (1024 * 1024), 2)} MB`;
}

export function buildImageMetaSummary(input: {
  width?: number | null;
  height?: number | null;
  aspect?: string | null;
  format?: string | null;
  bytes?: number | null;
  lang?: MediaLang;
}): string {
  const lang = input.lang ?? "en";
  const ratio = formatAspectRatio(input.width, input.height, input.aspect);
  const parts = [
    formatDimensions(input.width, input.height),
    ratio ? `${ratio} · ${aspectName(ratio, lang)}` : null,
    formatMegapixels(input.width, input.height),
    input.format ?? null,
    formatFileSize(input.bytes),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : lang === "si" ? "පින්තූර ප්‍රමාණය හඳුනාගත නොහැකියි" : "Image size unavailable";
}
