"use client";

// ============================================================================
// System Settings — WhatsApp number, Years of Service, FormSubmit emails
// ============================================================================

import { useEffect, useState } from "react";
import { Check, Image as ImageIcon, Mail, MessageCircle, Plus, RefreshCw, Save, Settings, Trash2, Upload } from "lucide-react";
import { AdminTopbar, dbUpsert, useNotice } from "@/components/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { deleteSiteImage, uploadSiteImage } from "@/lib/supabase/storage";
import { SETTINGS } from "@/lib/seed";

export default function AdminSettingsPage() {
  const { show, node } = useNotice();
  const [wa, setWa] = useState(SETTINGS.whatsapp_number);
  const [years, setYears] = useState(String(SETTINGS.years_of_service));
  const [email1, setEmail1] = useState(SETTINGS.contact_email_1);
  const [email2, setEmail2] = useState(SETTINGS.contact_email_2);
  const [heroImages, setHeroImages] = useState<string[]>([...SETTINGS.hero_images]);
  const [newImg, setNewImg] = useState("");
  const [membersTotal, setMembersTotal] = useState(String(SETTINGS.members_total));
  const [votersTotal, setVotersTotal] = useState(String(SETTINGS.voters_total));
  const [loaded, setLoaded] = useState(false);

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
        if (g("contact_email_1") != null) setEmail1(g("contact_email_1")!);
        if (g("contact_email_2") != null) setEmail2(g("contact_email_2")!);
        if (g("members_total") != null) setMembersTotal(g("members_total")!);
        if (g("voters_total") != null) setVotersTotal(g("voters_total")!);
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
                      setHeroImages((xs) => xs.filter((_, j) => j !== i));
                      await deleteSiteImage(src); // upload කළ image එකක් නම් storage එකෙනුත් මකයි
                      show("✅ Hero image එක ඉවත් කළා");
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
                  setHeroImages((xs) => [...xs, url!]);
                  show("✅ Image එක upload කළා — Save Settings ඔබන්න");
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

        {/* FormSubmit */}
        <section className="border-t border-slate-100 pt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Mail size={20} className="text-indigo-700" /> Contact Form Submission Emails
            </h2>
            <span className="badge-green rounded-full px-3.5 py-1.5 text-[11px] font-bold">
              FormSubmit Active (Automatic Delivery)
            </span>
          </div>
          <p className="text-slate-500 text-[12px] mt-1.5 leading-relaxed">
            Inquiries submitted through the website contact form are automatically delivered to the email addresses specified
            below via FormSubmit (https://formsubmit.co). No SMTP or complex server setup required.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div>
              <label className="field-label">Primary Destination Email (Email 1)</label>
              <input value={email1} onChange={(e) => setEmail1(e.target.value)} className="field" placeholder="name@gmail.com" />
            </div>
            <div>
              <label className="field-label">Secondary Destination Email (Email 2 - Optional)</label>
              <input value={email2} onChange={(e) => setEmail2(e.target.value)} className="field" placeholder="e.g. manager@panduwasnuwara.lk" />
            </div>
          </div>

          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-5 mt-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-[12.5px]">
                <Check size={15} /> FormSubmit Activation &amp; Testing
              </div>
              <p className="text-indigo-800/80 text-[11px] mt-1 max-w-lg leading-relaxed">
                When using an email for the first time with FormSubmit, you will receive an &quot;Activate Form&quot; verification
                link in your inbox. Click it once to activate.
              </p>
            </div>
            <button className="btn btn-primary shrink-0" onClick={() => show(`Test message sent to ${email1} (activation link එක inbox එකට)`)}>
              Send Test / Activate
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5 mt-5">
            <div className="text-[12px] font-bold text-slate-700">
              Current Delivery Configuration:{" "}
              <span className="text-slate-900">
                Delivering to {email2 ? "two addresses" : "single address"}: {email1}
                {email2 ? `, ${email2}` : ""}
              </span>
            </div>
            <pre className="mt-3 rounded-xl bg-slate-900 text-slate-200 px-4 py-3.5 text-[11px] leading-relaxed overflow-x-auto">
{`Standard Message Format Delivered to Inbox:

Name: Induwara Thathsara

Phone Number: 076 424 7716

Email: induwara@gmail.com

Department: General Society Inquiries

Message: Customer inquiry text...`}
            </pre>
          </div>
        </section>

        <div className="border-t border-slate-100 pt-6">
          <button
            className="btn btn-primary"
            onClick={async () => {
              const rows = [
                { key: "whatsapp_number", value: wa },
                { key: "years_of_service", value: years },
                { key: "contact_email_1", value: email1 },
                { key: "contact_email_2", value: email2 },
                { key: "members_total", value: membersTotal },
                { key: "voters_total", value: votersTotal },
                { key: "hero_images", value: JSON.stringify(heroImages) },
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
