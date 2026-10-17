"use client";

// ============================================================================
// Apply for MPCS Membership — form + instructions + certified form upload
// ============================================================================

import { useEffect, useState } from "react";
import {
  ArrowRight, CheckCircle2, FileText, Info, LogIn, ShieldCheck, UploadCloud,
} from "lucide-react";
import { useLang } from "@/lib/i18n";

export function ApplyForm() {
  const { t, lang } = useLang();
  const [sent, setSent] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [hideBanner, setHideBanner] = useState(false);
  const [upMsg, setUpMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // ✅ sign in වෙලා නම් banner නෑ — account එකෙන් data auto-fill
  const [me, setMe] = useState<{ full_name?: string; nic?: string; phone?: string } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { authedClient } = await import("@/lib/supabase/client");
        const sb = await authedClient();
        const { data: sess } = await sb.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const { data: prof } = await sb.from("profiles").select("full_name, nic, phone").eq("id", uid).single();
        if (prof) setMe({ full_name: prof.full_name || "", nic: prof.nic || "", phone: prof.phone || "" });
      } catch { /* ignore */ }
    })();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    // ✅ photo එක storage එකට upload කරලා URL එක ගන්නවා (admin ලට බලන්න පුළුවන්)
    let photoUrl = "";
    try {
      const { createClient } = await import("@/lib/supabase/client");
      if (fileObj) {
        const sb = createClient();
        const path = `applications/${Date.now()}-${fileObj.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await sb.storage.from("site-images").upload(path, fileObj, { contentType: fileObj.type });
        if (!upErr) photoUrl = sb.storage.from("site-images").getPublicUrl(path).data.publicUrl;
      }
    } catch { /* upload fail — photo නැතුව continue */ }
    try {
      await fetch(`https://formsubmit.co/ajax/${fd.get("_to") || "itk200712@gmail.com"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: "New MPCS Membership Application",
          "Name (Sinhala)": fd.get("name_si"),
          "Name (English)": fd.get("name_en"),
          Address: fd.get("address"),
          "Postal Address": fd.get("postal"),
          NIC: fd.get("nic"),
          Phone: fd.get("phone"),
          Email: fd.get("email") || "—",
          "Certified Form": photoUrl || fileName || "—",
        }),
      });
    } catch {
      /* demo mode */
    }
    // ✅ save to DB so Admin → Membership Applications පැනලයේ පේනවා
    try {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().from("membership_applications").insert({
        name_si: String(fd.get("name_si") || ""),
        name_en: String(fd.get("name_en") || ""),
        address: String(fd.get("address") || ""),
        postal_address: String(fd.get("postal") || ""),
        nic: String(fd.get("nic") || ""),
        phone: String(fd.get("phone") || ""),
        email: String(fd.get("email") || null),
        certified_form_url: photoUrl || null,
        status: "pending",
      });
    } catch {
      /* offline — email still sent */
    }
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="card p-12 text-center">
        <CheckCircle2 size={52} className="text-emerald-500 mx-auto" />
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900">{t.applyPage.success}</h2>
        <p className="text-slate-500 mt-2 text-sm">
          {lang === "si"
            ? "Admin → Membership Applications පැනලයෙන් ඔබේ අයදුම්පත සමාලෝචනය කරනු ලැබේ."
            : "Your application will be reviewed from the Admin → Membership Applications panel."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="card p-6 sm:p-7 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
          <FileText size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t.applyPage.title}</h1>
          <p className="text-slate-500 text-[13px] mt-1">{t.applyPage.sub}</p>
        </div>
      </div>

      {/* auto-fill — sign in වෙලා නම් නොපෙන්වයි ("Later / Apply Now" ක්ලික් කළත් අයින් වේ) */}
      {!hideBanner && !me && (
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <LogIn size={18} />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-slate-900">{t.applyPage.autoFill}</div>
            <p className="text-slate-600 text-[12.5px] mt-1 leading-relaxed">{t.applyPage.autoFillSub}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/signin" className="btn btn-primary !py-2 !px-4 !text-[12.5px]">
                <LogIn size={14} /> {t.applyPage.signinRegister} <ArrowRight size={14} />
              </a>
              <a href="#apply-form" className="btn btn-outline !py-2 !px-4 !text-[12.5px]" onClick={() => setHideBanner(true)}>
                {t.applyPage.later}
              </a>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* instructions */}
      <div className="card p-6 sm:p-7">
        <div className="flex items-center gap-2 text-slate-800 font-extrabold">
          <Info size={18} className="text-indigo-700" /> {t.applyPage.instructions}
        </div>
        <div className="border-t border-slate-100 my-4" />
        <p className="text-slate-600 text-[13px] font-semibold">
          {lang === "si"
            ? "ඔබේ අයදුම්පත ඉදිරිපත් කිරීමට පෙර පහත උපදෙස් ප්‍රවේශමෙන් කියවන්න:"
            : "Please review the following instructions carefully before completing your submission:"}
        </p>
        <ul className="mt-3 space-y-2.5 text-[13px] text-slate-600">
          {[t.applyPage.instr1, t.applyPage.instr2, t.applyPage.instr4].map((line) => (
            <li key={line} className="flex gap-2.5">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>{line}</span>
            </li>
          ))}
          <li className="flex gap-2.5">
            <span className="text-slate-400 mt-0.5">•</span>
            <span>
              <strong className="text-slate-800">Official Branch Rubber Stamp:</strong> {t.applyPage.instr3.split(":").slice(1).join(":")}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-slate-400 mt-0.5">•</span>
            <span className="text-indigo-700 font-bold">{t.applyPage.instr5}</span>
          </li>
        </ul>
      </div>

      {/* form */}
      <form id="apply-form" onSubmit={submit} className="card p-6 sm:p-8 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label">{t.applyPage.nameSi} *</label>
            <input name="name_si" required className="field" defaultValue={me?.full_name || ""} placeholder="උදා: නි. කේ. නිමල් පෙරේරා" />
          </div>
          <div>
            <label className="field-label">{t.applyPage.nameEn} *</label>
            <input name="name_en" required className="field" defaultValue={me?.full_name || ""} placeholder="e.g. K. A. Nimal Perera" />
          </div>
        </div>
        <div>
          <label className="field-label">{t.applyPage.addressField} *</label>
          <input name="address" required className="field" placeholder="Your permanent residential address..." />
        </div>
        <div>
          <label className="field-label">{t.applyPage.postal} *</label>
          <input name="postal" required className="field" placeholder="Mailing address for official correspondence..." />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label">{t.applyPage.nicField} *</label>
            <input name="nic" required className="field" defaultValue={me?.nic || ""} placeholder="e.g. 199012345678 or 901234567V" />
          </div>
          <div>
            <label className="field-label">{t.applyPage.phoneField} *</label>
            <input name="phone" required className="field" defaultValue={me?.phone || ""} placeholder="07X XXXXXXX" />
          </div>
        </div>
        <div>
          <label className="field-label">{t.applyPage.emailField}</label>
          <input name="email" type="email" className="field" placeholder="name@example.com" />
        </div>

        {/* upload */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="field-label !mb-0 uppercase tracking-wider">{t.applyPage.photo} *</label>
            <span className="text-indigo-700 text-[11.5px] font-bold">{t.applyPage.photoNote}</span>
          </div>
          <p className="text-slate-500 text-[12px] mt-2 leading-relaxed">{t.applyPage.photoDesc}</p>
          <label className="mt-3 block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center cursor-pointer hover:border-indigo-400 transition">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFileObj(f);
                setFileName(f?.name ?? "");
                setUpMsg(f ? "✅ තෝරාගත්තා — submit කරාම upload වේ" : "");
              }}
            />
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto">
              <UploadCloud size={22} />
            </div>
            <div className="mt-3 font-bold text-slate-800 text-[13.5px]">
              {fileName || t.applyPage.upload}
            </div>
            <div className="text-slate-400 text-[11.5px] mt-1">{upMsg || t.applyPage.uploadHint}</div>
          </label>
        </div>

        <div className="border-t border-slate-100 pt-5 flex flex-wrap justify-end gap-3">
          <a href="/" className="btn btn-outline">{t.applyPage.cancel}</a>
          <button type="submit" disabled={busy} className="btn btn-primary">
            <ShieldCheck size={16} /> {busy ? "..." : t.applyPage.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
