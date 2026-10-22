"use client";

// ============================================================================
// Professional image size UI — actual dimensions/ratio/format/file-size
// Gallery, News, Home සහ Admin preview හැම තැනම එකම polished විදිහට පෙන්වයි.
// ============================================================================

import { useEffect, useState } from "react";
import {
  Expand,
  FileImage,
  HardDrive,
  Proportions,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  type LucideIcon,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import {
  aspectCssValue,
  aspectName,
  buildImageMetaSummary,
  formatAspectRatio,
  formatDimensions,
  formatFileSize,
  formatMegapixels,
  imageFormatFromUrl,
  orientationForAspect,
  orientationLabel,
  parseAspectRatio,
  type MediaLang,
} from "@/lib/media-info";

export interface LoadedImageMeta {
  width?: number;
  height?: number;
  format?: string | null;
  bytes?: number | null;
  contentType?: string | null;
  loaded: boolean;
  error: boolean;
}

function initialMeta(src?: string | null): LoadedImageMeta {
  return {
    format: imageFormatFromUrl(src),
    loaded: false,
    error: false,
  };
}

export function useImageMeta(src?: string | null, fetchSize = false): LoadedImageMeta {
  const [state, setState] = useState<{ src: string; meta: LoadedImageMeta }>(() => ({
    src: src ?? "",
    meta: initialMeta(src),
  }));

  useEffect(() => {
    const cleanSrc = src ?? "";
    if (!cleanSrc) {
      setState({ src: "", meta: { loaded: false, error: true } });
      return;
    }

    let alive = true;
    const base = initialMeta(cleanSrc);
    setState({ src: cleanSrc, meta: base });

    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      setState((prev) =>
        prev.src === cleanSrc
          ? {
              src: cleanSrc,
              meta: {
                ...prev.meta,
                width: img.naturalWidth || undefined,
                height: img.naturalHeight || undefined,
                loaded: true,
                error: false,
              },
            }
          : prev
      );
    };
    img.onerror = () => {
      if (!alive) return;
      setState((prev) =>
        prev.src === cleanSrc ? { src: cleanSrc, meta: { ...prev.meta, loaded: false, error: true } } : prev
      );
    };
    img.src = cleanSrc;

    let controller: AbortController | null = null;
    if (fetchSize && !cleanSrc.startsWith("data:") && !cleanSrc.startsWith("blob:")) {
      controller = new AbortController();
      fetch(cleanSrc, { method: "HEAD", signal: controller.signal, cache: "force-cache" })
        .then((res) => {
          if (!alive || !res.ok) return;
          const len = Number(res.headers.get("content-length") ?? "");
          const type = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? null;
          const typeFormat = type?.startsWith("image/")
            ? type.replace("image/", "").replace("jpeg", "jpg").replace("svg+xml", "svg").toUpperCase()
            : null;
          setState((prev) =>
            prev.src === cleanSrc
              ? {
                  src: cleanSrc,
                  meta: {
                    ...prev.meta,
                    bytes: Number.isFinite(len) && len > 0 ? len : prev.meta.bytes,
                    contentType: type,
                    format: typeFormat ?? prev.meta.format,
                  },
                }
              : prev
          );
        })
        .catch(() => {
          /* CORS/server එක HEAD support නැත්නම් size එක පෙන්වන්නේ නෑ */
        });
    }

    return () => {
      alive = false;
      img.onload = null;
      img.onerror = null;
      controller?.abort();
    };
  }, [src, fetchSize]);

  return state.src === (src ?? "") ? state.meta : initialMeta(src);
}

function orientationIcon(aspect?: string | null, width?: number, height?: number): LucideIcon {
  const orientation = orientationForAspect(aspect, width, height);
  if (orientation === "portrait") return RectangleVertical;
  if (orientation === "square") return Square;
  return RectangleHorizontal;
}

export function AspectShape({ aspect, className = "" }: { aspect?: string | null; className?: string }) {
  const info = parseAspectRatio(aspect) ?? parseAspectRatio("4:3")!;
  const landscape = info.ratio >= 1;
  return (
    <span className={`inline-flex h-9 w-12 items-center justify-center ${className}`} aria-hidden="true">
      <span
        className="block rounded-[5px] border-2 border-current shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
        style={{
          background: "color-mix(in srgb, currentColor 10%, transparent)",
          aspectRatio: aspectCssValue(info.label),
          width: landscape ? 34 : Math.max(16, 28 * info.ratio),
          height: landscape ? undefined : 28,
        }}
      />
    </span>
  );
}

export function MediaSizeBadge({
  src,
  aspect,
  lang: langProp,
  variant = "dark",
  showName = false,
  className = "",
}: {
  src?: string | null;
  aspect?: string | null;
  lang?: MediaLang;
  variant?: "dark" | "light";
  showName?: boolean;
  className?: string;
}) {
  const { lang: contextLang } = useLang();
  const lang = langProp ?? contextLang;
  const meta = useImageMeta(src, false);
  const ratio = formatAspectRatio(meta.width, meta.height, aspect) ?? aspect ?? "Image";
  const dims = formatDimensions(meta.width, meta.height)?.replace(/ px$/, "");
  const name = aspectName(ratio, lang);
  const Icon = orientationIcon(ratio, meta.width, meta.height);
  const summary = buildImageMetaSummary({
    width: meta.width,
    height: meta.height,
    aspect: ratio,
    format: meta.format,
    lang,
  });
  const tone =
    variant === "dark"
      ? "bg-slate-950/70 text-white ring-white/25 shadow-[0_10px_28px_-14px_rgba(2,6,23,0.9)]"
      : "bg-indigo-50/95 text-indigo-800 ring-indigo-100 shadow-[0_8px_20px_-14px_rgba(79,70,229,0.65)]";

  return (
    <span
      className={`media-size-badge media-meta-in inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold leading-none ring-1 backdrop-blur-md ${tone} ${className}`}
      title={summary}
      aria-label={summary}
    >
      <Icon size={13} className={variant === "dark" ? "text-amber-300" : "text-indigo-600"} aria-hidden="true" />
      <span>{ratio}</span>
      {showName && (
        <>
          <span className={variant === "dark" ? "text-white/35" : "text-indigo-300"} aria-hidden="true">•</span>
          <span>{name}</span>
        </>
      )}
      {dims && (
        <>
          <span className={variant === "dark" ? "text-white/35" : "text-indigo-300"} aria-hidden="true">•</span>
          <span className="media-size-dims">{dims}</span>
        </>
      )}
    </span>
  );
}

interface DetailItem {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: string;
}

export function MediaDetailsStrip({
  src,
  aspect,
  lang: langProp,
  fetchSize = true,
  className = "",
}: {
  src?: string | null;
  aspect?: string | null;
  lang?: MediaLang;
  fetchSize?: boolean;
  className?: string;
}) {
  const { lang: contextLang } = useLang();
  const lang = langProp ?? contextLang;
  const si = lang === "si";
  const meta = useImageMeta(src, fetchSize);
  const ratio = formatAspectRatio(meta.width, meta.height, aspect) ?? aspect ?? "—";
  const dims = formatDimensions(meta.width, meta.height);
  const mp = formatMegapixels(meta.width, meta.height);
  const fileSize = formatFileSize(meta.bytes);
  const orientation = orientationLabel(orientationForAspect(ratio, meta.width, meta.height), lang);
  const ratioName = aspectName(ratio, lang);
  const ratioSub = ratioName === orientation ? ratioName : `${ratioName} · ${orientation}`;
  const summary = buildImageMetaSummary({
    width: meta.width,
    height: meta.height,
    aspect: ratio,
    format: meta.format,
    bytes: meta.bytes,
    lang,
  });

  const detecting = si ? "හඳුනාගනිමින්…" : "Detecting…";
  const unavailable = si ? "ලබාගත නොහැකියි" : "Unavailable";
  const items: DetailItem[] = [
    {
      icon: Expand,
      label: si ? "පින්තූර ප්‍රමාණය" : "Image Size",
      value: dims ?? (meta.error ? unavailable : detecting),
      sub: mp ?? (si ? "මුල් පින්තූරය" : "Original image"),
      tone: "bg-indigo-600",
    },
    {
      icon: Proportions,
      label: si ? "දර්ශන අනුපාතය" : "Aspect Ratio",
      value: ratio,
      sub: ratioSub,
      tone: "bg-violet-600",
    },
    {
      icon: FileImage,
      label: si ? "ආකෘතිය" : "Format",
      value: meta.format ?? "IMAGE",
      sub: meta.contentType ?? (si ? "පින්තූර ගොනුව" : "Image file"),
      tone: "bg-amber-500",
    },
    {
      icon: HardDrive,
      label: si ? "ගොනු ප්‍රමාණය" : "File Size",
      value: fileSize ?? (fetchSize && !meta.error ? detecting : unavailable),
      sub: fileSize ? (si ? "මුල් ගොනුව" : "Original file") : si ? "සේවාදායකයෙන් නොලැබේ" : "Not sent by server",
      tone: "bg-emerald-600",
    },
  ];

  return (
    <div
      className={`media-details-strip media-meta-in grid grid-cols-2 gap-2.5 lg:grid-cols-4 ${className}`}
      role="group"
      aria-label={summary}
      title={summary}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 px-3 py-2.5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)]"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${item.tone}`}>
              <Icon size={15} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[8.5px] font-black uppercase tracking-[0.14em] text-slate-400">
                {item.label}
              </span>
              <span className="block truncate text-[12px] font-black leading-tight text-slate-900">{item.value}</span>
              <span className="block truncate text-[9.5px] font-semibold leading-tight text-slate-400">{item.sub}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
