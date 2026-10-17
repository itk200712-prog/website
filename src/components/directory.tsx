"use client";

// ============================================================================
// Member / Voter directory table — REAL uploaded registry data
//  Members: # | MEMBER NO | FULL NAME | NIC | ADDRESS | POSTAL ADDRESS | GENDER
//  Voters:  # | VOTER NO  | FULL NAME | NIC | ADDRESS | POSTAL ADDRESS | GENDER
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Building2, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Eye, FileSpreadsheet, Layers, Printer, Search, Users, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { createAnonClient } from "@/lib/supabase/anon";
import type { DataFile, MemberRow, VoterRow } from "@/lib/types";

type AnyRow = (MemberRow | VoterRow) & { member_no?: string; voter_no?: string; postal_address?: string; file_name?: string };

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

function genderTone(g: string): string {
  const s = String(g || "").toLowerCase();
  if (/ස්ත්‍රි|ස්ත්‍රී|ගැහැණ|කාන්ත|^f/.test(s)) return "rose";
  if (/පුරුෂ|පිරිමි|^m/.test(s)) return "indigo";
  return "slate";
}

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
      rows.sort(
        (a, b) =>
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
  const noLabel = isMember ? "Member No" : "Voter No";

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

  const from = filtered.length === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, filtered.length);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* ═══════════════ premium header ═══════════════ */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 shadow-[0_24px_60px_-24px_rgba(49,46,129,0.55)]">
        <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(circle at 82% 18%, rgba(255,255,255,0.55) 0%, transparent 46%), radial-gradient(circle at 12% 88%, rgba(16,185,129,0.5) 0%, transparent 42%)" }} />
        <div className="absolute top-0 right-0 w-80 h-80 -translate-y-40 translate-x-40 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/12 border border-white/20 text-white flex items-center justify-center shadow-inner">
                {isMember ? <Users size={26} /> : <Building2 size={26} />}
              </div>
              <div>
                <h1 className="text-[22px] sm:text-2xl font-extrabold text-white flex flex-wrap items-center gap-3 leading-tight">
                  {title}
                  <span className="rounded-full px-3.5 py-1 text-[12px] font-bold tabular-nums bg-emerald-400/15 text-emerald-300 border border-emerald-300/25">
                    {allRows.length.toLocaleString()} {isMember ? "Members" : "Voters"}
                  </span>
                </h1>
                <p className="text-indigo-100/80 text-[13px] mt-1.5">{sub}</p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.97] text-slate-900 font-extrabold text-[13px] px-5 py-3 shadow-lg shadow-amber-500/25 transition-all"
            >
              <Printer size={16} /> {t.memberPage.downloadPdf}
            </button>
          </div>

          {/* ═══════════════ toolbar ═══════════════ */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-200/80" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-indigo-200/70 pl-11 pr-4 py-3 text-[13.5px] font-medium outline-none focus:border-emerald-300/60 focus:bg-white/15 transition-colors"
                placeholder={searchPlaceholder}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setFileOpen(!fileOpen)}
                className="flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/20 text-white min-w-[220px] px-4 py-3 text-[13px] font-semibold hover:bg-white/15 transition-colors"
              >
                <FileSpreadsheet size={16} className="text-indigo-200/80" />
                <span className="truncate">{file === "all" ? `${t.memberPage.allFiles} (${allRows.length.toLocaleString()})` : file}</span>
                <span className="ml-auto text-indigo-200/70 text-[10px]">{fileOpen ? "▲" : "▼"}</span>
              </button>
              {fileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 p-2 z-40 shadow-2xl">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={fileQ}
                        onChange={(e) => setFileQ(e.target.value)}
                        className="field !pl-8 !py-2 !text-[12px]"
                        placeholder={
                          lang === "si"
                            ? `ගොනු ${files.length} අතර සොයන්න...`
                            : `Search across ${files.length} ${files.length === 1 ? "file" : "files"}...`
                        }
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto mt-1">
                      <button
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] font-semibold ${file === "all" ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"}`}
                        onClick={() => {
                          setFile("all");
                          setFileOpen(false);
                          setPage(1);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <Layers size={13} /> {t.memberPage.allFiles}
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
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-semibold ${file === f.file_name ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"}`}
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
                </>
              )}
            </div>
          </div>

          {/* meta line */}
          <div className="mt-3 flex items-center gap-2 text-[11.5px] text-indigo-100/70 font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 border border-white/12 px-3 py-1">
              {loading
                ? (lang === "si" ? "දත්ත ලැබෙමින්…" : "Loading data…")
                : (lang === "si"
                    ? `පෙන්වන්නේ ${from.toLocaleString()}–${to.toLocaleString()} / ${filtered.length.toLocaleString()} පේළි`
                    : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${filtered.length.toLocaleString()} entries`)}
            </span>
            {file !== "all" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 border border-emerald-300/25 text-emerald-200 px-3 py-1">
                <FileSpreadsheet size={11} /> {file}
                <button onClick={() => setFile("all")} className="hover:text-white ml-0.5"><X size={11} /></button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ table ═══════════════ */}
      <div className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
                {isMember && <th className="w-12 px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-200">#</th>}
                <th className="px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-200">{isMember ? t.memberPage.memberNo : t.memberPage.voterNo}</th>
                <th className="px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-200">{t.memberPage.fullName}</th>
                <th className="px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-200">{t.memberPage.nic}</th>
                <th className="px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-200">{t.memberPage.address}</th>
                <th className="px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-200">{lang === "si" ? "තැපැල් ලිපිනය" : "Postal Address"}</th>
                <th className="px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-200">{t.memberPage.gender}</th>
              </tr>
            </thead>
            <tbody>
              {view.length === 0 ? (
                <tr>
                  <td colSpan={isMember ? 7 : 7} className="text-center py-14">
                    {loading ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                        <span className="text-slate-400 text-[13px] font-medium">{lang === "si" ? "දත්ත ලැබෙමින්…" : "Loading data…"}</span>
                      </div>
                    ) : allRows.length === 0 ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <FileSpreadsheet size={28} className="text-slate-300" />
                        </div>
                        <div className="text-slate-500 font-semibold text-[13.5px]">
                          {lang === "si" ? "තවම Excel දත්ත upload කර නැත" : "No uploaded data yet"}
                        </div>
                        <div className="text-slate-400 text-[12px]">
                          {lang === "si" ? "/admin/data එකෙන් Excel upload කරන්න" : "Upload Excel files from /admin/data"}
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-[13px]">{lang === "si" ? "දත්ත හමු නොවීය" : "No records found"}</div>
                    )}
                  </td>
                </tr>
              ) : (
                view.map((r, i) => {
                  const tone = genderTone(r.gender);
                  return (
                    <tr
                      key={`${r.member_no ?? r.voter_no}-${i}`}
                      onClick={() => setDetail(r)}
                      className="group cursor-pointer border-b border-slate-100/90 even:bg-slate-50/50 hover:bg-indigo-50/70 transition-colors"
                      title={lang === "si" ? "සම්පූර්ණ විස්තර බලන්න" : "View full details"}
                    >
                      {isMember && (
                        <td className="px-4 py-3 text-[12px] font-bold tabular-nums text-slate-400 group-hover:text-indigo-500">
                          {(page - 1) * perPage + i + 1}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-lg bg-indigo-50 group-hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 text-[12.5px] font-extrabold tabular-nums transition-colors">
                          {r.member_no ?? r.voter_no}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13.5px] font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-2">
                          {r.full_name}
                          <Eye size={13} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] tabular-nums text-slate-600">{r.nic || "—"}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-600">{r.address || "—"}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-600">{r.postal_address || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            tone === "rose"
                              ? "bg-rose-50 text-rose-600 border border-rose-100"
                              : tone === "indigo"
                                ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                : "bg-amber-50 text-amber-600 border border-amber-100"
                          }`}
                        >
                          {genderLabel(r.gender) || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ═══════════════ pagination ═══════════════ */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50/70 border-t border-slate-100">
          <div className="text-[12px] text-slate-500 font-medium">
            {lang === "si"
              ? `පිටුව ${page.toLocaleString()} / ${totalPages.toLocaleString()} · පෙන්වන්නේ ${from.toLocaleString()}–${to.toLocaleString()} / ${filtered.length.toLocaleString()}`
              : `Page ${page.toLocaleString()} / ${totalPages.toLocaleString()} · Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${filtered.length.toLocaleString()}`}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-colors"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              title="First"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-colors"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={14} /> {t.memberPage.prev}
            </button>
            <span className="inline-flex items-center rounded-xl bg-indigo-600 text-white px-4 py-2 text-[12px] font-extrabold tabular-nums shadow-md shadow-indigo-500/25">
              {page.toLocaleString()}
            </span>
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-colors"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t.memberPage.next} <ChevronRight size={14} />
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-colors"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              title="Last"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[11.5px] text-slate-400 flex items-center gap-2">
        <Download size={13} />
        RFC-4180 CSV · Sinhala text supported (CSV UTF-8 / Excel .xlsx) · {lang === "si" ? "විස්තර බලන්න පේළියක් click කරන්න" : "Click any row to view full details"}
      </div>

      {/* ═══════════════ full details popup ═══════════════ */}
      {detail && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-800 to-indigo-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Users size={22} className="text-white" />
                </div>
                <div>
                  <div className="text-white font-extrabold text-[15px] leading-tight">{detail.full_name || "—"}</div>
                  <div className="text-indigo-100 text-[11.5px] font-semibold tabular-nums">
                    {lang === "si" ? (isMember ? "සාමාජික අංකය" : "ඡන්ද අංකය") : noLabel}: {detail.member_no ?? detail.voter_no ?? "—"}
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
