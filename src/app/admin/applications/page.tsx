"use client";

// Membership Applications Management — approve / reject / edit

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Lock, Pencil, RefreshCw, Search, XCircle } from "lucide-react";
import { AdminTopbar, AdminStatCard, dbUpdate, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";

type App = {
  id: string;
  app_no: string;
  name: string;
  name_si: string;
  name_en: string;
  nic: string;
  phone: string;
  email: string;
  address: string;
  postal: string;
  status: "pending" | "approved" | "rejected";
  date: string;
  photo: string;
};

type EditForm = { name_si: string; name_en: string; nic: string; phone: string; email: string; address: string; postal: string };

const STATUS_TABS = ["all", "pending", "approved", "rejected"] as const;

export default function AdminApplicationsPage() {
  const { show, node } = useNotice();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("all");
  const [apps, setApps] = useState<App[]>([]);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [editApp, setEditApp] = useState<App | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name_si: "", name_en: "", nic: "", phone: "", email: "", address: "", postal: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const sb = await authedClient();
    const { data } = await sb.from("membership_applications").select("*").order("created_at", { ascending: false });
    if (data)
      setApps(
        data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          app_no: String(r.app_no ?? ""),
          name: String(r.name_en || r.name_si || "—"),
          name_si: String(r.name_si ?? ""),
          name_en: String(r.name_en ?? ""),
          nic: String(r.nic ?? ""),
          phone: String(r.phone ?? ""),
          email: String(r.email ?? ""),
          address: String(r.address ?? ""),
          postal: String(r.postal_address ?? ""),
          status: (String(r.status ?? "pending") as App["status"]),
          date: new Date(String(r.created_at ?? Date.now())).toLocaleDateString(),
          photo: String(r.certified_form_url ?? ""),
        }))
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = {
    all: apps.length,
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return apps.filter(
      (a) =>
        (tab === "all" || a.status === tab) &&
        (!s || a.name.toLowerCase().includes(s) || a.nic.toLowerCase().includes(s) || a.phone.includes(s) || a.app_no.toLowerCase().includes(s))
    );
  }, [q, tab, apps]);

  async function decide(id: string, status: "approved" | "rejected") {
    // ✅ approved කරපු එකක් reject කරන්න බෑ (hard block)
    const current = apps.find((x) => x.id === id);
    if (current?.status === "approved" && status === "rejected") {
      show("⚠ Approved applications cannot be rejected");
      return;
    }
    setApps((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    const err = await dbUpdate("membership_applications", { id }, { status });
    if (!err) {
      await logActivity(
        status === "approved" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
        `application ${current?.app_no ?? id} ${status}`
      );
    }
    show(err ? `⚠ ${err}` : `✅ Application ${status}`);
  }

  function openEdit(a: App) {
    setEditApp(a);
    setEditForm({ name_si: a.name_si, name_en: a.name_en, nic: a.nic, phone: a.phone, email: a.email, address: a.address, postal: a.postal });
  }

  async function saveEdit() {
    if (!editApp) return;
    setSaving(true);
    const payload = {
      name_si: editForm.name_si,
      name_en: editForm.name_en,
      nic: editForm.nic,
      phone: editForm.phone,
      email: editForm.email || null,
      address: editForm.address,
      postal_address: editForm.postal,
    };
    const err = await dbUpdate("membership_applications", { id: editApp.id }, payload);
    if (!err) {
      await logActivity("APPLICATION_UPDATED", `application ${editApp.app_no} details updated`);
      await load();
    }
    setSaving(false);
    setEditApp(null);
    show(err ? `⚠ ${err}` : "✅ Application details saved");
  }

  return (
    <div>
      <AdminTopbar title="Membership Applications Management" sub="Review, approve, edit, and manage member registration submissions and certified forms" />
      {node}

      {viewPhoto && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <div className="bg-white rounded-3xl p-5 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-extrabold text-slate-900 text-[15px]">අයදුම්පතේ සහතික කළ ඡායාරූපය</div>
              <button className="btn btn-outline !py-1 !px-3 !text-[11px]" onClick={() => setViewPhoto(null)}>✕ Close</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewPhoto} alt="certified application" className="w-full rounded-2xl border border-slate-200" />
            <a href={viewPhoto} target="_blank" rel="noreferrer" className="btn btn-primary w-full mt-3 !py-2 !text-[12px]">Full Size එකේ බලන්න →</a>
          </div>
        </div>
      )}

      {editApp && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditApp(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-extrabold text-slate-900 text-[16px]">Application Details Edit කරන්න</div>
                <div className="text-slate-400 text-[11.5px] mt-0.5">{editApp.app_no} — saved changes admin activities වල සටහන් වේ</div>
              </div>
              <button className="btn btn-outline !py-1 !px-3 !text-[11px]" onClick={() => setEditApp(null)}>✕ Close</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-[11px] font-bold text-slate-500 mb-1">Name (English)</div>
                <input className="field" value={editForm.name_en} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} />
              </label>
              <label className="block">
                <div className="text-[11px] font-bold text-slate-500 mb-1">Name (Sinhala)</div>
                <input className="field" value={editForm.name_si} onChange={(e) => setEditForm({ ...editForm, name_si: e.target.value })} />
              </label>
              <label className="block">
                <div className="text-[11px] font-bold text-slate-500 mb-1">NIC</div>
                <input className="field" value={editForm.nic} onChange={(e) => setEditForm({ ...editForm, nic: e.target.value })} />
              </label>
              <label className="block">
                <div className="text-[11px] font-bold text-slate-500 mb-1">Phone</div>
                <input className="field" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <div className="text-[11px] font-bold text-slate-500 mb-1">Email</div>
                <input className="field" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <div className="text-[11px] font-bold text-slate-500 mb-1">Address</div>
                <input className="field" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <div className="text-[11px] font-bold text-slate-500 mb-1">Postal Address</div>
                <input className="field" value={editForm.postal} onChange={(e) => setEditForm({ ...editForm, postal: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline !py-2 !px-4 !text-[12px]" onClick={() => setEditApp(null)}>Cancel</button>
              <button className="btn btn-primary !py-2 !px-5 !text-[12px]" disabled={saving} onClick={saveEdit}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard tag="Total Applications" value={String(counts.all)} label="All incoming applications" icon={<FileText size={18} />} />
        <AdminStatCard tag="Pending Review" value={String(counts.pending)} label="Awaiting admin decision" icon={<RefreshCw size={18} />} tone="amber" />
        <AdminStatCard tag="Approved" value={String(counts.approved)} label="Officially sanctioned" icon={<CheckCircle2 size={18} />} tone="green" />
        <AdminStatCard tag="Rejected" value={String(counts.rejected)} label="Declined / incomplete" icon={<XCircle size={18} />} tone="red" />
      </div>

      <div className="card p-5 mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="field !pl-10" placeholder="Search by Name, NIC, Phone, or #APP ID..." />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                onClick={() => setTab(s)}
                className={`rounded-full px-4 py-2 text-[12px] font-bold border ${
                  tab === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {s[0].toUpperCase() + s.slice(1)} ({counts[s]})
              </button>
            ))}
            <button className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center" onClick={async () => { await load(); show("Refreshed"); }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-5">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={40} className="mx-auto text-slate-300" />
            <div className="text-slate-600 font-bold text-[15px] mt-3">No applications found</div>
            <div className="text-slate-400 text-[12px]">No member applications submitted yet.</div>
          </div>
        ) : (
          <div className="scroll-x">
            <table className="table-x">
              <thead>
                <tr>
                  <th>#APP ID</th><th>FULL NAME</th><th>NIC</th><th>PHONE</th><th>ADDRESS</th><th>PHOTO</th><th>STATUS</th><th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="font-bold text-indigo-700">{a.app_no}</td>
                    <td className="font-semibold">{a.name}</td>
                    <td className="tabular-nums">{a.nic}</td>
                    <td className="tabular-nums">{a.phone}</td>
                    <td className="text-slate-500">{a.address}</td>
                    <td>
                      {a.photo ? (
                        <button className="flex items-center gap-1.5" onClick={() => setViewPhoto(a.photo)} title="අයදුම්පතේ ඡායාරූපය බලන්න">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.photo} alt="application" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                          <span className="text-[10.5px] font-bold text-indigo-700 underline">View</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                          a.status === "approved" ? "badge-green" : a.status === "rejected" ? "badge-red" : "badge-amber"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button
                          className={`btn !py-1 !px-2.5 !text-[11px] ${a.status === "approved" ? "btn-green opacity-70 cursor-default" : "btn-green"}`}
                          disabled={a.status === "approved"}
                          onClick={() => decide(a.id, "approved")}
                        >
                          {a.status === "approved" ? "✓ Approved" : "Approve"}
                        </button>
                        {a.status === "approved" ? (
                          <span
                            className="btn btn-outline !py-1 !px-2.5 !text-[11px] !text-slate-400 opacity-60 cursor-not-allowed inline-flex items-center gap-1"
                            title="Approved applications cannot be rejected"
                          >
                            <Lock size={11} /> Reject
                          </span>
                        ) : (
                          <button
                            className={`btn !py-1 !px-2.5 !text-[11px] ${a.status === "rejected" ? "bg-red-600 text-white border-red-600 opacity-70 cursor-default" : "btn-outline !text-red-600"}`}
                            disabled={a.status === "rejected"}
                            onClick={() => decide(a.id, "rejected")}
                          >
                            {a.status === "rejected" ? "✓ Rejected" : "Reject"}
                          </button>
                        )}
                        <button className="btn btn-outline !py-1 !px-2.5 !text-[11px]" onClick={() => openEdit(a)} title="Edit application details">
                          <Pencil size={11} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
