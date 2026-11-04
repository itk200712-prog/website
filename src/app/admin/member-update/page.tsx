"use client";

// ============================================================================
// Member Update — වෙබ් අඩවියේ පෙන්වන සාමාජික / චන්ද හිමි විස්තර edit කරන section එක
//  · සයිට් එකේ පෙන්වන විදිහටම වගුව (අංකය · NIC · නම · ලිපිනය · තැපැල් · ස්ත්‍රී/පුරුෂ)
//  · නම / NIC / ලිපිනය / සාමාජික අංකයෙන් search — 52,000+ පේළි වුණත් server-side search
//    + pagination නිසා පිටුව ඉක්මනට load වෙනවා (සියලු rows browser එකට ගන්නේ නෑ)
//  · තෝරාගත් සාමාජිකයා edit → save → සයිට් එකේත් PDF එකේත් ඒ විදිහටම
//  · සාමාජිකයෙක් update වුණාම ඒ පුද්ගලයාගේ චන්ද හිමි පේළිය ඉබේම update වෙනවා
//  · ⛔ DELETE නෑ — edit පමණයි
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Pencil, RefreshCw, Save, Search, ShieldAlert, UserRound, Vote } from "lucide-react";
import { AdminModal, AdminTopbar, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import { createAnonClient } from "@/lib/supabase/anon";
import { logActivity } from "@/lib/activity";
import {
  cleanText, isRealNic, missingColumns, sanitizeNic, validateRegisterEdit, voterMatchesMember, voterSyncPatch,
  type RegisterFields,
} from "@/lib/member-update";

type Kind = "member" | "voter";
type Row = RegisterFields & { id: string; file_name?: string };
type Edit = { member_no: string; nic: string; full_name: string; address: string; postal_address: string; gender: string };

const TABLE: Record<Kind, string> = { member: "member_rows", voter: "voter_rows" };
const NO_COL: Record<Kind, string> = { member: "member_no", voter: "voter_no" };
const PER_PAGE = 25;
// ⚠️ member_rows එකේ voter_no නෑ, voter_rows එකේ member_no නෑ — වගුවට අදාළ columns විතරයි
const FIELDS: Record<Kind, string> = {
  member: "id,member_no,nic,full_name,address,postal_address,gender,file_name",
  voter: "id,voter_no,nic,full_name,address,postal_address,gender,file_name",
};

function rowNo(r: Row): string {
  return cleanText(r.member_no ?? r.voter_no);
}

/** ස්වාභාවික අනුපිළිවෙල — 41/2 < 41/10 */
function natKey(v: string): (string | number)[] {
  return String(v || "").split(/(\d+)/).filter(Boolean).map((x) => (/^\d+$/.test(x) ? Number(x) : x.toLowerCase()));
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

/** search text එක PostgREST or() syntax එකට ආරක්ෂිත කරනවා (`,` `(` `)` `*` `\` ඉවත්) */
function safeSearch(v: string): string {
  return v.replace(/[(),%*\\"']/g, " ").replace(/\s+/g, " ").trim();
}

/** චන්ද හිමි ලැයිස්තුවෙන් මේ පුද්ගලයා හොයනවා — NIC එකෙන් (පරණ + අලුත්) සහ නම+ලිපිනයෙන් */
async function findMatchingVoters(
  sb: Awaited<ReturnType<typeof authedClient>>,
  next: RegisterFields,
  prev: RegisterFields
): Promise<Row[]> {
  const collect = async (build: () => PromiseLike<{ data: unknown }>) => {
    const { data } = await build();
    return ((data ?? []) as unknown as Row[]).filter((v) => voterMatchesMember(v, next, prev));
  };
  const pick = (rows: Row[]) => (rows.length ? rows : null);

  // 1️⃣ සාමාජික අංකය = ඡන්ද අංකය (වඩාත්ම නිවැරදි — ලේඛන දෙකේ එකම අංකය)
  for (const no of Array.from(new Set([cleanText(next.member_no), cleanText(prev.member_no)].filter(Boolean)))) {
    const hit = pick(await collect(() => sb.from("voter_rows").select(FIELDS.voter).eq("voter_no", no).limit(50)));
    if (hit) return hit;
  }
  // 2️⃣ ඇත්ත NIC එකක් නම් (0000000000 placeholder නොවේ) — ඒකෙන්
  for (const nic of Array.from(new Set([sanitizeNic(next.nic), sanitizeNic(prev.nic)])).filter(isRealNic)) {
    const hit = pick(await collect(() => sb.from("voter_rows").select(FIELDS.voter).eq("nic", nic).limit(50)));
    if (hit) return hit;
  }
  // 3️⃣ අන්තිමට — නම + ලිපිනය එකම නම්
  for (const src of [next, prev]) {
    const name = cleanText(src.full_name);
    if (!name) continue;
    const hit = pick(await collect(() => sb.from("voter_rows").select(FIELDS.voter).eq("full_name", name).limit(50)));
    if (hit) return hit;
  }
  return [];
}

export default function MemberUpdatePage() {
  const { show, node } = useNotice();
  const [kind, setKind] = useState<Kind>("member");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [editFor, setEditFor] = useState<Row | null>(null);
  const [form, setForm] = useState<Edit>({ member_no: "", nic: "", full_name: "", address: "", postal_address: "", gender: "" });
  const [saving, setSaving] = useState(false);
  const [syncInfo, setSyncInfo] = useState("");
  const reqId = useRef(0);

  // search box එකේ ටයිප් කරන ගමන් හැම අකුරකටම query එකක් නොයවන්න (300ms debounce)
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  /** එක පිටුවක් පමණයි ගන්නේ — server-side search + range */
  const fetchPage = useCallback(async (k: Kind, search: string, pageNo: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setLoadError("");
    const from = (pageNo - 1) * PER_PAGE;
    const table = TABLE[k];
    const needle = safeSearch(search);
    const build = (sb: { from: (t: string) => any }, orderCol: string) => {
      let query = sb.from(table).select(FIELDS[k], { count: "exact" });
      if (needle) {
        const like = `*${needle}*`;
        const cols = [NO_COL[k], "nic", "full_name", "address", "postal_address", "file_name"];
        query = query.or(cols.map((c) => `${c}.ilike.${like}`).join(","));
      }
      // ⚡ සෙවුමක් නැති විට id (primary key) අනුව — 52,000+ පේළි වලට ඉක්මන්.
      //    සෙවුමක් තිබේ නම් සාමාජික අංකය අනුව පිළිවෙල කරනවා (result ටික නිසා ඉක්මන්).
      return query.order(orderCol, { ascending: true }).range(from, from + PER_PAGE - 1);
    };
    try {
      const sb = await authedClient();
      let res = await build(sb as unknown as { from: (t: string) => any }, needle ? NO_COL[k] : "id");
      // 🔁 authenticated role එකට SELECT අවසර නැත්නම් public (anon) client එකෙන් කියවනවා
      if (res.error && /permission|policy|denied|jwt/i.test(res.error.message)) {
        res = await build(createAnonClient() as unknown as { from: (t: string) => any }, needle ? NO_COL[k] : "id");
      }
      // 🔁 වේගය අඩු index එකක් නිසා statement timeout වුණොත් id අනුව නැවත උත්සාහ
      if (res.error && /57014|timeout/i.test(res.error.message)) {
        res = await build(sb as unknown as { from: (t: string) => any }, "id");
      }
      if (id !== reqId.current) return;
      if (res.error) {
        setRows([]);
        setTotal(0);
        setLoadError(res.error.message);
      } else {
        const list = ((res.data ?? []) as unknown as Row[]);
        if (!needle) list.sort((a, b) => cmpNat(rowNo(a), rowNo(b)));
        setRows(list);
        setTotal(Number(res.count ?? 0));
      }
    } catch (e) {
      if (id === reqId.current) {
        setRows([]);
        setTotal(0);
        setLoadError((e as Error).message);
      }
    }
    if (id === reqId.current) setLoading(false);
  }, []);

  useEffect(() => { void fetchPage(kind, debounced, page); }, [kind, debounced, page, fetchPage]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
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
      setEditFor(null);
      await fetchPage(kind, debounced, page);
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
            onClick={() => { setKind(k as Kind); setPage(1); }}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
              kind === k ? "bg-indigo-700 text-white shadow-md shadow-indigo-700/20" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="badge-blue rounded-full px-2.5 py-1 text-[11px] font-bold">{total.toLocaleString()} rows</span>
          <button onClick={() => void fetchPage(kind, debounced, page)} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
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
            onChange={(e) => setQ(e.target.value)}
            placeholder="නම, NIC, ලිපිනය, සාමාජික අංකය හෝ file නමින් සොයන්න…"
          />
        </div>
        {debounced.trim() && !loading && (
          <div className="mt-2 text-[11.5px] text-slate-500">{total.toLocaleString()} result(s) — “{debounced.trim()}”</div>
        )}
      </div>

      {loadError && (
        <div className="card p-4 mb-4 border-l-4 border-rose-500 text-[12px] text-rose-700 flex items-start gap-2">
          <ShieldAlert size={15} className="mt-0.5" />
          <div>
            <b>දත්ත ගන්න බැරි වුණා:</b> {loadError}
            <div className="text-slate-500 mt-1">Supabase login/permission හෝ internet connection පරීක්ෂා කරන්න.</div>
          </div>
        </div>
      )}

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
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  {debounced.trim() ? "මේ සෙවුමට පේළි නෑ" : "දත්ත නෑ — Data & Live Metrics වලින් Excel එකක් upload කරලා තියෙනවද පරීක්ෂා කරන්න"}
                </td></tr>
              )}
              {!loading && rows.map((r, i) => {
                const miss = missingColumns(r);
                return (
                  <tr key={r.id} className={i % 2 ? "bg-slate-50/60" : "bg-white"}>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{(page - 1) * PER_PAGE + i + 1}</td>
                    <td className="px-3 py-2 font-bold text-indigo-900 whitespace-nowrap">{rowNo(r) || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {cleanText(r.nic) ? (
                        isRealNic(r.nic) ? cleanText(r.nic) : (
                          <span className="text-amber-700" title="placeholder — ඇත්ත NIC එක දාන්න">
                            {cleanText(r.nic)} <span className="text-[9.5px] font-bold uppercase">placeholder</span>
                          </span>
                        )
                      ) : (
                        <span className="text-rose-600 font-bold">හිස්</span>
                      )}
                    </td>
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
          <span>{total === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} / {total.toLocaleString()}</span>
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
              {form.nic.trim() && !isRealNic(form.nic) && (
                <div className="mt-1.5 font-semibold text-amber-700">⚠ මේ NIC එක placeholder එකක් — ඇත්ත ජා.හැ.අංකය දාන්න</div>
              )}
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
