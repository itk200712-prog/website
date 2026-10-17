"use client";

// ============================================================================
// Member / Voter directory table — search, file filter, pagination, PDF print
//  Rows: client-side generated registry (52,964 members / 2,359 voters)
//  Members: # | MEMBER NO | FULL NAME | NIC | ADDRESS | GENDER
//  Voters: VOTER NO | FULL NAME | NIC | ADDRESS | GENDER
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Download, FileSpreadsheet, Layers, Printer, Search, Users } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { createAnonClient } from "@/lib/supabase/anon";
import type { DataFile, MemberRow, VoterRow } from "@/lib/types";

/* ✅ member number ස්වාභාවික අනුපිළිවෙල (1/01, 1/02 … 33/02 … 41/01) */
function natKey(s: string): (string | number)[] {
  return String(s || "")
    .split(/(\d+)/)
    .filter(Boolean)
    .map((p) => (/^\d+$/.test(p) ? Number(p) : p.toLowerCase()));
}
function cmpNat(a: string, b: string): number {
  const ka = natKey(a);
  const kb = natKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const x = ka[i];
    const y = kb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else {
      const sx = String(x);
      const sy = String(y);
      if (sx !== sy) return sx < sy ? -1 : 1;
    }
  }
  return 0;
}

async function fetchAllRows(table: "member_rows" | "voter_rows"): Promise<AnyRow[]> {
  const sb = createAnonClient();
  const out: AnyRow[] = [];
  const BATCH = 1000;
  for (let from = 0; from < 60000; from += BATCH) {
    const { data, error } = await sb.from(table).select("*").range(from, from + BATCH - 1);
    if (error) break;
    const got = (data ?? []) as unknown as AnyRow[];
    out.push(...got);
    if (got.length < BATCH) break;
  }
  return out;
}

type AnyRow = (MemberRow | VoterRow) & { member_no?: string; voter_no?: string };

export function DirectoryTable({
  kind,
  totalRows,
  totalFiles,
}: {
  kind: "member" | "voter";
  rows?: AnyRow[];
  files?: DataFile[];
  totalRows: number;
  totalFiles: number;
  title?: string;
  sub?: string;
}) {
  const { t, lang } = useLang();
  const [q, setQ] = useState("");
  const [file, setFile] = useState("all");
  const [fileOpen, setFileOpen] = useState(false);
  const [fileQ, setFileQ] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AnyRow | null>(null);
  const perPage = 25;

  const [allRows, setAllRows] = useState<AnyRow[]>([]);
  const [files, setFiles] = useState<DataFile[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ REAL uploaded data පමණයි — demo rows නෑ. member_no අනුව ස්වාභාවික අනුපිළිවෙල (1/01 සිට).
  useEffect(() => {
    let alive = true;
    (async () => {
      const table = kind === "member" ? "member_rows" : "voter_rows";
      const rows = await fetchAllRows(table);
      rows.sort((a, b) =>
        cmpNat((a.member_no ?? a.voter_no ?? "") as string, (b.member_no ?? b.voter_no ?? "") as string) ||
        String(a.file_name || "").localeCompare(String(b.file_name || ""))
      );
      const sb = createAnonClient();
      const { data: fl } = await sb.from("data_files").select("file_name, rows").eq("kind", kind);
      if (!alive) return;
      setAllRows(rows);
      setFiles(((fl as unknown as DataFile[]) ?? []).map((f) => ({ ...f, rows: Number(f.rows) })));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [kind]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allRows.filter((r) => {
      if (file !== "all" && r.file_name !== file) return false;
      if (!s) return true;
      return (
        r.full_name.toLowerCase().includes(s) ||
        r.nic.toLowerCase().includes(s) ||
        r.address.includes(q.trim()) ||
        (r.member_no ?? r.voter_no ?? "").toLowerCase().includes(s) ||
        r.file_name.toLowerCase().includes(s)
      );
    });
  }, [q, file, allRows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const view = filtered.slice((page - 1) * perPage, page * perPage);
  const isMember = kind === "member";

  const title = isMember
    ? (lang === "si" ? "සාමාජික විස්තර (සියලු සාමාජිකයින්)" : "Member Details (All Members)")
    : (lang === "si" ? t.memberPage.votersTitle : "Eligible Voters");
  const sub = isMember
    ? (lang === "si" ? t.memberPage.sub : "Official registered member directory of Panduwasnuwara MPCS")
    : (lang === "si" ? t.memberPage.votersSub : "Cooperative electoral register of eligible voters");
  const searchPlaceholder = isMember
    ? (lang === "si" ? t.memberPage.search : "Search by Name, NIC, Member No, or File...")
    : (lang === "si" ? t.memberPage.search : "Search by Name, NIC, Voter No, or File...");
  const genderLabel = (g: string) =>
    isMember ? (g === "පිරිමි" ? "පිරිමින්" : g === "කාන්තා" ? "කාන්තාවන්" : g) : g;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* header card */}
      <div className="card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              {isMember ? <Users size={26} /> : <Building2 size={26} />}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex flex-wrap items-center gap-3">
                {title}
                <span className="badge-blue rounded-full px-3 py-1 text-[12px] font-bold tabular-nums">
                  {allRows.length.toLocaleString()} {isMember ? "Members" : "Voters"}
                </span>
              </h1>
              <p className="text-slate-500 text-[13px] mt-1">{sub}</p>
            </div>
          </div>
          <button onClick={() => window.print()} className="btn btn-amber">
            <Printer size={16} /> {t.memberPage.downloadPdf}
          </button>
        </div>

        {/* search + file filter */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="field !pl-10"
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setFileOpen(!fileOpen)}
              className="field !w-auto flex items-center gap-2 min-w-[210px] font-semibold"
            >
              <FileSpreadsheet size={16} className="text-slate-400" />
              {file === "all"
                ? `${t.memberPage.allFiles} (${allRows.length.toLocaleString()})`
                : file}
              <span className="ml-auto text-slate-400 text-[10px]">{fileOpen ? "▲" : "▼"}</span>
            </button>
            {fileOpen && (
              <div className="absolute right-0 mt-2 w-80 card p-2 z-40 shadow-xl">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={fileQ}
                    onChange={(e) => setFileQ(e.target.value)}
                    className="field !pl-8 !py-2 !text-[12px]"
                    placeholder={
                      lang === "si"
                        ? `ගොනු ${totalFiles} අතර සොයන්න...`
                        : `Search across ${totalFiles} ${totalFiles === 1 ? "files" : "files"}...`
                    }
                  />
                </div>
                <div className="max-h-64 overflow-y-auto mt-1">
                  <button
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12.5px] font-semibold ${file === "all" ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"}`}
                    onClick={() => {
                      setFile("all");
                      setFileOpen(false);
                      setPage(1);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={13} /> {t.memberPage.allFiles} ({allRows.length.toLocaleString()})
                    </span>
                    <span className="flex items-center gap-2 text-slate-500">
                      <span className="tabular-nums">{allRows.length.toLocaleString()}</span>
                      {file === "all" && <Check size={13} className="text-indigo-600" />}
                    </span>
                  </button>
                  {files
                    .filter((f) => !fileQ.trim() || f.file_name.toLowerCase().includes(fileQ.trim().toLowerCase()))
                    .map((f) => (
                      <button
                        key={f.file_name}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-semibold ${file === f.file_name ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"}`}
                        onClick={() => {
                          setFile(f.file_name);
                          setFileOpen(false);
                          setPage(1);
                        }}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <FileSpreadsheet size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{f.file_name}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="rounded-md bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[10px] tabular-nums">
                            {f.rows.toLocaleString()} rows
                          </span>
                          {file === f.file_name && <Check size={12} className="text-indigo-600" />}
                        </span>
                      </button>
                    ))}
                </div>
                <div className="flex items-center justify-between px-3 pt-2 mt-1 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    {t.memberPage.totalFiles}: <strong className="text-slate-700">{files.length || totalFiles}</strong>
                  </span>
                  <span>
                    {t.memberPage.totalRows}: <strong className="text-slate-700">{allRows.length.toLocaleString()}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* table */}
      <div className="card mt-5 overflow-x-auto">
        <table className="table-corporate w-full">
          <thead>
            <tr>
              {isMember && <th className="w-12">#</th>}
              <th>{isMember ? t.memberPage.memberNo : t.memberPage.voterNo}</th>
              <th>{t.memberPage.fullName}</th>
              <th>{t.memberPage.nic}</th>
              <th>{t.memberPage.address}</th>
              <th>{isMember ? (lang === "si" ? "තැපැල් ලිපිනය" : "Postal Address") : (lang === "si" ? "තැපැල් ලිපිනය" : "Postal Address")}</th>
              <th>{t.memberPage.gender}</th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr>
                <td colSpan={isMember ? 7 : 6} className="text-center text-slate-400 py-10">
                  {loading
                    ? (lang === "si" ? "දත්ත ලැබෙමින්…" : "Loading data…")
                    : allRows.length === 0
                      ? (lang === "si"
                          ? "තවම Excel දත්ත upload කර නැත — /admin/data එකෙන් upload කරන්න"
                          : "No uploaded data yet — upload Excel from /admin/data")
                      : (lang === "si" ? "දත්ත හමු නොවීය" : "No records found")}
                </td>
              </tr>
            ) : (
              view.map((r, i) => (
                <tr
                  key={`${r.member_no ?? r.voter_no}-${i}`}
                  onClick={() => setDetail(r)}
                  className="cursor-pointer hover:bg-indigo-50/60 transition-colors"
                  title={lang === "si" ? "සම්පූර්ණ විස්තර බලන්න" : "View full details"}
                >
                  {isMember && (
                    <td className="font-bold text-indigo-600 tabular-nums">
                      {(page - 1) * perPage + i + 1}
                    </td>
                  )}
                  <td className="font-bold text-indigo-700 tabular-nums">{r.member_no ?? r.voter_no}</td>
                  <td className="font-semibold text-slate-800">{r.full_name}</td>
                  <td className="tabular-nums text-slate-600">{r.nic}</td>
                  <td className="text-slate-600">{r.address}</td>
                  <td className="text-slate-600">{r.postal_address || "—"}</td>
                  <td>
                    <span className="badge-amber rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                      {genderLabel(r.gender)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 text-[13px]">
          <div className="text-slate-500">
            {t.memberPage.page} {page} / {totalPages.toLocaleString()}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-outline !py-1.5 !px-4 !text-[12px]"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              ‹ {t.memberPage.prev}
            </button>
            <button
              className="btn btn-outline !py-1.5 !px-4 !text-[12px]"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t.memberPage.next} ›
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[11.5px] text-slate-400 flex items-center gap-2">
        <Download size={13} />
        RFC-4180 CSV · Sinhala text supported (CSV UTF-8 / Excel .xlsx)
        {detail && ""}
      </div>

      {/* ✅ සම්පූර්ණ විස්තර popup — පේළියක් click කළ විට */}
      {detail && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Users size={22} className="text-white" />
                </div>
                <div>
                  <div className="text-white font-extrabold text-[15px] leading-tight">{detail.full_name || "—"}</div>
                  <div className="text-indigo-100 text-[11.5px] font-semibold tabular-nums">
                    {isMember ? (lang === "si" ? "සාමාජික අංකය" : "Member No") : (lang === "si" ? "ඡන්ද අංකය" : "Voter No")}: {detail.member_no ?? detail.voter_no ?? "—"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white text-lg leading-none flex items-center justify-center"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3.5">
              {[
                { label: lang === "si" ? "සම්පූර්ණ නම" : "Full Name", value: detail.full_name },
                { label: "NIC", value: detail.nic },
                { label: lang === "si" ? "ලිපිනය" : "Address", value: detail.address },
                { label: lang === "si" ? "තැපැල් ලිපිනය" : "Postal Address", value: detail.postal_address },
                { label: lang === "si" ? "ස්ත්‍රී/පුරුෂ" : "Gender", value: genderLabel(detail.gender) },
                { label: lang === "si" ? "ගොනුව" : "File", value: detail.file_name },
              ].map((f) => (
                <div key={f.label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide shrink-0">{f.label}</span>
                  <span className="text-[13px] font-semibold text-slate-800 text-right">{f.value || "—"}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setDetail(null)} className="btn btn-primary w-full">
                {lang === "si" ? "වසන්න" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
