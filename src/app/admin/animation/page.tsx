"use client";

// ============================================================================
// Animation — business එකක් ගානේ page background/watermark image + brightness
//             + උඩින් animate වෙලා පේන product images (system_settings)
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink, ImagePlus, Plus, Save, Search, Sparkles, SunMedium, Trash2, Upload, X,
} from "lucide-react";
import { AdminTopbar, dbUpsert, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import { uploadSiteImage } from "@/lib/supabase/storage";
import {
  BUSINESS_ANIMATION_KEY,
  MAX_ANIMATION_BRIGHTNESS,
  MIN_ANIMATION_BRIGHTNESS,
  animationMarqueeDurationSeconds,
  animationWatermarkOpacity,
  clampAnimationBrightness,
  emptyBusinessAnimation,
  normalizeBusinessAnimation,
  parseBusinessAnimations,
  serializeBusinessAnimations,
} from "@/lib/animation-settings";
import { BUSINESSES } from "@/lib/seed";
import type { BusinessAnimation } from "@/lib/types";

type UnitOption = { slug: string; name_en: string; name_si: string; logo: string };

const seedUnits: UnitOption[] = BUSINESSES.map((b) => ({
  slug: b.slug,
  name_en: b.name_en,
  name_si: b.name_si,
  logo: b.logo || "",
}));

export default function AdminAnimationPage() {
  const { show, node } = useNotice();
  const [units, setUnits] = useState<UnitOption[]>(seedUnits);
  const [selected, setSelected] = useState(seedUnits[0]?.slug ?? "ristbury-tiara");
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Record<string, BusinessAnimation>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingProducts, setUploadingProducts] = useState(false);
  const [productUrl, setProductUrl] = useState("");

  // DB එකෙන් businesses + animation settings load කරයි (නැතිනම් seed list එක)
  useEffect(() => {
    (async () => {
      try {
        const sb = await authedClient();
        const [unitsRes, settingsRes] = await Promise.all([
          sb.from("business_units").select("*"),
          sb.from("system_settings").select("key,value").eq("key", BUSINESS_ANIMATION_KEY).maybeSingle(),
        ]);
        if (unitsRes.data && unitsRes.data.length) {
          const rows = [...(unitsRes.data as Record<string, unknown>[])]
            .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
            .map((b) => ({
              slug: String(b.slug ?? ""),
              name_en: String(b.name_en ?? b.slug ?? ""),
              name_si: String(b.name_si ?? ""),
              logo: String(b.logo ?? ""),
            }))
            .filter((u) => u.slug);
          if (rows.length) {
            setUnits(rows);
            setSelected((cur) => (rows.some((u) => u.slug === cur) ? cur : rows[0].slug));
          }
        }
        const raw = (settingsRes.data as { value?: string } | null)?.value;
        if (raw) setAll(parseBusinessAnimations(raw));
      } catch {
        /* seed fallback */
      }
      setLoaded(true);
    })();
  }, []);

  const draft: BusinessAnimation = all[selected] ?? emptyBusinessAnimation();
  const current = units.find((u) => u.slug === selected) ?? units[0];

  function patch(p: Partial<BusinessAnimation>) {
    setAll((prev) => ({
      ...prev,
      [selected]: normalizeBusinessAnimation({ ...(prev[selected] ?? emptyBusinessAnimation()), ...p }),
    }));
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return units.filter((u) => !s || u.name_en.toLowerCase().includes(s) || u.name_si.includes(q.trim()) || u.slug.includes(s));
  }, [q, units]);

  async function onBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploadingBg(true);
    const res = await uploadSiteImage(f, "animation-bg", { maxSize: 1600, quality: 0.9 });
    setUploadingBg(false);
    if (res?.url) {
      patch({ bgImage: res.url });
      show("✅ Background image එක upload වුණා — Save කරන්න");
    } else {
      show(`⚠ ${res?.error ?? "Background upload failed"}`);
    }
  }

  async function onProductFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploadingProducts(true);
    const urls: string[] = [];
    for (const f of files) {
      const res = await uploadSiteImage(f, "animation-products", { maxSize: 900, quality: 0.9 });
      if (res?.url) urls.push(res.url);
    }
    setUploadingProducts(false);
    if (urls.length) {
      patch({ products: [...draft.products, ...urls] });
      show(`✅ Product images ${urls.length}ක් එකතු වුණා — Save කරන්න`);
    } else {
      show("⚠ Product images upload වුණේ නෑ");
    }
  }

  function addProductUrl() {
    const url = productUrl.trim();
    if (!url) return;
    patch({ products: [...draft.products, url] });
    setProductUrl("");
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    const err = await dbUpsert("system_settings", {
      key: BUSINESS_ANIMATION_KEY,
      value: serializeBusinessAnimations(all),
    });
    setSaving(false);
    show(err ? `⚠ ${err}` : "✅ Animation settings save වුණා — business පිටුවල පේනවා");
  }

  return (
    <div className="w-full min-w-0 max-w-full pb-36">
      <AdminTopbar
        title="Animation"
        sub="Business පිටුවල උඩ background / watermark image එකයි, animate වෙලා පේන product images ටිකයි මෙතැනින් හදන්න."
      />
      {node}

      <div className="card min-w-0 max-w-full p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-slate-900">
              <Sparkles size={17} className="text-indigo-600" /> Business Page Animation Settings
            </h3>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-500">
              වම් පැත්තෙන් business එකක් තෝරන්න. දාන <b>image එක මුළු business පිටුවේම පසුබිමට (watermark)</b> වැටෙනවා —
              logo එක පිටිපස්සේ නෙවෙයි. එහි <b>brightness</b> එක සහ පිටුවේ උඩින් <b>animate වෙලා යන product images</b>
              මෙතැනින් වෙනස් කළ හැක. Save කළාම අදාළ business පිටුවේම පේනවා. මේ settings සහ images දෙකම Backup එකටත් ඇතුළත් වෙනවා.
            </p>
          </div>
          <button className="btn btn-primary max-w-full shrink-0 whitespace-nowrap" onClick={save} disabled={saving || uploadingBg || uploadingProducts}>
            <Save size={15} /> {saving ? "Saving..." : "Save Animation Settings"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 max-w-full gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── Business list ─────────────────────────────────────────── */}
        <div className="card h-fit min-w-0 max-w-full p-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="field !pl-9"
              placeholder="Search business..."
            />
          </div>
          <div className="mt-3 max-h-[560px] min-w-0 max-w-full space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((u) => {
              const a = all[u.slug];
              const active = u.slug === selected;
              return (
                <button
                  key={u.slug}
                  type="button"
                  onClick={() => setSelected(u.slug)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                    active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-[11px] font-black text-slate-700">
                    {u.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      u.name_en.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-extrabold text-slate-900">{u.name_en}</span>
                    <span className="block truncate text-[10.5px] text-slate-400">{u.name_si || u.slug}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {a?.bgImage && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[8.5px] font-black text-emerald-700">BG ✓</span>
                    )}
                    {(a?.products.length ?? 0) > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8.5px] font-black text-amber-700">
                        {a!.products.length} products
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-[12px] text-slate-400">ගැලපෙන business එකක් නෑ</p>
            )}
          </div>
        </div>

        {/* ── Settings for selected business ─────────────────────────── */}
        <div className="card min-w-0 max-w-full overflow-hidden p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="break-words text-[15px] font-extrabold text-slate-900">{current?.name_en}</h4>
              <p className="break-words text-[11px] text-slate-400">{current?.name_si} · /businesses/{selected}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a
                href={`/businesses/${selected}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline shrink-0 whitespace-nowrap !px-3 !py-1.5 !text-[11.5px]"
              >
                <ExternalLink size={13} /> View Page
              </a>
              <button
                type="button"
                className="btn btn-outline shrink-0 whitespace-nowrap !px-3 !py-1.5 !text-[11.5px] !text-rose-600"
                onClick={() => patch(emptyBusinessAnimation())}
              >
                <Trash2 size={13} /> Clear All
              </button>
            </div>
          </div>

          {/* Live preview — උඩ hero එකයි, යට මුළු පිටුවේම watermark එකයි */}
          <div className="mt-4 min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200">
            <div className="hero-dark relative text-white">
              <div className="relative min-w-0 max-w-full px-5 py-6">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Preview</div>
                <div className="mt-1.5 break-words text-xl font-black">{current?.name_en}</div>
                {draft.products.length > 0 ? (
                  <div className="biz-products-marquee mt-4 w-full min-w-0 max-w-full">
                    <div
                      className="biz-products-track"
                      style={{ animationDuration: `${animationMarqueeDurationSeconds(draft.products.length)}s` }}
                    >
                      {[...draft.products, ...draft.products].map((src, i) => (
                        <div
                          key={`${src}-${i}`}
                          aria-hidden={i >= draft.products.length}
                          className="biz-product-float group flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/95 p-1 shadow-xl ring-1 ring-white/40 transition-shadow duration-300 hover:shadow-2xl"
                          style={{ animationDelay: `${-(i % draft.products.length) * 0.55}s` }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="h-full w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.06]" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-[11.5px] text-slate-300">තවම product images නෑ — පහළින් එකතු කරන්න.</p>
                )}
              </div>
            </div>
            {/* පිටුවේ අනිත් කොටස — image එක මෙතැන watermark එකක් විදිහට පේනවා */}
            <div className="relative min-w-0 max-w-full overflow-hidden bg-slate-50 px-5 py-5">
              {draft.bgImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.bgImage}
                  alt=""
                  aria-hidden="true"
                  className="biz-anim-bg absolute inset-0 h-full w-full object-cover"
                  style={{
                    opacity: animationWatermarkOpacity(draft.brightness),
                    filter: `brightness(${draft.brightness}%)`,
                  }}
                />
              ) : null}
              <div className="relative min-w-0 max-w-full">
                <div className="text-[13px] font-extrabold text-slate-900">Offered Services</div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-sm">
                      <div className="h-2 w-3/4 rounded bg-slate-200" />
                      <div className="mt-2 h-2 w-full rounded bg-slate-100" />
                      <div className="mt-1.5 h-2 w-2/3 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10.5px] font-medium text-slate-500">
                  {draft.bgImage
                    ? "↑ Image එක මේ විදිහට මුළු පිටුවේම පිටිපස්සේ watermark එකක් වගේ පේනවා (logo එක පිටිපස්සේ නෙවෙයි)."
                    : "Background image එකක් දැම්මම ඒක මේ කොටසේ — මුළු පිටුවේම — පිටිපස්සේ watermark එකක් වගේ පේනවා."}
                </p>
              </div>
            </div>
          </div>

          {/* Background image */}
          <div className="mt-6">
            <label className="field-label flex items-center gap-1.5">
              <ImagePlus size={13} /> Background / Watermark Image
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="btn btn-outline cursor-pointer !py-2 !text-[12px]">
                <Upload size={14} /> {uploadingBg ? "Uploading..." : draft.bgImage ? "Change Image" : "Upload Image"}
                <input type="file" accept="image/*" className="hidden" onChange={onBgFile} disabled={uploadingBg} />
              </label>
              {draft.bgImage && (
                <button
                  type="button"
                  className="btn btn-outline !py-2 !text-[12px] !text-rose-600"
                  onClick={() => patch({ bgImage: "" })}
                >
                  <X size={13} /> Remove
                </button>
              )}
            </div>
            <input
              className="field mt-2.5 min-w-0 max-w-full"
              value={draft.bgImage}
              onChange={(e) => patch({ bgImage: e.target.value })}
              placeholder="or paste image URL / path"
            />
          </div>

          {/* Brightness */}
          <div className="mt-5">
            <label className="field-label flex items-center gap-1.5">
              <SunMedium size={13} /> Watermark Brightness — {draft.brightness}%
            </label>
            <div className="flex min-w-0 max-w-full items-center gap-3">
              <span className="text-[10.5px] font-bold text-slate-400">Faint</span>
              <input
                type="range"
                min={MIN_ANIMATION_BRIGHTNESS}
                max={MAX_ANIMATION_BRIGHTNESS}
                step={5}
                value={draft.brightness}
                onChange={(e) => patch({ brightness: clampAnimationBrightness(Number(e.target.value)) })}
                className="min-w-0 flex-1 accent-indigo-700"
              />
              <span className="text-[10.5px] font-bold text-slate-400">Strong</span>
              <input
                type="number"
                min={MIN_ANIMATION_BRIGHTNESS}
                max={MAX_ANIMATION_BRIGHTNESS}
                value={draft.brightness}
                onChange={(e) => patch({ brightness: clampAnimationBrightness(Number(e.target.value)) })}
                className="field !w-24 shrink-0 !py-1.5 text-center"
              />
            </div>
            <p className="mt-1 text-[10.5px] text-slate-400">
              අඩු අගයක් = watermark එක ලාවට පේනවා. වැඩි අගයක් = තදින් පේනවා. අකුරු කියවන්න බැරි තරමට තද වෙන්නේ නැති වෙන්න උපරිමය සීමා කරලා තියෙනවා.
            </p>
          </div>

          {/* Product images */}
          <div className="mt-6">
            <label className="field-label">
              Animated Product Images ({draft.products.length})
            </label>
            {draft.products.length > 0 && (
              <div className="mb-3 grid min-w-0 max-w-full grid-cols-4 gap-2.5 sm:grid-cols-6">
                {draft.products.map((src, i) => (
                  <div key={`${src}-${i}`} className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Product ${i + 1}`} className="h-16 w-full rounded-xl object-contain" />
                    <button
                      type="button"
                      title="Remove product image"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white opacity-90 hover:bg-rose-700"
                      onClick={() => patch({ products: draft.products.filter((_, j) => j !== i) })}
                    >
                      <X size={11} />
                    </button>
                    <div className="pb-0.5 text-center text-[9px] font-bold text-slate-400">#{i + 1}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2.5">
              <label className="btn btn-outline max-w-full shrink-0 cursor-pointer whitespace-nowrap !py-2 !text-[12px]">
                <Upload size={14} /> {uploadingProducts ? "Uploading..." : "Upload Product Images"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onProductFiles}
                  disabled={uploadingProducts}
                />
              </label>
              <div className="flex min-w-0 flex-1 basis-[260px] gap-2">
                <input
                  className="field min-w-0 flex-1"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addProductUrl();
                    }
                  }}
                  placeholder="or paste product image URL"
                />
                <button type="button" className="btn btn-outline shrink-0 whitespace-nowrap !py-2 !text-[12px]" onClick={addProductUrl}>
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-[10.5px] text-slate-400">
              Product packshot images (PNG/JPG) හොඳයි — කැමති ගාණක් එකතු කළ හැක (සීමාවක් නෑ). පිටුවේ උඩින් මේවා
              හිමීට scroll වෙලා යනවා; mouse එක ගෙනාවම නවතිනවා. Images වැඩි වුණත් scroll වෙන වේගය එකමයි.
            </p>
          </div>

          <div className="mt-6 flex min-w-0 max-w-full flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="min-w-0 flex-1 text-[11px] text-slate-400">
              {loaded ? "වෙනස්කම් Save කරන තෙක් site එකේ පේන්නේ නෑ." : "Settings load වෙමින්..."}
            </p>
            <button className="btn btn-primary max-w-full shrink-0 whitespace-nowrap" onClick={save} disabled={saving || uploadingBg || uploadingProducts}>
              <Save size={15} /> {saving ? "Saving..." : "Save Animation Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
