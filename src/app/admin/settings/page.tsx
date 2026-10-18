"use client";

// ============================================================================
// System Settings — WhatsApp number, Years of Service, FormSubmit emails
// ============================================================================

import { useEffect, useState } from "react";
import { Check, Image as ImageIcon, Mail, MessageCircle, Plus, RefreshCw, Save, Settings, Trash2, Upload, Globe } from "lucide-react";
import { AdminTopbar, dbUpsert, useNotice } from "@/components/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { deleteSiteImage, uploadSiteImage } from "@/lib/supabase/storage";
import { SETTINGS } from "@/lib/seed";

export default function AdminSettingsPage() {
  const { show, node } = useNotice();
  const [wa, setWa] = useState(SETTINGS.whatsapp_number);
  const [years, setYears] = useState(String(SETTINGS.years_of_service));
  const [heroImages, setHeroImages] = useState<string[]>([...SETTINGS.hero_images]);
  const [newImg, setNewImg] = useState("");
  const [membersTotal, setMembersTotal] = useState(String(SETTINGS.members_total));
  const [votersTotal, setVotersTotal] = useState(String(SETTINGS.voters_total));
  const [loaded, setLoaded] = useState(false);
  const [socialWa, setSocialWa] = useState<string>("");
  const [socialFb, setSocialFb] = useState<string>("");
  const [siteLogo, setSiteLogo] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);

  // DB එකෙන් saved values load කරන්න (seed නෙමෙයි!)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isSupabaseConfigured()) { setLoaded(true); return; }
      try {
        const { data } = await createClient().from("system_settings").select("*");
        if (!alive || !data || data.length === 0) { setLoaded(true); return; }
        const map = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]));
        const g = (k: string) => map.get(k);
        if (g("whatsapp_number") != null) setWa(g("whatsapp_number")!);
        if (g("years_of_service") != null) setYears(g("years_of_service")!);
        if (g("members_total") != null) setMembersTotal(g("members_total")!);
        if (g("voters_total") != null) setVotersTotal(g("voters_total")!);
        if (g("social_whatsapp") != null) setSocialWa(g("social_whatsapp")!);
        if (g("social_facebook") != null) setSocialFb(g("social_facebook")!);
        if (g("site_logo") != null) setSiteLogo(g("site_logo")!);
        const hero = g("hero_images");
        if (hero) {
          try { const arr = JSON.parse(hero); if (Array.isArray(arr)) setHeroImages(arr); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  const addImage = () => {
    const v = newImg.trim();
    if (!v) return;
    if (heroImages.length >= 10) {
      show("⚠ Hero images උපරිම 10ක් දක්වායි");
      return;
    }
    setHeroImages((xs) => [...xs, v]);
    setNewImg("");
  };

  const moveImage = (i: number, dir: -1 | 1) => {
    setHeroImages((xs) => {
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const copy = [...xs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  return (
    <div>
      <AdminTopbar title="System Settings" sub="Review and manage member records, moderate gallery discussions, and configure communication preferences." />
      {node}

      <div className="card p-7 max-w-4xl space-y-8">
        {/* WhatsApp */}
        <section>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <MessageCircle size={20} className="text-emerald-600" /> Password Reset WhatsApp Number
          </h2>
          <p className="text-slate-500 text-[12.5px] mt-1.5 leading-relaxed">
            When a member uses the &apos;Forgot Password&apos; option, their details will be pre-filled into a WhatsApp message
            sent to this mobile number.
          </p>
          <div className="mt-4">
            <label className="field-label">Support WhatsApp Number (International format with country code)</label>
            <input value={wa} onChange={(e) => setWa(e.target.value)} className="field" placeholder="94742352670" />
            <p className="text-slate-400 text-[10.5px] mt-1.5">
              Example for Sri Lanka: 94771234567 (without leading 0 or spaces).
            </p>
          </div>
        </section>

        {/* Years + counters */}
        <section className="border-t border-slate-100 pt-7">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Settings size={20} className="text-indigo-700" /> Homepage Statistics Counters
          </h2>
          <p className="text-slate-500 text-[12.5px] mt-1.5 leading-relaxed">
            මුල් පිටුවේ statistics cards වල පෙන්වන ගණන් — Save Settings ඔබන විට site එකේ සුරැකේ.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label">Years of Service</label>
              <input value={years} onChange={(e) => setYears(e.target.value)} className="field max-w-xs" />
            </div>
            <div>
              <label className="field-label">Total Members (සාමාජිකයින්)</label>
              <input value={membersTotal} onChange={(e) => setMembersTotal(e.target.value)} className="field max-w-xs" />
            </div>
            <div>
              <label className="field-label">Total Voters (ඡන්ද දායකයින්)</label>
              <input value={votersTotal} onChange={(e) => setVotersTotal(e.target.value)} className="field max-w-xs" />
            </div>
          </div>
        </section>

        {/* ✅ SITE LOGO — header/footer/hero බෝලයේ පෙන්වන logo එක */}
        <section className="border-t border-slate-100 pt-7">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <ImageIcon size={20} className="text-fuchsia-600" /> Site Logo (Header / Footer බෝලය)
          </h2>
          <p className="text-slate-500 text-[12.5px] mt-1.5 leading-relaxed">
            මෙතනින් logo image එකක් upload කළොත් header එකේ, footer එකේ සහ hero එකේ තියෙන රවුම් බෝලයේ
            ඒ logo එක පෙන්වයි. Logo එකක් නැත්නම් කලින් වගේ <strong>coop</strong> බෝලය පෙන්වයි.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white flex items-center justify-center text-[11px] font-black shrink-0 ring-4 ring-white shadow">
              {siteLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={siteLogo} alt="Site logo" className="w-full h-full object-cover" />
              ) : (
                "coop"
              )}
            </div>
            <div className="flex-1 min-w-[240px]">
              <label className="btn btn-outline cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={logoBusy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setLogoBusy(true);
                    const { url, error } = await uploadSiteImage(file, "logo");
                    if (error || !url) {
                      setLogoBusy(false);
                      show(`⚠ ${error}`);
                      return;
                    }
                    setSiteLogo(url);
                    const err = await dbUpsert("system_settings", { key: "site_logo", value: url });
                    setLogoBusy(false);
                    show(err ? `⚠ ${err}` : "✅ Logo එක upload වී site එකේ පෙන්වයි — Ctrl+Shift+R");
                  }}
                />
                <Upload size={15} /> {logoBusy ? "Uploading…" : "Logo Upload කරන්න"}
              </label>
              {siteLogo && (
                <button
                  type="button"
                  className="btn btn-outline ml-2 !text-rose-600 !border-rose-200 hover:!bg-rose-50"
                  onClick={async () => {
                    setSiteLogo("");
                    const err = await dbUpsert("system_settings", { key: "site_logo", value: "" });
                    show(err ? `⚠ ${err}` : "✅ Logo එක ඉවත් කළා");
                  }}
                >
                  <Trash2 size={15} /> ඉවත් කරන්න
                </button>
              )}
              <input
                value={siteLogo}
                onChange={(e) => setSiteLogo(e.target.value)}
                className="field mt-2.5 !text-[12px]"
                placeholder="හෝ image URL එකක් ලියන්න: https://... (Save Settings ඔබන්න)"
              />
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-[11.5px] text-amber-900 mt-3">
            💡 Upload කළ ගමන්ම save වේ. හොඳම ප්‍රතිඵලයට <strong>500×500 ට අඩු රවුම් (square) PNG</strong> එකක් භාවිතා කරන්න.
          </div>
        </section>

        {/* hero background slideshow */}
        <section className="border-t border-slate-100 pt-7">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <ImageIcon size={20} className="text-amber-600" /> Hero Background Images (Homepage Slideshow)
          </h2>
          <p className="text-slate-500 text-[12.5px] mt-1.5 leading-relaxed">
            මුල් පිටුවේ hero background එකේ පෙන්වන ඡායාරූප (5ක් හෝ ඊට වැඩි). ඡායාරූප ස්වයංක්‍රීයව animation එකක් සමඟ
            මාරු වේ — පිළිවෙල වෙනස් කිරීමට ↑ ↓ භාවිතා කරන්න (උපරිම 10ක්).
          </p>

          <div className="space-y-2.5 mt-4">
            {heroImages.map((src, i) => (
              <div key={`${src}-${i}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                <div className="w-24 h-14 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
                <input
                  value={src}
                  onChange={(e) =>
                    setHeroImages((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  className="field !py-2 !text-[12px] flex-1"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center justify-center"
                    onClick={() => moveImage(i, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center justify-center"
                    onClick={() => moveImage(i, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg border border-red-200 bg-white text-red-600 flex items-center justify-center"
                    onClick={async () => {
                      const src = heroImages[i];
                      const next = heroImages.filter((_, j) => j !== i);
                      setHeroImages(next);
                      // ✅ ඉවත් කළ ගමන් DB එකට save — site එකෙන් ක්ෂණිකව අයින් වේ
                      const err = await dbUpsert("system_settings", { key: "hero_images", value: JSON.stringify(next) });
                      await deleteSiteImage(src); // upload කළ image එකක් නම් storage එකෙනුත් මකයි
                      show(err ? `⚠ ${err}` : "✅ Hero image එක ඉවත් කළා — site එකෙන් ද අයින් විය");
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5 mt-4">
            <label className="btn btn-outline cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (heroImages.length >= 10) {
                    show("⚠ Hero images උපරිම 10ක් දක්වායි");
                    return;
                  }
                  const { url, error } = await uploadSiteImage(file, "hero");
                  if (error) {
                    show(`⚠ ${error}`);
                    return;
                  }
                  const next = [...heroImages, url!];
                  setHeroImages(next);
                  const svErr = await dbUpsert("system_settings", { key: "hero_images", value: JSON.stringify(next) });
                  show(svErr ? `⚠ ${svErr}` : "✅ Image එක upload වී site එකේ පෙන්වයි");
                }}
              />
              <Upload size={15} /> Upload Image
            </label>
            <input
              value={newImg}
              onChange={(e) => setNewImg(e.target.value)}
              className="field flex-1 min-w-[240px]"
              placeholder="/images/hero/hero-6.jpg හෝ https://... image URL එකක්"
            />
            <button type="button" className="btn btn-primary" onClick={addImage}>
              <Plus size={16} /> Add Hero Image
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setHeroImages([...SETTINGS.hero_images])}
            >
              <RefreshCw size={15} /> Reset to Default (5)
            </button>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-[11.5px] text-amber-900 mt-4">
            💡 <strong>Upload Image</strong> එකෙන් ඔබේ computer එකෙන් image එකක් ඇතුළත් කරන්න (Supabase Storage — admin පමණයි).
            🗑️ delete කළ විට upload කළ image එක storage එකෙනුත් ඉවත් වේ. Slideshow එක තත්පර 6කට වරක් crossfade + zoom
            animation එකක් සමඟ මාරු වේ (උපරිම images 10ක්).
          </div>
        </section>

        {/* Email notifications → Admin → Emails (㉕ එකම තැන) */}
        <section className="border-t border-slate-100 pt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Mail size={20} className="text-indigo-700" /> Email Notifications
            </h2>
            <span className="badge-green rounded-full px-3.5 py-1.5 text-[11px] font-bold">Admin → Emails</span>
          </div>
          <p className="text-slate-500 text-[12px] mt-1.5 leading-relaxed">
            හැම email notification එකක්ම (Membership Applications, Contact / Inquiry, Live Chat, Business Inquiries) දැන්
            එකම තැනකින් පාලනය වේ — එක් කාරනාවකට ලිපින 1–4ක් දාන්න පුළුවන්; හැම ලිපිනයකටම email යයි.
          </p>
          <a href="/admin/emails" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[12px] font-extrabold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700">
            <Mail size={14} /> Emails settings අරින්න →
          </a>
        </section>

        {/* ============ Social Media Links ============ */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 mt-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-[15px]">සමාජ මාධ්‍ය සබැඳි / Social Media Links</h2>
              <p className="text-slate-400 text-[11px]">
                Footer එකේ උඩ සමාජ මාධ්‍ය icons දෙකේ links විතරයි මෙතනින් වෙනස් වෙන්නේ (designer popup එක වෙනම links පාවිච්චි කරයි)
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div>
              <label className="field-label">WhatsApp Link (https://wa.me/947...)</label>
              <input value={socialWa} onChange={(e) => setSocialWa(e.target.value)} className="field" placeholder="https://wa.me/94742352670" />
            </div>
            <div>
              <label className="field-label">Facebook Page Link</label>
              <input value={socialFb} onChange={(e) => setSocialFb(e.target.value)} className="field" placeholder="https://facebook.com/your-page" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3">
            <span className="text-[11px] text-slate-300 font-bold mr-1">Preview:</span>
            <span className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center">💬</span>
            <span className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center">f</span>
            <span className="text-[10.5px] text-slate-400">මේ links යන්නේ footer එකේ උඩ icons දෙකට විතරයි</span>
          </div>
        </section>

        <div className="border-t border-slate-100 pt-6">
          <button
            className="btn btn-primary"
            onClick={async () => {
              const rows = [
                { key: "whatsapp_number", value: wa },
                { key: "years_of_service", value: years },
                { key: "members_total", value: membersTotal },
                { key: "voters_total", value: votersTotal },
                { key: "hero_images", value: JSON.stringify(heroImages) },
                { key: "social_whatsapp", value: socialWa },
                { key: "social_facebook", value: socialFb },
                { key: "site_logo", value: siteLogo },
              ];
              let err: string | null = null;
              for (const row of rows) {
                err = await dbUpsert("system_settings", row);
                if (err) break;
              }
              show(err ? `⚠ ${err}` : `✅ සුරැකුණා! Site එකේ දැන් පෙන්වනවා — Hero images ${heroImages.length}ක්`);
            }}
          >
            <Save size={16} /> {loaded ? "Save Settings" : "Loading saved settings…"}
          </button>
        </div>
      </div>
    </div>
  );
}
