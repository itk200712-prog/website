"use client";

// ============================================================================
// Data & Live Metrics — REAL Excel/CSV import + per-file PDF/CSV download
// Format: Member Number, NIC, FULL NAME, ADDRESS, POSTAL ADDRESS, GENDER
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  Database, Download, FileSpreadsheet, Printer, Trash2, UploadCloud, UsersRound, Vote,
} from "lucide-react";
import { AdminTopbar, dbInsert, useNotice } from "@/components/admin";
import { logActivity } from "@/lib/activity";
import { authedClient } from "@/lib/supabase/client";
import { MEMBER_FILES, SETTINGS, VOTER_FILES } from "@/lib/seed";

const MODES = [
  { key: "append", label: "Append to existing list" },
  { key: "replace-file", label: "Replace matching file(s) only" },
  { key: "replace-all", label: "Replace entire existing list" },
];

const BATCH = 500;

function stripExt(name: string) {
  return name.replace(/\.(xlsx|xls|csv)$/i, "");
}

type ParsedRow = {
  member_no: string;
  nic: string;
  full_name: string;
  address: string;
  postal_address: string;
  gender: string;
};

const HINTS: Record<keyof ParsedRow, string[]> = {
  member_no: ["membernumber", "memberno", "no", "number", "serial", "serialno", "සාමාජිකඅංකය", "අංකය", "අංක"],
  nic: ["nic", "nicno", "nicnumber", "nationalidentitycard", "identitycard", "හැඳුනුම්පත", "ජාතිකහැඳුනුම්පත", "ජාහැ"],
  full_name: ["fullname", "name", "membername", "සම්පූර්ණනම", "නම"],
  address: ["address", "homeaddress", "ලිපිනය", "ගම", "නිවාසලිපිනය"],
  postal_address: ["postaladdress", "postal", "mailingaddress", "තැපැල්ලිපිනය"],
  gender: ["gender", "sex", "ස්ත්‍රීපුරුෂ", "ස්ත්‍රිපුරුෂ", "භේදය"],
};
const NIC_LIKE = /^(\d{9}[vVxX]|\d{12}|\d{10}|0+)$/;

// ✅ ඔයාගේ excel වල title/notes පේළි (උදා: "කාරක සභා 41 සාමාජික ලේඛනය") ඉවත් — ඇත්ත member පේළි විතරයි
function isRealMemberRow(r: ParsedRow): boolean {
  const no = r.member_no.trim();
  const nic = r.nic.trim();
  const name = r.full_name.trim();
  if (no.length > 25 || name.length > 100) return false; // title/note පේළි
  if (NIC_LIKE.test(nic)) return true; // NIC තියෙනවා → ඇත්ත පේළියක්
  if (name.length >= 2 && name.length <= 60) return true; // නම තියෙනවා → ඇත්ත පේළියක්
  return false;
}

function parseRows(grid: unknown[][]): ParsedRow[] {
  const rowsIn = grid.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  if (!rowsIn.length) return [];
  const norm = (x: unknown) => String(x ?? "").toLowerCase().replace(/[^a-z0-9\u0d80-\u0dff]/g, "");
  const hit = (c: string, keys: string[]) => keys.some((k) => c === k || (k.length > 1 && c.includes(k)));

  // ✅ NIC තියෙන files (ලියාපදිංචි ලේඛන) වල header නෑ — මුලින්ම මේක බලන්න
  const probe = rowsIn.slice(0, 6);
  const col1Nic = probe.filter((r) => NIC_LIKE.test(String(r[1] ?? "").trim())).length;
  const col2Nic = probe.filter((r) => NIC_LIKE.test(String(r[2] ?? "").trim())).length;
  const looksData = col1Nic >= 1 || col2Nic >= 1;

  // header detection: දැන් වැඩ කරන්නේ data-file නොවන විට පමණයි
  const row0 = rowsIn[0].map(norm);
  const matches = row0.filter((c) => Object.values(HINTS).flat().some((k) => hit(c, [k]))).length;
  const hasHeader = !looksData && matches >= 2;

  if (hasHeader) {
    const idxOf = (keys: string[]) => row0.findIndex((c) => hit(c, keys));
    const map = {
      member_no: idxOf(HINTS.member_no),
      nic: idxOf(HINTS.nic),
      full_name: idxOf(HINTS.full_name),
      address: idxOf(HINTS.address),
      postal_address: idxOf(HINTS.postal_address),
      gender: idxOf(HINTS.gender),
    };
    return rowsIn
      .slice(1)
      .map((r) => {
        const g = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
        return {
          member_no: g(map.member_no),
          nic: g(map.nic),
          full_name: g(map.full_name),
          address: g(map.address),
          postal_address: g(map.postal_address),
          gender: g(map.gender),
        };
      })
      .filter((r) => isRealMemberRow(r));
  }

  // ✅ header නැති ඔයාගේ excel format එක — කොලම අනුව: අංකය, NIC, නම, ලිපිනය, තැපැල්, ස්ත්‍රී/පුරුෂ
  return rowsIn
    .map((r) => {
      const c = r.map((x) => String(x ?? "").trim());
      if (col2Nic > col1Nic) {
        // [අංකය, නම, NIC, ලිපිනය, තැපැල්, ස්ත්‍රී/පුරුෂ]
        return { member_no: c[0] ?? "", full_name: c[1] ?? "", nic: c[2] ?? "", address: c[3] ?? "", postal_address: c[4] ?? "", gender: c[5] ?? "" };
      }
      // [අංකය, NIC, නම, ලිපිනය, තැපැල්, ස්ත්‍රී/පුරුෂ] ← ඔයාගේ format එක
      return { member_no: c[0] ?? "", nic: c[1] ?? "", full_name: c[2] ?? "", address: c[3] ?? "", postal_address: c[4] ?? "", gender: c[5] ?? "" };
    })
    .filter((r) => isRealMemberRow(r));
}

async function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  // ✅ raw: true — member numbers "33/02" වගේ text විදිහටම තියෙන්න ඕනේ (date විදිහට නොවෙන)
  const wb = XLSX.read(buf, { type: "array", raw: true });
  // ✅ සියලු sheets පරීක්ෂා කරයි — මුල් sheet එක හිස්/cover නම් ඊළඟ එකෙන් data ගනී
  const out: ParsedRow[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
    out.push(...parseRows(grid as unknown[][]));
    if (out.length) break;
  }
  return out;
}

/* ------------------------------------------------------------------ PDF -- */
async function buildPdf(label: string, kind: "member" | "voter", rows: ParsedRow[], onProgress: (pct: number) => void) {
  const { buildRegisterPdf } = await import("@/lib/pdf-register");
  await buildRegisterPdf({ kind, label, rows, onProgress });
}

function downloadCsv(label: string, rows: ParsedRow[]) {
  const head = ["Member Number", "NIC", "FULL NAME", "ADDRESS", "POSTAL ADDRESS", "GENDER"];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((r) => [r.member_no, r.nic, r.full_name, r.address, r.postal_address, r.gender].map(esc).join(","));
  const blob = new Blob(["\uFEFF" + [head.join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${label}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------------------------------------- panels ---- */
function ImportPanel({ kind, title }: { kind: "member" | "voter"; title: string }) {
  const { show, node } = useNotice();
  const [mode, setMode] = useState("append");
  const [chosen, setChosen] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState("");
  const [prog, setProg] = useState("");
  const [files, setFiles] = useState<{ file_name: string; rows: number }[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [fileOpen, setFileOpen] = useState(false);
  const [anim, setAnim] = useState<{ pct: number; done: boolean; label: string } | null>(null);

  const table = kind === "member" ? "member_rows" : "voter_rows";
  const total = useMemo(() => files.reduce((a, b) => a + b.rows, 0), [files]);

  async function loadFiles() {
    const sb = await authedClient();
    const { data } = await sb.from("data_files").select("file_name, rows").eq("kind", kind).order("rows", { ascending: false });
    const real = ((data as { file_name: string; rows: number }[]) ?? []).map((f) => ({ file_name: f.file_name, rows: Number(f.rows) }));
    setFiles(real); // demo files නෑ — real uploads පමණයි
    setSelected((prev) =>
      real.some((f) => stripExt(f.file_name) === prev) ? prev : real[0] ? stripExt(real[0].file_name) : ""
    );
  }

  async function syncCounters(sb: Awaited<ReturnType<typeof authedClient>>) {
    const { data: all, error: countErr } = await sb.from("data_files").select("rows").eq("kind", kind);
    if (countErr) throw new Error(countErr.message);
    const list = ((all as { rows: number }[]) ?? []);
    const sum = list.reduce((a, b) => a + Number(b.rows), 0);
    const count = list.length;
    const settings =
      kind === "member"
        ? [
            { key: "members_total", value: String(sum) },
            { key: "members_files_count", value: String(count) },
          ]
        : [
            { key: "voters_total", value: String(sum) },
            { key: "voters_files_count", value: String(count) },
          ];
    const { error } = await sb.from("system_settings").upsert(settings, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { sum, count };
  }

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload() {
    if (!chosen.length) return show("⚠ කරුණාකර file එකක් තෝරන්න");
    setBusy(true);
    try {
      const sb = await authedClient();
      const names = chosen.map((f) => stripExt(f.name));

      if (mode === "replace-all") {
        setProg("Clearing existing list…");
        await sb.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await sb.from("data_files").delete().eq("kind", kind);
      } else if (mode === "replace-file") {
        setProg("Replacing matching files…");
        for (const n of names) {
          await sb.from(table).delete().eq("file_name", n);
          await sb.from("data_files").delete().eq("kind", kind).eq("file_name", n);
        }
      }

      for (let fi = 0; fi < chosen.length; fi++) {
        const file = chosen[fi];
        const label = stripExt(file.name);
        setProg(`Parsing ${file.name}…`);
        const rows = await parseSpreadsheet(file);
        if (!rows.length) {
          show(`⚠ ${file.name} — හිස් (columns බලන්න: Member Number, NIC, FULL NAME, ADDRESS, POSTAL ADDRESS, GENDER)`);
          continue;
        }
        for (let i = 0; i < rows.length; i += BATCH) {
          // ✅ voter_rows එකේ voter_no column — member_no නොවෙන විදිහට map වෙනවා
          const batch = rows.slice(i, i + BATCH).map((r) => {
            const base = { nic: r.nic, full_name: r.full_name, address: r.address, postal_address: r.postal_address, gender: r.gender, file_name: label };
            return kind === "member" ? { ...base, member_no: r.member_no } : { ...base, voter_no: r.member_no };
          });
          const { error } = await sb.from(table).insert(batch);
          if (error) throw new Error(error.message);
          setProg(`Uploading ${label} — ${Math.min(i + BATCH, rows.length).toLocaleString()} / ${rows.length.toLocaleString()} rows`);
        }
        await sb.from("data_files").delete().eq("kind", kind).eq("file_name", label);
        await sb.from("data_files").insert({ kind, file_name: label, rows: rows.length });
      }

      // live totals -> main site counters
      const { sum } = await syncCounters(sb);
      await dbInsert("data_imports", { kind, mode, files: names.join(",") });
      show(`✅ ${chosen.length} file(s) processed — ${sum.toLocaleString()} ${kind === "member" ? "members" : "voters"} total`);
      setChosen([]);
      await loadFiles();
    } catch (e) {
      show(`⚠ ${(e as Error).message}`);
    }
    setProg("");
    setBusy(false);
  }

  async function deleteSheet(f: { file_name: string; rows: number }) {
    const label = stripExt(f.file_name);
    const listName = kind === "member" ? "Members" : "Eligible Voters";
    if (!confirm(`"${label}" sheet එක මකන්නද?\nඑහි rows ${f.rows.toLocaleString()}ම ${listName} live ලැයිස්තුවෙන් අයින් වෙනවා. මේක ආපසු ගන්න බෑ.`)) return;
    setDeleting(label);
    setProg(`Deleting ${label}…`);
    try {
      const sb = await authedClient();
      const { error: rowErr } = await sb.from(table).delete().eq("file_name", label);
      if (rowErr) throw new Error(rowErr.message);
      const { error: fileErr } = await sb.from("data_files").delete().eq("kind", kind).eq("file_name", f.file_name);
      if (fileErr) throw new Error(fileErr.message);
      const { sum } = await syncCounters(sb);
      await dbInsert("data_imports", { kind, mode: "delete-file", files: label });
      void logActivity("DATA_DELETE", `${listName} sheet "${label}" deleted (${f.rows.toLocaleString()} rows)`);
      await loadFiles();
      show(`✅ "${label}" sheet එක මැකුණා — ඉතිරි ${listName}: ${sum.toLocaleString()}`);
    } catch (e) {
      show(`⚠ ${(e as Error).message}`);
    }
    setProg("");
    setDeleting("");
  }

  async function deleteAllSheets() {
    if (!files.length) return;
    const listName = kind === "member" ? "Members" : "Eligible Voters";
    if (!confirm(`${listName} එකට upload කරපු sheets ${files.length}ම මකන්නද?\nRows ${total.toLocaleString()}ම live ලැයිස්තුවෙන් අයින් වෙනවා. මේක ආපසු ගන්න බෑ.`)) return;
    setDeleting("__all__");
    setProg(`Deleting all ${listName} sheets…`);
    try {
      const sb = await authedClient();
      const { error: rowErr } = await sb.from(table).delete().not("id", "is", null);
      if (rowErr) throw new Error(rowErr.message);
      const { error: fileErr } = await sb.from("data_files").delete().eq("kind", kind);
      if (fileErr) throw new Error(fileErr.message);
      await syncCounters(sb);
      const names = files.map((f) => stripExt(f.file_name));
      await dbInsert("data_imports", { kind, mode: "delete-all", files: names.join(",") });
      void logActivity("DATA_DELETE", `All ${listName} sheets deleted (${files.length} files, ${total.toLocaleString()} rows)`);
      setSelected("");
      await loadFiles();
      show(`✅ ${listName} uploaded sheets සියල්ල මැකුණා`);
    } catch (e) {
      show(`⚠ ${(e as Error).message}`);
    }
    setProg("");
    setDeleting("");
  }

  async function downloadPdf() {
    const label = selected || stripExt(files[0]?.file_name ?? "register");
    setAnim({ pct: 0, done: false, label });
    try {
      const sb = await authedClient();
      let rows: ParsedRow[] = [];
      const { data } = await sb.from(table).select("*").eq("file_name", label).limit(20000);
      rows = (data as ParsedRow[]) ?? [];
      if (!rows.length) {
        show("⚠ මේ file එකට data නෑ — මුලින් Excel upload කරන්න");
        setAnim(null);
        return;
      }
      await buildPdf(label, kind, rows, (pct) => setAnim({ pct, done: false, label }));
      setAnim({ pct: 100, done: true, label });
      setTimeout(() => setAnim(null), 1800);
    } catch (e) {
      setAnim(null);
      show(`⚠ ${(e as Error).message}`);
    }
  }

  // Excel sheet එකේ හැම cell එකකටම Iskoola Pota ෆොන්ට් දානවා
  function applyBookFont(ws: Record<string, unknown>) {
    try {
      const range = (ws["!ref"] as string) || "";
      if (!range) return;
      const dec = range.split(":").map((c) => c.replace(/\D/g, ""));
      const maxCol = Number(dec[1] ?? dec[0] ?? 20);
      const maxRow = Number(range.split(":")[1]?.replace(/\D/g, "") ?? 200);
      for (let r = 0; r <= maxRow; r++) {
        for (let c = 0; c <= maxCol; c++) {
          const addr = String.fromCharCode(65 + (c % 26)) + (c >= 26 ? String(Math.floor(c / 26)) : "") + (r + 1);
          const cell = ws[addr] as { s?: Record<string, unknown> } | undefined;
          if (!cell) continue;
          cell.s = { ...(cell.s ?? {}), font: { name: "Iskoola Pota", sz: 11 } };
        }
      }
    } catch {
      /* style නොදැම්මත් export එක වැඩ කරයි */
    }
  }

  function downloadSample(xlsx: boolean) {
    const head = ["Member Number", "NIC", "FULL NAME", "ADDRESS", "POSTAL ADDRESS", "GENDER"];
    const sample = [{ member_no: "001", nic: "123456789012", full_name: "මදුරංග", address: "හෙට්ටිපොල", postal_address: "හෙට්ටිපොල", gender: "Male" }];
    if (xlsx) {
      (async () => {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(sample, { header: head });
        const wb = XLSX.utils.book_new();
        // ✅ "ඉස්කෝල පොත" ෆොන්ට් — Excel cell font (Iskoola Pota)
        applyBookFont(ws);
        XLSX.utils.book_append_sheet(wb, ws, "Members");
        XLSX.writeFile(wb, `member-template.xlsx`);
      })();
    } else downloadCsv("member-template", sample);
  }

  return (
    <div className="card p-6">
      {node}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
          <Database size={19} className="text-indigo-700" /> {title}
        </h3>
        <span className="badge-blue rounded-full px-3 py-1 text-[11px] font-bold tabular-nums">
          {total.toLocaleString()} {kind === "member" ? "Members" : "Voters"}
        </span>
      </div>
      <p className="text-slate-500 text-[12px] mt-1.5">
        {kind === "member"
          ? "Upload member spreadsheet files (.xlsx / .xls / .csv) — rows are parsed and counted automatically (කාරක සභා 52)."
          : "Upload verified voter records from the electoral register file to update the live eligible voters count."}
      </p>

      <div className="mt-5">
        <label className="field-label">
          Select {kind === "member" ? "Member Register" : "Electoral Register"} File(s) (Excel .xlsx, .xls or CSV):
        </label>
        <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 cursor-pointer hover:border-indigo-400">
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => setChosen(Array.from(e.target.files ?? []))}
          />
          <span className="btn btn-outline !py-2 !px-4 !text-[12px]">Choose Files</span>
          <span className="text-slate-500 text-[12.5px]">
            {chosen.length ? chosen.map((f) => f.name).join(", ") : "No file chosen"}
          </span>
        </label>
        <div className="mt-2.5 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-2.5 text-[11px] text-indigo-900 leading-relaxed">
          💡 Tip: To ensure Sinhala text renders without question marks (??), upload Excel (.xlsx) directly or save as &quot;CSV UTF-8&quot;.
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {MODES.map((m) => (
          <label key={m.key} className="flex items-center gap-2 text-[12.5px] text-slate-700 font-semibold cursor-pointer">
            <input type="radio" name={`mode-${kind}`} checked={mode === m.key} onChange={() => setMode(m.key)} className="accent-indigo-700" />
            {m.label}
          </label>
        ))}
      </div>

      <button className="btn btn-primary w-full mt-4 disabled:opacity-60" disabled={busy || !!deleting} onClick={upload}>
        <UploadCloud size={16} /> {busy || deleting ? (prog || "Processing…") : "Upload & Process File"}
      </button>
      {(busy || deleting) && (
        <div className="mt-2.5 h-1.5 rounded-full bg-indigo-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: "100%", animation: "pulse 1s infinite" }} />
        </div>
      )}

      {/* uploaded sheets — එකින් එක හෝ සියල්ලම මකන්න (live rows ත් අයින් වේ) */}
      <div className="border-t border-slate-100 mt-6 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="field-label !mb-1">Uploaded sheets ({files.length})</div>
            <p className="text-[11px] text-slate-400">
              Sheet එකක් මැකුවම එහි rows සියල්ලම live {kind === "member" ? "Members" : "Eligible Voters"} ලැයිස්තුවෙන් සහ counters වලින් අයින් වේ.
            </p>
          </div>
          <button
            className="btn btn-outline !py-1.5 !px-3 !text-[11px] !border-rose-200 !text-rose-600 hover:!bg-rose-50 disabled:opacity-50"
            onClick={() => void deleteAllSheets()}
            disabled={!files.length || busy || !!deleting}
            title="Upload කරපු sheets සියල්ල මකන්න"
          >
            <Trash2 size={13} /> {deleting === "__all__" ? "Deleting…" : "Delete all sheets"}
          </button>
        </div>
        {files.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-[11.5px] text-slate-400">
            Upload කරපු sheets නෑ
          </div>
        ) : (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {files.map((f) => {
              const label = stripExt(f.file_name);
              return (
                <div key={`${f.file_name}-${f.rows}`} className="flex items-center gap-2.5 px-3 py-2">
                  <FileSpreadsheet size={14} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-800">{label}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{f.rows.toLocaleString()} rows</span>
                  <button
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                    onClick={() => void deleteSheet(f)}
                    disabled={busy || !!deleting}
                    title={`"${label}" sheet එක මකන්න`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* download */}
      <div className="border-t border-slate-100 mt-6 pt-5">
        <div className="field-label">
          Download {kind === "member" ? "Registered" : "Elective"} Members by File:
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <button className="field !w-auto min-w-[200px] flex items-center justify-between gap-3 font-semibold" onClick={() => setFileOpen(!fileOpen)}>
              <span className="flex items-center gap-2">
                <FileSpreadsheet size={15} className="text-slate-400" />
                {selected || `All Files (${total.toLocaleString()})`}
              </span>
              <span className="text-slate-400">⌄</span>
            </button>
            {fileOpen && (
              <div className="absolute z-40 mt-2 w-64 card p-2 shadow-xl max-h-72 overflow-y-auto">
                {files.map((f) => (
                  <button
                    key={f.file_name}
                    className="w-full px-3 py-2 rounded-lg hover:bg-indigo-50 text-[12px] flex justify-between"
                    onClick={() => {
                      setSelected(stripExt(f.file_name));
                      setFileOpen(false);
                    }}
                  >
                    <span className="font-semibold text-slate-800">{stripExt(f.file_name)}</span>
                    <span className="text-slate-400 tabular-nums">{f.rows.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-amber !py-2 !px-4 !text-[12px]" onClick={downloadPdf}>
            <Printer size={14} /> Download (PDF)
          </button>
          <button
            className="btn btn-primary !py-2 !px-4 !text-[12px]"
            onClick={async () => {
              const label = selected || stripExt(files[0]?.file_name ?? "register");
              const sb = await authedClient();
              const { data } = await sb.from(table).select("*").eq("file_name", label).limit(20000);
              let rows = (data as ParsedRow[]) ?? [];
              if (!rows.length) {
                show("⚠ මේ file එකට data නෑ — මුලින් Excel upload කරන්න");
                return;
              }
              downloadCsv(label, rows);
            }}
          >
            <Download size={14} /> Download (CSV)
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 mt-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] font-bold text-slate-700">Expected Columns Format:</div>
          <div className="flex gap-2">
            <button className="btn btn-outline !py-1.5 !px-3 !text-[11px]" onClick={() => downloadSample(true)}>
              📋 Sample (.xlsx)
            </button>
            <button className="btn btn-outline !py-1.5 !px-3 !text-[11px]" onClick={() => downloadSample(false)}>
              ⬇ Sample CSV
            </button>
          </div>
        </div>
        <code className="mt-2 block rounded-xl bg-slate-900 text-emerald-300 px-4 py-2.5 text-[11.5px]">
          Member Number, NIC, FULL NAME, ADDRESS, POSTAL ADDRESS, GENDER
        </code>
        <p className="text-slate-400 text-[10.5px] mt-2">
          RFC-4180 standard CSV supported. Quotes around commas are handled automatically.
          {kind === "voter" && " Verified voters count automatically syncs."}
        </p>
      </div>

      {/* animated PDF overlay */}
      {anim && (
        <div className="fixed inset-0 z-[100] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-8 w-[340px] text-center shadow-2xl">
            {!anim.done ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <div className="mt-4 font-extrabold text-slate-900 text-[15px]">
                  Preparing <span className="text-indigo-700">{anim.label}</span> PDF…
                </div>
                <div className="mt-3 h-2 rounded-full bg-indigo-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-300" style={{ width: `${anim.pct}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-slate-500 tabular-nums">{anim.pct}% — {kind === "member" ? "Member register" : "Electoral register"}</div>
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <div className="mt-4 font-extrabold text-emerald-700 text-[15px]">✅ {anim.label}.pdf downloaded!</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDataPage() {
  return (
    <div>
      <AdminTopbar title="Data & Live Metrics" sub="Manage operational data registries — member spreadsheets & electoral register files" />

      <div className="card p-5 mb-6 border-l-4 border-indigo-600 text-[12.5px] text-slate-600 leading-relaxed">
        <b className="text-slate-900">කාරක සභා 52 · සාමාජිකයන් {SETTINGS.members_total.toLocaleString()} · චන්ද හිමියන් {SETTINGS.voters_total.toLocaleString()}</b>
        <br />
        එක් එක් කාරක සභාවේ සාමාජික ලැයිස්තුව Excel ගොනුවක් ලෙස උඩුගත කරන්න. එය Member Number, NIC, FULL NAME, ADDRESS, POSTAL ADDRESS, GENDER යන කොලම වලින් සමන්විත විය යුතුයි. උඩුගත කළ පසු සැබෑ සාමාජික ගණන ස්වයංක්‍රීයව ගණනය වී ප්‍රධාන වෙබ් අඩවියේ පෙන්වයි. Download වලින් එක් එක් ගොනුවේ සාමාජිකයන්ගේ දත්ත සහිත PDF එකක් ලබා ගත හැක.
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ImportPanel kind="member" title="Members Directory Registry (කාරක සභා 52)" />
        <ImportPanel kind="voter" title="Electoral Register / චන්ද හිමි ලැයිස්තුව" />
      </div>
    </div>
  );
}
