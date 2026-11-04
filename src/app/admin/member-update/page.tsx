"use client";

// ============================================================================
// Member Update — වෙබ් අඩවියේ පෙන්වන සාමාජික / චන්ද හිමි විස්තර edit කරන section එක
//  · සයිට් එකේ පෙන්වන විදිහටම වගුව (අංකය · NIC · නම · ලිපිනය · තැපැල් · ස්ත්‍රී/පුරුෂ)
//  · නම / NIC / ලිපිනය / සාමාජික අංකයෙන් search
//  · තෝරාගත් සාමාජිකයා edit → save → සයිට් එකේත් PDF එකේත් ඒ විදිහටම
//  · සාමාජිකයෙක් update වුණාම ඒ පුද්ගලයාගේ චන්ද හිමි පේළිය ඉබේම update වෙනවා
//  · ⛔ DELETE නෑ — edit පමණයි
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Pencil, RefreshCw, Save, Search, UserRound, Vote } from "lucide-react";
import { AdminModal, AdminTopbar, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import {
  cleanText, missingColumns, sanitizeNic, validateRegisterEdit, voterMatchesMember, voterSyncPatch,
  type RegisterFields,
} from "@/lib/member-update";

type Kind = "member" | "voter";
type Row = RegisterFields & { id: string; file_name?: string };
type Edit = { member_no: string; nic: string; full_name: string; address: string; postal_address: string; gender: string };

const TABLE: Record<Kind, string> = { member: "member_rows", voter: "voter_rows" };
const PER_PAGE = 25;

function natKey(s: string): (string | number)[] {
  return String(s || "").split(/(\d+)/).filter(Boolean).map((p) => (/^\d+$/.test(p) ? Number(p) : p.toLowerCase()));
}
function cmpNat(a: string, b: string): number {
  const ka = natKey(a), kb = natKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const x = ka[i], y = kb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") { if (x !== y) return x - y; }
    else { const sx = String(x), sy = String(y); if (sx !== sy) return sx < sy ? -1 : 1; }
  }
  return 0;
}

function rowNo(r: Row): string {
  return cleanText(r.member_no ?? r.voter_no);
}

/** චන්ද හිමි ලැයිස්තුවෙන් මේ පුද්ගලයා හොයනවා — NIC එකෙන් (පරණ + අලුත්) සහ නම+ලිපිනයෙන් */
async function findMatchingVoters(
  sb: Awaited<ReturnType<typeof authedClient>>,
  next: RegisterFields,
  prev: RegisterFields
): Promise<Row[]> {
  const nics = Array.from(new Set([sanitizeNic(next.nic), sanitizeNic(prev.nic)].filter(Boolean)));
  const found = new Map<string, Row>();
  for (const nic of nics) {
    const { data } = await sb.from("voter_rows").select("*").eq("nic", nic).limit(50);
    for (const r of ((data ?? []) as unknown as Row[])) found.set(r.id, r);
  }
  for (const src of [next, prev]) {
    const name = cleanText(src.full_name);
    if (!name) continue;
    const { data } = await sb.from("voter_rows").select("*").eq("full_name", name).limit(50);
    for (const r of ((data ?? []) as unknown as Row[])) {
      if (voterMatchesMember(r, next, prev)) found.set(r.id, r);
    }
  }
  return [...found.values()].filter((v) => voterMatchesMember(v, next, prev));
}

export default function MemberUpdatePage() {
  const { show, node } = useNotice();
  const [kind, setKind] = useState<Kind>("member");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editFor, setEditFor] = useState<Row | null>(null);
  const [form, setForm] = useState<Edit>({ member_no: "", nic: "", full_name: "", address: "", postal_address: "", gender: "" });
  const [saving, setSaving] = useState(false);
  const [syncInfo, setSyncInfo] = useState("");

  /** ඇත්ත rows — batches වශයෙන් (52,000+ පේළි වුණත් වැඩ කරයි) */
  const load = useCallback(async (k: Kind) => {
    setLoading(true);
    try {
      const sb = await authedClient();
      const acc: Row[] = [];
      const BATCH = 1000;
      for (let from = 0; from < 60000; from += BATCH) {
        const { data, error } = await sb.from(TABLE[k]).select("*").range(from, from + BATCH - 1);
        if (error) break;
        const got = (data ?? []) as unknown as Row[];
        acc.push(...got);
        if (got.length < BATCH) break;
      }
      acc.sort((a, b) => cmpNat(rowNo(a), rowNo(b)) || String(a.file_name || "").localeCompare(String(b.file_name || "")));
      setRows(acc);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(kind); setQ(""); setPage(1); }, [kind, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [rowNo(r), r.nic, r.full_name, r.address, r.postal_address, r.gender, r.file_name]
        .some((v) => String(v ?? "").toLowerCase().includes(needle))
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const view = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const incomplete = useMemo(() => rows.filter((r) => missingColumns(r).length > 0).length, [rows]);
  const isMember = kind === "member";

  function openEdit(r: Row) {
    setSyncInfo("");
    setEditFor(r);
    setForm({
      member_no: rowNo(r),
      nic: cleanText(r.nic),
      full_name: cleanText(r.full_name),
      address: cleanText(r.address),
      postal_address: cleanText(r.postal_address),
      gender: cleanText(r.gender),
    });
  }

  async function save() {
    if (!editFor) return;
    const candidate: RegisterFields = { ...form, member_no: form.member_no, voter_no: form.member_no };
    const errors = validateRegisterEdit(candidate);
    if (errors.length) {
      show(`⚠ ${errors[0]}`);
      return;
    }
    setSaving(true);
    setSyncInfo("");
    try {
      const sb = await authedClient();
      const table = TABLE[kind];
      const patch = isMember
        ? {
            member_no: cleanText(form.member_no), nic: sanitizeNic(form.nic), full_name: cleanText(form.full_name),
            address: cleanText(form.address), postal_address: cleanText(form.postal_address), gender: cleanText(form.gender),
          }
        : {
            voter_no: cleanText(form.member_no), nic: sanitizeNic(form.nic), full_name: cleanText(form.full_name),
            address: cleanText(form.address), postal_address: cleanText(form.postal_address), gender: cleanText(form.gender),
          };
      const { data, error } = await sb.from(table).update(patch).eq("id", editFor.id).select("id");
      if (error) throw new Error(error.message);
      if (!data || !data.length) throw new Error("update වුණේ නෑ — login/permission පරීක්ෂා කරන්න");

      // ✅ සාමාජිකයෙක් නම් → ඒ පුද්ගලයාගේ චන්ද හිමි පේළියත් ඉබේම update
      let synced = 0;
      const prev: RegisterFields = {
        member_no: rowNo(editFor), nic: editFor.nic, full_name: editFor.full_name,
        address: editFor.address, postal_address: editFor.postal_address, gender: editFor.gender,
      };
      if (isMember) {
        const matches = await findMatchingVoters(sb, candidate, prev);
        for (const v of matches) {
          const { error: vErr } = await sb.from("voter_rows").update(voterSyncPatch(candidate)).eq("id", v.id);
          if (!vErr) synced++;
        }
        setSyncInfo(
          matches.length
            ? `✅ චන්ද හිමි ලැයිස්තුවේද ${synced} පේළියක් ඉබේම update වුණා`
            : "ℹ️ චන්ද හිමි ලැයිස්තුවේ මේ පුද්ගලයා හමු වුණේ නෑ (NIC/නම ගැළපෙන්නේ නෑ)"
        );
      }

      const label = isMember ? "සාමාජික" : "චන්ද හිමි";
      void logActivity("MEMBER_UPDATE", `${label} ${cleanText(form.member_no)} updated${synced ? ` · voter rows synced: ${synced}` : ""}`);
      show(`✅ ${label} ${cleanText(form.member_no)} update වුණා${synced ? ` — චන්ද හිමි ${synced}ක් ත් sync` : ""}`);

      // local list එකත් එහෙමම යාවත්කාලීන
      setRows((prev) => prev.map((r) => (r.id === editFor.id ? ({ ...r, ...patch } as Row) : r)));
      setEditFor(null);
    } catch (e) {
      show(`⚠ ${(e as Error).message}`);
    }
    setSaving(false);
  }

  return (
    <div className="p-4 sm:p-6">
      {node}
      <AdminTopbar title="Member Update" sub="Search a member or voter and edit their details — changes appear on the website and in the generated PDFs (edit only, no delete)" />

      <div className="card p-5 mb-5 border-l-4 border-indigo-600 text-[12.5px] text-slate-600 leading-relaxed">
        නම · NIC · ලිපිනය · සාමාජික අංකයෙන් සොයාගෙන විස්තර නිවැරදි කරන්න. <b className="text-slate-900">සාමාජිකයෙක් update වුණාම ඒ පුද්ගලයාගේ චන්ද හිමි තොරතුරුත් ඉබේම update වෙනවා.</b> මෙතනින් කිසිම අයෙක්ව delete කරන්න බෑ.
      </div>

      {/* tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([["member", "සියලුම සාමාජිකයින්", UserRound], ["voter", "චන්ද හිමියන්", Vote]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setKind(k as Kind)}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
              kind === k ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="badge-blue rounded-full px-2.5 py-1 text-[11px] font-bold">{rows.length.toLocaleString()} rows</span>
          {incomplete > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-[11px] font-bold border border-amber-200">
              තීරු 6 අසම්පූර්ණ: {incomplete.toLocaleString()}
            </span>
          )}
          <button onClick={() => void load(kind)} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* search */}
      <div className="card p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field !pl-10"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="නම, NIC, ලිපිනය, සාමාජික අංකය හෝ file නමින් සොයන්න…"
          />
        </div>
        {q.trim() && (
          <div className="mt-2 text-[11.5px] text-slate-500">{filtered.length.toLocaleString()} result(s) — “{q.trim()}”</div>
        )}
      </div>

      {/* table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-900 text-white">
              <tr>
                {["#", isMember ? "සාමාජික අංකය" : "ඡන්ද අංකය", "NIC", "සම්පූර්ණ නම", "ලිපිනය", "තැපැල් ලිපිනය", "ස්ත්‍රී/පුරුෂ", "තත්ත්වය", ""].map((h, i) => (
                  <th key={i} className="text-left font-bold px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>
              )}
              {!loading && view.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">දත්ත නෑ — Excel එකක් upload කරලා තියෙනවද පරීක්ෂා කරන්න</td></tr>
              )}
              {view.map((r, i) => {
                const miss = missingColumns(r);
                return (
                  <tr key={r.id} className={i % 2 ? "bg-slate-50/60" : "bg-white"}>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{(page - 1) * PER_PAGE + i + 1}</td>
                    <td className="px-3 py-2 font-bold text-indigo-900 whitespace-nowrap">{rowNo(r) || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{cleanText(r.nic) || <span className="text-rose-600 font-bold">හිස්</span>}</td>
                    <td className="px-3 py-2 font-semibold">{cleanText(r.full_name) || <span className="text-rose-600 font-bold">හිස්</span>}</td>
                    <td className="px-3 py-2">{cleanText(r.address) || <span className="text-rose-600 font-bold">හිස්</span>}</td>
                    <td className="px-3 py-2">{cleanText(r.postal_address) || <span className="text-rose-600 font-bold">හිස්</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{cleanText(r.gender) || <span className="text-rose-600 font-bold">හිස්</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {miss.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10.5px] font-bold"><CheckCircle2 size={11} /> සම්පූර්ණයි</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10.5px] font-bold" title={`හිස්: ${miss.join(", ")}`}>
                          <AlertCircle size={11} /> {miss.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 text-indigo-700 px-2.5 py-1.5 text-[11.5px] font-bold hover:bg-indigo-100">
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-[12px] text-slate-600">
          <span>{filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length.toLocaleString()}</span>
          <div className="flex items-center gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage(1)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40">«</button>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40">‹</button>
            <span className="px-2 font-bold text-slate-800">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40">›</button>
            <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40">»</button>
          </div>
        </div>
      </div>

      {/* edit modal */}
      {editFor && (
        <AdminModal title={`${isMember ? "සාමාජික" : "චන්ද හිමි"} විස්තර edit — ${cleanText(form.member_no)}`} sub="වෙබ් අඩවියේත් PDF එකේත් මේ වෙනස්කම් එහෙමම පේනවා" onClose={() => setEditFor(null)} wide>
          <div className="px-7 pb-7 pt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11.5px] font-bold text-slate-600">{isMember ? "සාමාජික අංකය" : "ඡන්ද අංකය"}</span>
              <input className="field mt-1" value={form.member_no} onChange={(e) => setForm({ ...form, member_no: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-bold text-slate-600">ජා.හැ.අංකය (NIC)</span>
              <input className="field mt-1" value={form.nic} onChange={(e) => setForm({ ...form, nic: e.target.value })} placeholder="123456789V හෝ 123456789012" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11.5px] font-bold text-slate-600">සම්පූර්ණ නම</span>
              <input className="field mt-1" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-bold text-slate-600">ලිපිනය</span>
              <input className="field mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-bold text-slate-600">තැපැල් ලිපිනය</span>
              <input className="field mt-1" value={form.postal_address} onChange={(e) => setForm({ ...form, postal_address: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-bold text-slate-600">ස්ත්‍රී/පුරුෂ</span>
              <select className="field mt-1" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="පුරුෂ">පුරුෂ</option>
                <option value="පිරිමි">පිරිමි</option>
                <option value="කාන්තා">කාන්තා</option>
              </select>
            </label>
            <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-[11.5px] text-slate-600">
              {missingColumns({ ...form, member_no: form.member_no }).length === 0
                ? "✅ තීරු 6ම පිරිලා — මේ පේළිය සයිට් එකේත් PDF එකේත් පෙන්වයි"
                : `⚠ හිස්: ${missingColumns({ ...form, member_no: form.member_no }).join(", ")} — පිරෙව්වම තමයි සයිට් එකේ පේන්නේ`}
              {syncInfo && <div className="mt-1.5 font-semibold text-emerald-700">{syncInfo}</div>}
            </div>
            <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setEditFor(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 text-white px-5 py-2.5 text-[12.5px] font-bold hover:bg-indigo-600 disabled:opacity-60">
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
