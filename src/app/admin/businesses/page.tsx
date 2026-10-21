"use client";

// ============================================================================
// Businesses & Services Management
//   Tab 1: Business Divisions (cards + Edit Page & Card + Add New Business)
//   Tab 2: Division Offered Services (per business + Add Service)
//   ✅ Business card "Services (N)" click → Services tab with that business pre-selected
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Building2, CheckCircle2, ExternalLink, Image as ImageIcon, Pencil, Plus, RefreshCw, Search, Trash2,
} from "lucide-react";
import { AdminModal, AdminTopbar, dbDelete, dbInsert, dbUpdate, useNotice } from "@/components/admin";
import { uploadSiteImage } from "@/lib/supabase/storage";
import { authedClient } from "@/lib/supabase/client";
import { BUSINESSES } from "@/lib/seed";
import type { BusinessBranch, BusinessUnit, BusinessService } from "@/lib/types";

const DEFAULT_FEATURES = "Trusted quality, Member privileges, Certified standard";
const COOP_CITY_BRANCH_LIMIT = 5;
const emptyBranch = (): BusinessBranch => ({ name: "", manager: "", location: "", phone: "" });

export default function AdminBusinessesPage() {
  const { show, node } = useNotice();
  const [tab, setTab] = useState<"divisions" | "services">("divisions");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState("rural-bank");
  const [editFor, setEditFor] = useState<BusinessUnit | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const [units, setUnits] = useState<BusinessUnit[]>([...BUSINESSES]);
  const [mgrRows, setMgrRows] = useState<Array<{ role_en: string; role_si: string; name: string; location: string; phone: string }>>([]);
  const [branchRows, setBranchRows] = useState<BusinessBranch[]>([]);
  const [coverPreview, setCoverPreview] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [addLogo, setAddLogo] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // ✅ DB එකෙන් load — add/edit/delete refresh වලදී නැති වෙන්නෑ
  useEffect(() => {
    (async () => {
      try {
        const sb = await authedClient();
        const { data } = await sb.from("business_units").select("*").order("order");
        if (data && data.length) {
          const svcs = await sb.from("business_services").select("*").order("order");
          const contacts = await sb.from("business_contacts").select("*");
          const branches = await sb.from("business_branches").select("*");
          setUnits(data.map((b: Record<string, unknown>) => ({
            ...(b as unknown as BusinessUnit),
            services: (svcs.data ?? []).filter((x: { business_slug: string }) => x.business_slug === (b as { slug: string }).slug),
            contacts: (contacts.data ?? []).filter((x: { business_slug: string }) => x.business_slug === (b as { slug: string }).slug),
            branches: (branches.data ?? []).filter((x: { business_slug: string }) => x.business_slug === (b as { slug: string }).slug),
          })) as BusinessUnit[]);
        }
      } catch { /* seed fallback */ }
    })();
  }, []);

  const openEdit = (b: BusinessUnit) => {
    setEditFor(b);
    setMgrRows(b.contacts.map((c) => ({ role_en: c.role_en, role_si: c.role_si, name: c.name, location: c.location, phone: c.phone })));
    const nextBranches = b.branches.map((br) => ({ ...br }));
    // Coop City එකට ශාඛා 5ක් එකතු කිරීමට ලේසි වෙන්න හිස් slot 5ක් මුලින්ම දෙයි.
    // හිස් rows Save කිරීමේදී ඉවත් වන නිසා වැරදි හිස් ශාඛා site එකේ පෙන්වන්නේ නෑ.
    if (b.slug === "coop-city") {
      while (nextBranches.length < COOP_CITY_BRANCH_LIMIT) nextBranches.push(emptyBranch());
    }
    setBranchRows(nextBranches);
    setCoverPreview(b.cover ?? "");
    setLogoPreview(b.logo ?? "");
  };

  const PRESETS: Record<string, string> = {
    "Rural Bank": "/images/businesses/rural-bank.jpg",
    "Consumer Section": "/images/businesses/consumer.jpg",
    "Maliban Biscuits": "/images/businesses/maliban-biscuits.jpg",
    "Maliban Milk": "/images/businesses/maliban-kiri.jpg",
    "Nature's Secrets": "/images/businesses/natures-secrets.jpg",
    "Hemas Agency": "/images/businesses/hemas.jpg",
    "Ristbury Tiara": "/images/businesses/ristbury-tiara.jpg",
    "Fuel Station": "/images/businesses/fuel-station.jpg",
    "Funeral Services": "/images/businesses/funeral.jpg",
    "Main Logo": "/images/sections/gold-loan.png",
  };

  // ✅ board එකේ වගේම proven pattern — button එකේම file input එක (hidden ref නෑ)
  const doUpload = async (target: "logo" | "cover", f: File) => {
    show("⏳ Image එක upload වෙමින්...");
    const res = await uploadSiteImage(f, target === "logo" ? "businesses" : "covers");
    if (res && res.url) {
      if (target === "logo") {
        if (logoRef.current) logoRef.current.value = res.url;
        setLogoPreview(res.url);
      } else {
        if (coverRef.current) coverRef.current.value = res.url;
        setCoverPreview(res.url);
      }
      show("✅ Image එක upload වුණා — Save කරන්න");
    } else {
      show(`⚠ ${res && res.error ? res.error : "Upload failed — path එකක් අතින් දාන්න"}`);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return units.filter((b) => !s || b.name_en.toLowerCase().includes(s) || b.name_si.includes(q.trim()) || b.slug.includes(s));
  }, [q, units]);

  const current = units.find((b) => b.slug === selected) ?? units[0];

  return (
    <div>
      <AdminTopbar title="Businesses & Services Management" sub="Review and manage member records, moderate gallery discussions, and configure communication preferences." />
      {node}

      {/* header */}
      <div className="card p-6">
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <span className="badge-blue rounded-full px-2.5 py-0.5">{units.length} Divisions</span>
          <span className="text-slate-400">Business Divisions &amp; Services</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Business Divisions Management</h2>
            <p className="text-slate-500 text-[12.5px] mt-1">
              Edit, customize, or delete business division cards, logos, descriptions, managers, and offered services.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500" onClick={() => show("Refreshed")}>
              <RefreshCw size={15} />
            </button>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Add New Business
            </button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex flex-wrap gap-2.5 mt-5">
          <button
            onClick={() => setTab("divisions")}
            className={`rounded-xl px-5 py-2.5 text-[12.5px] font-bold border inline-flex items-center gap-2 ${
              tab === "divisions" ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            <Building2 size={15} /> Business Divisions (Our Businesses)
            <span className="opacity-80">{units.length}</span>
          </button>
          <button
            onClick={() => setTab("services")}
            className={`rounded-xl px-5 py-2.5 text-[12.5px] font-bold border inline-flex items-center gap-2 ${
              tab === "services" ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            <CheckCircle2 size={15} /> Division Offered Services
            <span className="opacity-80">{units.reduce((n, b) => n + b.services.length, 0)}</span>
          </button>
        </div>

        {tab === "divisions" && (
          <div className="relative mt-5 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="field !pl-10" placeholder="Search business divisions..." />
          </div>
        )}
      </div>

      {/* ============================================================ DIVISIONS */}
      {tab === "divisions" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {filtered.map((b) => (
            <div key={b.slug} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  <span className="badge-blue rounded-full px-2.5 py-0.5 text-[9.5px] font-bold">{b.category_en}</span>
                  {b.is_new && <span className="badge-new">NEW</span>}
                  {!b.active && <span className="badge-red rounded-full px-2.5 py-0.5 text-[9.5px] font-bold">Inactive</span>}
                </div>
                <div className="text-[10px] text-slate-400 font-bold tabular-nums">
                  {String(b.order).padStart(2, "0")}
                </div>
              </div>
              <div className="flex items-start gap-3 mt-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0 overflow-hidden">
                  {b.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    b.name_en.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 text-[14.5px] leading-snug">{b.name_en}</div>
                  {b.tagline_en && <div className="text-slate-500 text-[11.5px] truncate">{b.tagline_en}</div>}
                  <div className="text-slate-400 text-[10px] mt-0.5">/{b.slug}</div>
                </div>
              </div>
              {b.desc_en && <p className="text-slate-500 text-[11.5px] leading-relaxed mt-2.5 line-clamp-2">{b.desc_en}</p>}
              {b.contacts[0] && (
                <div className="mt-3 space-y-1 text-[11.5px] text-slate-600">
                  <div>📍 {b.contacts[0].location}</div>
                  <div>👤 {b.contacts[0].name}</div>
                  <div>📞 {b.contacts[0].phone}</div>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-4">
                <button className="btn btn-outline !py-1.5 !px-3 !text-[11px] flex-1" onClick={() => openEdit(b)}>
                  <Pencil size={12} /> Edit Page &amp; Card
                </button>
                <a href={`/businesses/${b.slug}`} target="_blank" className="btn btn-outline !py-1.5 !px-3 !text-[11px]">
                  Live Page <ExternalLink size={11} />
                </a>
                <button
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600"
                  onClick={async () => {
                    setUnits((xs) => xs.filter((x) => x.slug !== b.slug));
                    await dbDelete("business_services", { business_slug: b.slug });
                    await dbDelete("business_contacts", { business_slug: b.slug });
                    await dbDelete("business_branches", { business_slug: b.slug });
                    const err = await dbDelete("business_units", { slug: b.slug });
                    show(err ? `⚠ ${err}` : "✅ Deleted");
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {/* ✅ requirement: Services badge → services tab with this business selected */}
              <button
                className="mt-2.5 badge-amber rounded-full px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 hover:brightness-95"
                onClick={() => {
                  setSelected(b.slug);
                  setTab("services");
                }}
              >
                Services ({b.services.length}) <ArrowRight size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================= SERVICES */}
      {tab === "services" && (
        <div className="mt-6">
          {/* business tabs (scroll) */}
          <div className="scroll-x pb-1">
            <div className="flex gap-2 min-w-max">
              {units.map((b) => (
                <button
                  key={b.slug}
                  onClick={() => setSelected(b.slug)}
                  className={`rounded-xl px-4 py-2.5 text-[11.5px] font-bold border whitespace-nowrap inline-flex items-center gap-2 ${
                    selected === b.slug ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  <Building2 size={13} /> {b.name_en}
                  <span className="opacity-75">{b.services.length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
            <h3 className="text-lg font-extrabold text-slate-900">Services for: {current.name_en}</h3>
            <button className="btn btn-primary" onClick={() => setSvcOpen(true)}>
              <Plus size={15} /> Add Service
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            {current.services.map((s, i) => (
              <div key={s.order} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="num-chip !w-9 !h-9 !text-[12px]">{String(i + 1).padStart(2, "0")}</div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-bold ${s.active ? "badge-green" : "badge-red"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="font-extrabold text-slate-900 text-[14.5px] leading-snug">{s.title_en}</div>
                  <div className="text-slate-500 text-[11.5px]">{s.title_si}</div>
                </div>
                <p className="text-slate-500 text-[11.5px] leading-relaxed mt-2 line-clamp-2">{s.desc_en}</p>
                <ul className="mt-2.5 space-y-1">
                  {s.features_en.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <CheckCircle2 size={12} className="text-emerald-500" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-100">
                  <div className="text-[10.5px] text-slate-400 font-semibold">Order: {s.order}</div>
                  <div className="flex gap-1.5">
                    <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500" onClick={() => show("Edit service")}>
                      <Pencil size={13} />
                    </button>
                    <button
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600"
                      onClick={() => {
                        setUnits((xs) =>
                          xs.map((b) =>
                            b.slug === current.slug
                              ? { ...b, services: b.services.filter((x) => x.order !== s.order) }
                              : b
                          )
                        );
                        dbDelete("business_services", { business_slug: current.slug, order: s.order });
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {current.services.length === 0 && (
              <div className="card p-10 text-center text-slate-400 text-[13px] lg:col-span-3">
                මේ ඒකකය සඳහා සේවා නැත — Add Service එකෙන් එකතු කරන්න.
              </div>
            )}
          </div>
        </div>
      )}


      {/* ============================================================ MODALS */}
      {editFor && (
        <AdminModal title="Edit Business Division" sub="Update titles, taglines, category, descriptions, and logo" onClose={() => setEditFor(null)} wide>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const patch = {
                name_en: fd.get("name_en"), name_si: fd.get("name_si"),
                category_en: fd.get("category_en"), category_si: fd.get("category_si"),
                tagline_en: fd.get("tagline_en"), tagline_si: fd.get("tagline_si"),
                desc_en: fd.get("desc_en"), desc_si: fd.get("desc_si"),
                active: fd.get("active") === "on", is_new: fd.get("is_new") === "on",
                order: Number(fd.get("order")),
                logo: String(fd.get("logo") ?? ""),
                cover: String(fd.get("cover") ?? "") || null,
              };
              const validContacts = mgrRows
                .map((c) => ({
                  role_en: c.role_en.trim(),
                  role_si: c.role_si.trim(),
                  name: c.name.trim(),
                  location: c.location.trim(),
                  phone: c.phone.trim(),
                }))
                .filter((c) => c.role_en || c.role_si || c.name || c.location || c.phone);
              const branchNameSeen = new Map<string, number>();
              const validBranches = branchRows
                .map((br, i) => {
                  const row = {
                    name: br.name.trim(),
                    manager: br.manager.trim(),
                    location: br.location.trim(),
                    phone: br.phone.trim(),
                  };
                  if (!row.name && !row.manager && !row.location && !row.phone) return null;
                  const baseName = row.name || (editFor.slug === "coop-city" ? `Coop City Branch ${i + 1}` : `Branch ${i + 1}`);
                  let name = baseName;
                  let suffix = (branchNameSeen.get(baseName.toLowerCase()) ?? 0) + 1;
                  while (branchNameSeen.has(name.toLowerCase())) {
                    name = `${baseName} – ${row.location || suffix}`;
                    if (branchNameSeen.has(name.toLowerCase())) name = `${name} (${suffix})`;
                    suffix++;
                  }
                  branchNameSeen.set(baseName.toLowerCase(), (branchNameSeen.get(baseName.toLowerCase()) ?? 0) + 1);
                  branchNameSeen.set(name.toLowerCase(), 1);
                  return { ...row, name };
                })
                .filter((br): br is BusinessBranch => Boolean(br))
                .slice(0, editFor.slug === "coop-city" ? COOP_CITY_BRANCH_LIMIT : undefined);
              setUnits((xs) => xs.map((b) => (b.slug === editFor.slug ? { ...b, ...patch, contacts: validContacts, branches: validBranches } as BusinessUnit : b)));
              let err = await dbUpdate("business_units", { slug: editFor.slug }, patch);
              err ||= await dbDelete("business_contacts", { business_slug: editFor.slug });
              for (const c of validContacts) {
                err ||= await dbInsert("business_contacts", { business_slug: editFor.slug, ...c });
              }
              err ||= await dbDelete("business_branches", { business_slug: editFor.slug });
              for (const br of validBranches) {
                err ||= await dbInsert("business_branches", { business_slug: editFor.slug, ...br });
              }
              setEditFor(null);
              show(err ? `⚠ ${err}` : "✅ Business division updated");
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Title (English) *</label>
                <input name="name_en" required defaultValue={editFor.name_en} className="field" />
              </div>
              <div>
                <label className="field-label">Title (Sinhala) *</label>
                <input name="name_si" required defaultValue={editFor.name_si} className="field" />
              </div>
              <div>
                <label className="field-label">Category Tag (English)</label>
                <input name="category_en" defaultValue={editFor.category_en} className="field" />
              </div>
              <div>
                <label className="field-label">Category Tag (Sinhala)</label>
                <input name="category_si" defaultValue={editFor.category_si} className="field" />
              </div>
              <div>
                <label className="field-label">Tagline / Subtitle (English)</label>
                <input name="tagline_en" defaultValue={editFor.tagline_en} className="field" />
              </div>
              <div>
                <label className="field-label">Tagline / Subtitle (Sinhala)</label>
                <input name="tagline_si" defaultValue={editFor.tagline_si} className="field" />
              </div>
            </div>
            <div>
              <label className="field-label">Full Description (English)</label>
              <textarea name="desc_en" rows={3} defaultValue={editFor.desc_en} className="field" />
            </div>
            <div>
              <label className="field-label">Full Description (Sinhala)</label>
              <textarea name="desc_si" rows={3} defaultValue={editFor.desc_si} className="field" />
            </div>

            {/* department managers & contact persons */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-slate-900 text-[14px]">Department Managers &amp; Contact Persons</div>
                  <div className="text-slate-400 text-[11px]">These appear under Department Contact &amp; Inquiries on the business page.</div>
                </div>
                <button type="button" className="btn btn-primary !py-1.5 !px-3.5 !text-[11.5px]" onClick={() => setMgrRows((rs) => [...rs, { role_en: "", role_si: "", name: "", location: "", phone: "" }])}>
                  <Plus size={13} /> Add Manager
                </button>
              </div>
              {mgrRows.length === 0 && (
                <div className="text-slate-400 text-[12px] mt-3">දැනට managers නෑ — "+ Add Manager" ඔබලා විස්තර එකතු කරන්න.</div>
              )}
              {mgrRows.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> CONTACT PERSON #{i + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-blue rounded-full px-2.5 py-0.5 text-[9.5px] font-bold">Contact</span>
                      <button type="button" title="Remove" className="text-rose-500 hover:text-rose-700" onClick={() => setMgrRows((rs) => rs.filter((_, j) => j !== i))}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4 mt-3">
                    <input className="field !py-2 !text-[11.5px]" placeholder="e.g. Store Manager" value={c.role_en} onChange={(e) => setMgrRows((rs) => rs.map((r, j) => (j === i ? { ...r, role_en: e.target.value } : r)))} />
                    <input className="field !py-2 !text-[11.5px]" placeholder="නම / Name" value={c.name} onChange={(e) => setMgrRows((rs) => rs.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                    <input className="field !py-2 !text-[11.5px]" placeholder="ලිපිනය / Location" value={c.location} onChange={(e) => setMgrRows((rs) => rs.map((r, j) => (j === i ? { ...r, location: e.target.value } : r)))} />
                    <input className="field !py-2 !text-[11.5px]" placeholder="037 229 1018" value={c.phone} onChange={(e) => setMgrRows((rs) => rs.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r)))} />
                  </div>
                </div>
              ))}
            </div>

            {/* branch settings — Coop City gets its own five-card branch setup */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-slate-900 text-[14px]">
                    {editFor.slug === "coop-city" ? "Our Coop City & Mini Coop City Branch Settings" : "Regional Branch Settings"}
                  </div>
                  <div className="text-slate-500 text-[11px] leading-relaxed">
                    {editFor.slug === "coop-city"
                      ? "Add up to 5 branches. They appear as ordered cards above Department Contact & Inquiries on the Coop City page."
                      : editFor.special === "consumer"
                        ? "Regional branches appear above the Sales Development Manager and Store Manager rows. To delete Mandapola or any other branch, click Delete on its row and then Save Changes."
                        : "Branches are saved separately and shown in the Regional Branches section where this business template uses it."}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={editFor.slug === "coop-city" && branchRows.length >= COOP_CITY_BRANCH_LIMIT}
                  className="btn btn-green !py-1.5 !px-3.5 !text-[11.5px] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setBranchRows((rs) => [...rs, emptyBranch()])}
                >
                  <Plus size={13} /> {editFor.slug === "coop-city" ? `Add Branch (${branchRows.length}/${COOP_CITY_BRANCH_LIMIT})` : "Add Regional Branch"}
                </button>
              </div>

              {branchRows.length === 0 && (
                <div className="text-slate-500 text-[12px] mt-3">දැනට ශාඛා නෑ — “Add Branch” ඔබලා විස්තර එකතු කරන්න.</div>
              )}
              {branchRows.map((br, i) => (
                <div key={i} className="rounded-xl border border-emerald-100 bg-white p-4 mt-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-black text-emerald-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      {editFor.slug === "coop-city" ? "COOP CITY BRANCH" : "REGIONAL BRANCH"} #{i + 1}
                    </div>
                    <button
                      type="button"
                      title="Delete this branch"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-100"
                      onClick={() => setBranchRows((rs) => rs.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3">
                    <div>
                      <label className="field-label !mb-1">{editFor.slug === "coop-city" ? "Coop City Type" : editFor.special === "consumer" ? "Regional Name" : "Branch Name"}</label>
                      <input
                        className="field !py-2 !text-[11.5px]"
                        placeholder={editFor.slug === "coop-city" ? "e.g. Mini Coop City – Hettipola" : "e.g. Mandapola"}
                        value={br.name}
                        onChange={(e) => setBranchRows((rs) => rs.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                      />
                    </div>
                    <div>
                      <label className="field-label !mb-1">Manager Name</label>
                      <input
                        className="field !py-2 !text-[11.5px]"
                        placeholder="කළමනාකරුගේ නම"
                        value={br.manager}
                        onChange={(e) => setBranchRows((rs) => rs.map((r, j) => (j === i ? { ...r, manager: e.target.value } : r)))}
                      />
                    </div>
                    <div>
                      <label className="field-label !mb-1">Location</label>
                      <input
                        className="field !py-2 !text-[11.5px]"
                        placeholder="ස්ථානය / ලිපිනය"
                        value={br.location}
                        onChange={(e) => setBranchRows((rs) => rs.map((r, j) => (j === i ? { ...r, location: e.target.value } : r)))}
                      />
                    </div>
                    <div>
                      <label className="field-label !mb-1">Hot Line</label>
                      <input
                        className="field !py-2 !text-[11.5px]"
                        placeholder="037 229 1017"
                        value={br.phone}
                        onChange={(e) => setBranchRows((rs) => rs.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r)))}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[10.5px] text-slate-400 mt-3">
                හිස් branch rows Save කිරීමේදී ඉවත් වේ. ශාඛාවක් මකන්න එහි <strong className="text-rose-500">Delete</strong> ඔබලා Save Changes කරන්න.
                {editFor.slug === "coop-city" ? " Type එක ශාඛාව අනුව වෙනස්ව ලියන්න (උදා: Coop City – Hettipola)." : ""}
              </p>
            </div>

            {/* logo + cover */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="font-extrabold text-slate-900 text-[14px] flex items-center gap-2">
                <ImageIcon size={16} /> Business Logo / Image
              </div>
              <div className="flex gap-2.5 mt-3">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="logo preview" className="w-11 h-11 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-black text-slate-500">
                    LOGO
                  </div>
                )}
                <input ref={logoRef} name="logo" className="field flex-1" defaultValue={editFor.logo} placeholder="/images/sections/... or https://..." onChange={(e) => setLogoPreview(e.target.value)} />
                <label className="btn btn-outline cursor-pointer">⬆ Upload from Device
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void doUpload("logo", f); }} />
                </label>
              </div>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mt-3">Or quick pick existing preset:</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.keys(PRESETS).map((p) => (
                  <button key={p} type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-[10.5px] font-semibold text-slate-600 hover:border-indigo-400" onClick={() => { if (logoRef.current) logoRef.current.value = PRESETS[p]; setLogoPreview(PRESETS[p]); }}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="font-extrabold text-slate-900 text-[14px] flex items-center gap-2 mt-5">
                <ImageIcon size={16} /> Business Page Hero Cover Photo
              </div>
              <div className="rounded-2xl bg-slate-800 text-white/40 text-[12px] text-center py-10 mt-3 overflow-hidden">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover preview" className="w-full h-40 object-cover rounded-xl" />
                ) : (
                  "No custom cover photo selected — Upload an image or pick a preset below."
                )}
              </div>
              <div className="flex gap-2.5 mt-3">
                <input ref={coverRef} name="cover" className="field flex-1" placeholder="/images/gallery/... or https://..." defaultValue={editFor.cover ?? ""} onChange={(e) => setCoverPreview(e.target.value)} />
                <label className="btn btn-outline cursor-pointer">⬆ Upload Cover Photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void doUpload("cover", f); }} />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="active" defaultChecked={editFor.active} className="accent-indigo-700 w-4 h-4" /> Active (Show on Website)
              </label>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="is_new" defaultChecked={editFor.is_new} className="accent-indigo-700 w-4 h-4" /> Display &quot;NEW&quot; Badge
              </label>
              <div>
                <label className="field-label !mb-1">Display Order</label>
                <input name="order" type="number" defaultValue={editFor.order} className="field !w-28 !py-2" />
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-[11.5px] text-slate-600 flex items-center justify-between">
              <span>
                Division Offered Services — This division currently has <strong>{editFor.services.length} service(s)</strong> configured.
              </span>
              <button
                type="button"
                className="btn btn-outline !py-1.5 !px-3 !text-[11px]"
                onClick={() => {
                  setSelected(editFor.slug);
                  setTab("services");
                  setEditFor(null);
                }}
              >
                Open Services Tab <ExternalLink size={11} />
              </button>
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button type="button" className="btn btn-outline" onClick={() => setEditFor(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </AdminModal>
      )}

      {addOpen && (
        <AdminModal title="Add New Business Division" sub="Update titles, taglines, category, descriptions, and logo" onClose={() => setAddOpen(false)} wide>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const slug = String(fd.get("name_en")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              const row: BusinessUnit = {
                slug,
                order: Number(fd.get("order")) || units.length + 1,
                name_en: String(fd.get("name_en")),
                name_si: String(fd.get("name_si")),
                category_en: String(fd.get("category_en")) || "Business Division",
                category_si: String(fd.get("category_si")) || "ව්‍යාපාර අංශය",
                tagline_en: String(fd.get("tagline_en")),
                tagline_si: String(fd.get("tagline_si")),
                desc_en: String(fd.get("desc_en")),
                desc_si: String(fd.get("desc_si")),
                logo: addLogo || "/images/sections/new.png",
                cover: null,
                is_new: fd.get("is_new") === "on",
                active: fd.get("active") === "on",
                special: "default",
                contacts: [],
                branches: [],
                services: [],
              };
              setUnits((xs) => [...xs, row]);
              // ⚠ DB එකේ business_units columns වලට විතරක් insert (contacts/branches/services වෙනම tables)
              const { contacts: _c, branches: _b, services: _s, ...unitRow } = row;
              const err = await dbInsert("business_units", unitRow as unknown as Record<string, unknown>);
              setAddOpen(false);
              show(err ? `⚠ ${err}` : "✅ Business created");
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Title (English) *</label>
                <input name="name_en" required className="field" placeholder="e.g. Rural Bank" />
              </div>
              <div>
                <label className="field-label">Title (Sinhala) *</label>
                <input name="name_si" required className="field" placeholder="e.g. ග්‍රාමීය බැංකුව" />
              </div>
              <div>
                <label className="field-label">Category Tag (English)</label>
                <input name="category_en" className="field" placeholder="e.g. Banking & Finance" />
              </div>
              <div>
                <label className="field-label">Category Tag (Sinhala)</label>
                <input name="category_si" className="field" placeholder="e.g. බැංකු කටයුතු හා මූල්‍ය" />
              </div>
              <div>
                <label className="field-label">Tagline / Subtitle (English)</label>
                <input name="tagline_en" className="field" placeholder="e.g. Trusted savings & fast loans" />
              </div>
              <div>
                <label className="field-label">Tagline / Subtitle (Sinhala)</label>
                <input name="tagline_si" className="field" placeholder="e.g. විශ්වාසනීය ඉතුරුම් හා වේගවත් ණය" />
              </div>
            </div>
            <div>
              <label className="field-label">Full Description (English)</label>
              <textarea name="desc_en" rows={3} className="field" placeholder="Paragraph description for cards and overview..." />
            </div>
            <div>
              <label className="field-label">Full Description (Sinhala)</label>
              <textarea name="desc_si" rows={3} className="field" placeholder="සාරාංශ විස්තරයක්..." />
            </div>
            <div>
              <label className="field-label">Business Logo (Main Logo)</label>
              <div className="flex items-center gap-3">
                {addLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={addLogo} alt="preview" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                )}
                <label className="btn btn-outline cursor-pointer">
                  <ImageIcon size={14} /> {addLogo ? "Change Logo" : "Upload Logo from Device"}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    show("⏳ Logo එක upload වෙමින්...");
                    const res = await uploadSiteImage(f, "businesses");
                    if (res && res.url) { setAddLogo(res.url); show("✅ Logo එක upload වුණා — Create කරන්න"); }
                    else show(`⚠ ${res && res.error ? res.error : "Upload failed"}`);
                  }} />
                </label>
              </div>
            </div>
            <div>
              <label className="field-label">Public Page URL</label>
              <input className="field !bg-slate-100" defaultValue="/businesses/new-division" readOnly />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="active" defaultChecked className="accent-indigo-700 w-4 h-4" /> Active (Show on Website)
              </label>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="is_new" className="accent-indigo-700 w-4 h-4" /> Display &quot;NEW&quot; Badge
              </label>
              <div>
                <label className="field-label !mb-1">Display Order</label>
                <input name="order" type="number" defaultValue={units.length + 1} className="field !w-28 !py-2" />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button type="button" className="btn btn-outline" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Business</button>
            </div>
          </form>
        </AdminModal>
      )}

      {svcOpen && current && (
        <AdminModal title="Add New Service" sub={`Add a service for ${current.name_en}`} onClose={() => setSvcOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const row: BusinessService = {
                order: current.services.length + 1,
                title_en: String(fd.get("title_en")),
                title_si: String(fd.get("title_si")),
                desc_en: String(fd.get("desc_en")) || `Premier service offered by ${current.name_en}.`,
                desc_si: String(fd.get("desc_si")) || `${current.name_si} විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.`,
                features_en: String(fd.get("features_en") || DEFAULT_FEATURES).split(",").map((x) => x.trim()).filter(Boolean),
                features_si: String(fd.get("features_si") || "විශ්වාසනීය ගුණාත්මකභාවය, සාමාජික වරප්‍රසාද, සහතික කළ ප්‍රමිතිය").split(",").map((x) => x.trim()).filter(Boolean),
                active: fd.get("active") === "on",
              };
              setUnits((xs) => xs.map((b) => (b.slug === current.slug ? { ...b, services: [...b.services, row] } : b)));
              const err = await dbInsert("business_services", { business_slug: current.slug, ...row } as unknown as Record<string, unknown>);
              setSvcOpen(false);
              show(err ? `⚠ ${err}` : "✅ Service added");
            }}
          >
            <div>
              <label className="field-label">Service Title (English) *</label>
              <input name="title_en" required className="field" placeholder="e.g. Fixed Deposit Scheme" />
            </div>
            <div>
              <label className="field-label">Service Title (Sinhala) *</label>
              <input name="title_si" required className="field" placeholder="e.g. ස්ථිර තැන්පතු යෝජනාව" />
            </div>
            <div>
              <label className="field-label">Features / Bullet Points (English, comma-separated)</label>
              <input name="features_en" className="field" placeholder="e.g. High interest, Minimum deposit Rs. 1000, Flexible tenures" />
            </div>
            <div>
              <label className="field-label">Features / Bullet Points (Sinhala, comma-separated)</label>
              <input name="features_si" className="field" placeholder="e.g. ඉහළ පොලිය, අවම තැන්පතු රු. 1000ක්, නම්‍යශීලී කාල සීමාවන්" />
            </div>
            <div>
              <label className="field-label">Description (Optional)</label>
              <textarea name="desc_en" rows={2} className="field" placeholder="Premier service offered by ..." />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="active" defaultChecked className="accent-indigo-700 w-4 h-4" /> Active
              </label>
              <div>
                <label className="field-label !mb-1">Display Order:</label>
                <input name="order" type="number" defaultValue={current.services.length + 1} className="field !w-24 !py-2" />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button type="button" className="btn btn-outline" onClick={() => setSvcOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Service</button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
