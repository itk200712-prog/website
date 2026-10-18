"use client";

// ============================================================================
// Backup & Restore — SUPERADMIN ONLY
// Download = full-site ZIP (database.sql + schema.sql + registers) — password gated
// Import = full restore from ZIP/.sql (password gated)
// Two separate passwords, visible + changeable by superadmin only
// ============================================================================

import { useEffect, useState } from "react";
import {
  DatabaseBackup, Download, Eye, EyeOff, KeyRound, ShieldCheck, UploadCloud, Save,
} from "lucide-react";
import { AdminTopbar, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import {
  BACKUP_TABLES, generateBackupZip, getBackupSecrets, parseBackupSql, restoreBackup, setBackupSecret,
} from "@/lib/backup";
import {
  BACKUP_FORMAT_VERSION, decryptBackupText, isEncryptedBackupText, sha256Hex, summarizeInserts,
  type BackupManifest, type ParsedInsert,
} from "@/lib/backup-utils";
import { logActivity } from "@/lib/activity";

export default function AdminBackupPage() {
  const { show, node } = useNotice();
  const [role, setRole] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<{ download: string; importPw: string } | null>(null);
  const [showPw, setShowPw] = useState(false);

  const [dlPw, setDlPw] = useState("");
  const [imPw, setImPw] = useState("");
  const [anim, setAnim] = useState<{ pct: number; msg: string; done: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const [newDl, setNewDl] = useState("");
  const [newIm, setNewIm] = useState("");

  const [encryptDl, setEncryptDl] = useState(false); // 🔒 download password එකෙන්ම encrypt කරන්නද
  const [encPw, setEncPw] = useState(""); // encrypted backup import එකට
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [intervalDays, setIntervalDays] = useState(7);
  const [safetyFirst, setSafetyFirst] = useState(true); // 🛡 import එකට කලින් auto safety-backup
  const [confirmText, setConfirmText] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<{
    fileName: string;
    inserts: ParsedInsert[];
    tables: { name: string; rows: number; known: boolean }[];
    totalRows: number;
    manifest: BackupManifest | null;
    manifestMsg: string;
    encrypted: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const sb = await authedClient();
      const { data: u } = await sb.auth.getUser();
      if (!u?.user) { setRole("guest"); return; }
      const { data: prof } = await sb.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      setRole(prof?.role ?? "member");
      if (prof?.role === "superadmin") {
        const s = await getBackupSecrets();
        setSecrets(s);
        // අවසාන backup දිනය + මතක් කිරීමේ කාල පරතරය
        const { data: lb } = await sb
          .from("admin_activity_logs")
          .select("created_at")
          .eq("action", "BACKUP_DOWNLOAD")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lb?.created_at) setLastBackup(lb.created_at as string);
        const { data: ivRow } = await sb
          .from("system_settings")
          .select("value")
          .eq("key", "backup_interval_days")
          .maybeSingle();
        const iv = parseInt(ivRow?.value ?? "", 10);
        if (iv > 0) setIntervalDays(iv);
      }
    })();
  }, []);

  async function downloadBackup() {
    if (!secrets) return show("⚠ backup_secrets table එක නෑ — පහත SQL block එක run කරන්න");
    if (dlPw !== secrets.download) return show("⚠ Download password එක වැරදියි ❌");
    setBusy(true);
    setAnim({ pct: 0, msg: "Preparing backup…", done: false });
    try {
      // ✅ සම්පූර්ණ ZIP: schema.sql + database.sql(+logins) + registers + manifest + RECOVERY
      const blob = await generateBackupZip(
        (msg, pct) => setAnim({ pct, msg, done: false }),
        encryptDl ? { encryptPassword: dlPw } : undefined
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mpcs-full-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setLastBackup(new Date().toISOString());
      void logActivity("BACKUP_DOWNLOAD", `Full ZIP backup (schema.sql + database.sql + logins + images + registers + manifest${encryptDl ? " + ENCRYPTED" : ""}) — ${a.download}`);
      setAnim({ pct: 100, msg: "Backup downloaded ✅", done: true });
      setTimeout(() => setAnim(null), 1800);
    } catch (e) {
      setAnim(null);
      show(`⚠ ${(e as Error).message}`);
    }
    setBusy(false);
  }

  // ① file එක කියවා Preview එක හදනවා (restore වෙන්නේ නෑ තාම) — verify + decrypt + summary
  async function prepareImport(file: File) {
    if (!secrets) return show("⚠ backup_secrets table එක නෑ — පහත SQL block එක run කරන්න");
    if (imPw !== secrets.importPw) return show("⚠ Import password එක වැරදියි ❌");
    if (!/\.(sql|zip)$/i.test(file.name)) return show("⚠ .sql හෝ .zip backup file එකක් තෝරන්න");
    setBusy(true);
    setAnim({ pct: 0, msg: "Reading backup file…", done: false });
    try {
      let rawSql: string;
      let manifest: BackupManifest | null = null;
      if (/\.zip$/i.test(file.name)) {
        setAnim({ pct: 2, msg: "Opening ZIP…", done: false });
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const entry = zip.file("database.sql") ?? zip.file(/database\.sql$/i)[0];
        if (!entry) throw new Error("ZIP එකේ database.sql නෑ");
        rawSql = await entry.async("string");
        const manEntry = zip.file("manifest.json") ?? zip.file(/manifest\.json$/i)[0];
        if (manEntry) {
          try { manifest = JSON.parse(await manEntry.async("string")) as BackupManifest; } catch { manifest = null; }
        }
      } else {
        rawSql = await file.text();
      }

      // manifest hash verify (file එක corrupt/වෙනස් වෙලාද?)
      let manifestMsg = "";
      if (manifest) {
        const expected = manifest.files?.["database.sql"]?.sha256 ?? "";
        const actual = await sha256Hex(rawSql);
        manifestMsg = expected && expected === actual
          ? `✅ Manifest verify හරි — ${manifest.generatedAt?.slice(0, 10) ?? "?"} backup එකක් (format v${manifest.formatVersion}, tables ${Object.keys(manifest.tableCounts ?? {}).length}, rows ${manifest.totalRows ?? "?"})`
          : "⚠ Manifest hash එක ගැළපෙන්නේ නෑ — file එක වෙනස් වී/corrupt වී තියෙන්න පුළුවන්! පරිස්සමින්.";
        if ((manifest.formatVersion ?? 1) > BACKUP_FORMAT_VERSION)
          manifestMsg += ` (⚠ මේක අලුත් format v${manifest.formatVersion} එකක් — site එක update කරලා නම් වඩා හොඳයි)`;
      } else {
        manifestMsg = "ℹ️ manifest.json නෑ — පරණ (format v1) backup එකක් විය හැක. Import කළ හැක, නමුත් hash verify කරන්න බෑ.";
      }

      // encrypted නම් decrypt
      const encrypted = isEncryptedBackupText(rawSql);
      let sql = rawSql;
      if (encrypted) {
        if (!encPw) throw new Error("මේ backup එක encrypt වී ඇත 🔒 — Encryption password එක ඇතුළත් කර නැවත file එක තෝරන්න");
        setAnim({ pct: 5, msg: "Decrypting backup…", done: false });
        sql = await decryptBackupText(rawSql, encPw);
        if (manifest?.databasePlainSha256) {
          const okHash = (await sha256Hex(sql)) === manifest.databasePlainSha256;
          manifestMsg += okHash ? " · 🔓 decrypt + hash හරි" : " · ⚠ decrypt වුණත් plain hash ගැළපෙන්නේ නෑ!";
        }
      }

      const inserts = parseBackupSql(sql);
      if (!inserts.length) throw new Error("backup file එකේ INSERT rows නෑ");
      const { tables: rawTables, totalRows } = summarizeInserts(inserts);
      const knownOrder = BACKUP_TABLES.map((t) => t.name);
      const tables = rawTables
        .map((t) => ({ ...t, known: knownOrder.includes(t.name) }))
        .sort((a, b) => {
          const ia = knownOrder.indexOf(a.name); const ib = knownOrder.indexOf(b.name);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.name.localeCompare(b.name);
        });
      const sel: Record<string, boolean> = {};
      for (const t of tables) sel[t.name] = t.known;
      setSelected(sel);
      setConfirmText("");
      setPreview({ fileName: file.name, inserts, tables, totalRows, manifest, manifestMsg, encrypted });
      setAnim(null);
      show(`📋 Preview ලෑස්තියි — ${file.name}: tables ${tables.length}, rows ${totalRows}. පරීක්ෂා කර RESTORE කරන්න.`);
    } catch (e) {
      setAnim(null);
      show(`⚠ ${(e as Error).message}`);
    }
    setBusy(false);
  }

  // ② Preview එක තහවුරු කළාම — safety backup (විකල්පය අනුව) → restore
  async function confirmImport() {
    if (!preview || !secrets) return;
    if (imPw !== secrets.importPw) return show("⚠ Import password එක වැරදියි ❌");
    if (confirmText !== "RESTORE") return show("⚠ තහවුරු කරන්න RESTORE කියා ලියන්න");
    const chosen = preview.tables.filter((t) => t.known && selected[t.name]).map((t) => t.name);
    if (!chosen.length) return show("⚠ restore කරන්න එක table එකක්වත් තෝරන්න");
    setBusy(true);
    try {
      // 🛡 මුලින්ම දැන් තියන site එකේ safety backup එකක් auto-download
      if (safetyFirst) {
        setAnim({ pct: 0, msg: "🛡 Safety backup ගන්නවා (import එකට කලින්)…", done: false });
        try {
          const blob = await generateBackupZip((msg, pct) => setAnim({ pct: Math.round(pct * 0.5), msg: "🛡 Safety: " + msg, done: false }));
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `mpcs-SAFETY-backup-${new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "")}.zip`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          setLastBackup(new Date().toISOString());
          void logActivity("BACKUP_DOWNLOAD", `Auto SAFETY backup before import — ${a.download}`);
        } catch (e) {
          if (!confirm(`⚠ Safety backup එක ගන්න බැරි වුණා (${(e as Error).message}). Safety backup එකක් නැතිව restore කරන්නද?`)) {
            setAnim(null);
            setBusy(false);
            return;
          }
        }
      }
      setAnim({ pct: 50, msg: "Restoring…", done: false });
      const partial = chosen.length < preview.tables.filter((t) => t.known).length;
      const { restored, errors } = await restoreBackup(
        preview.inserts,
        (msg, pct) => setAnim({ pct: 50 + Math.round(pct * 0.5), msg, done: false }),
        { onlyTables: chosen }
      );
      const total = Object.values(restored).reduce((a, b) => a + b, 0);
      void logActivity("BACKUP_IMPORT", `${preview.fileName} — restored ${Object.keys(restored).length} tables / ${total} rows${partial ? " (partial)" : ""}`);
      setPreview(null);
      setAnim({ pct: 100, msg: `Restored ${total} rows ✅`, done: true });
      setTimeout(() => setAnim(null), 2200);
      show(errors.length ? `⚠ Restored with ${errors.length} issue(s): ${errors[0]}` : `✅ සියල්ල restore කළා — ${Object.keys(restored).length} tables, ${total} rows`);
    } catch (e) {
      setAnim(null);
      show(`⚠ ${(e as Error).message}`);
    }
    setBusy(false);
  }

  const daysAgo = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null;

  if (role && role !== "superadmin") {
    return (
      <div>
        <AdminTopbar title="Backup & Restore" sub="Full site data export / import" />
        <div className="card p-12 text-center">
          <ShieldCheck size={48} className="mx-auto text-rose-500" />
          <h2 className="mt-4 text-xl font-extrabold text-slate-900">Superadmin Access Only</h2>
          <p className="text-slate-500 text-sm mt-2">මෙම පහසුකම භාවිතා කළ හැක්කේ superadmin ගිණුමට පමණයි.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminTopbar title="Backup & Restore" sub="මුලු site එකම එක් ZIP එකක් ලෙස (data + schema + images + login passwords) හෝ backup එකකින් restore කරන්න" />
      {node}

      {/* LAST BACKUP REMINDER */}
      {role === "superadmin" && (
        <div className={`card p-4 mb-6 border-l-4 ${daysAgo === null || daysAgo > intervalDays ? "border-rose-500" : "border-emerald-500"} flex flex-wrap items-center gap-3`}>
          <div className="flex-1 min-w-[240px] text-[12.5px] text-slate-700">
            {daysAgo === null ? (
              <>🔴 <b>Backup එකක් download කර ඇති බවට සටහනක් නෑ!</b> අදම backup එකක් ගන්න.</>
            ) : daysAgo > intervalDays ? (
              <>🔴 <b>අවසාන backup එක දින {daysAgo}කට පෙර</b> ({lastBackup?.slice(0, 10)}) — අලුත් backup එකක් ගන්න වෙලාව!</>
            ) : (
              <>🟢 <b>අවසාන backup: දින {daysAgo}කට පෙර</b> ({lastBackup?.slice(0, 10)}) ✅</>
            )}
          </div>
          <label className="flex items-center gap-2 text-[11.5px] text-slate-500">
            මතක් කිරීමේ පරතරය:
            <select
              className="field !w-auto !py-1 !text-[12px]"
              value={intervalDays}
              onChange={async (e) => {
                const v = parseInt(e.target.value, 10);
                setIntervalDays(v);
                const sb = await authedClient();
                await sb.from("system_settings").upsert({ key: "backup_interval_days", value: String(v) }, { onConflict: "key" });
              }}
            >
              {[3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>දින {d}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!secrets && role === "superadmin" && (
        <div className="card p-5 mb-6 border-l-4 border-amber-500 text-[12.5px] text-slate-700">
          ⚠ <b>backup_secrets table එක නෑ.</b> Supabase SQL Editor එකේ මේ block එක run කරන්න:
          <pre className="mt-2 rounded-xl bg-slate-900 text-emerald-300 p-3 text-[10.5px] overflow-x-auto">{`create table if not exists public.backup_secrets (key text primary key, value text not null default '');
create table if not exists public.site_images_backup (path text primary key, data_base64 text default '', content_type text default '');
alter table public.backup_secrets enable row level security;
alter table public.site_images_backup enable row level security;
drop policy if exists backup_secrets_super on public.backup_secrets;
create policy backup_secrets_super on public.backup_secrets for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
drop policy if exists site_images_backup_super on public.site_images_backup;
create policy site_images_backup_super on public.site_images_backup for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
insert into public.backup_secrets (key, value) values ('backup_download_password','MPCS@Backup#2026'),('backup_import_password','MPCS@Restore#2026') on conflict (key) do nothing;`}</pre>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* DOWNLOAD */}
        <div className="card p-6">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
            <Download size={19} className="text-indigo-700" /> Download Backup (.zip)
          </h3>
          <p className="text-slate-500 text-[12px] mt-1.5">
            සාමාජික දත්ත, settings, emails, ව්‍යාපාර තොරතුරු, පුවත්, gallery, සියලු images/photos (bot photo ඇතුළුව), ඉන්ධන මිල, live chat දත්ත සහ login passwords ඇතුළු මුලු site එකම එක් ZIP ගොනුවක් ලෙස බාගන්න (database.sql + schema.sql + registers).
          </p>
          <label className="field-label mt-4">Download Password</label>
          <div className="flex gap-2">
            <input type={showPw ? "text" : "password"} className="field" value={dlPw} onChange={(e) => setDlPw(e.target.value)} placeholder="Download password එක ඇතුළත් කරන්න" />
            <button className="btn btn-outline !px-3" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11.5px] text-slate-600">
            <input type="checkbox" className="mt-0.5" checked={encryptDl} onChange={(e) => setEncryptDl(e.target.checked)} />
            <span>🔒 database.sql එක මේ Download password එකෙන්ම <b>encrypt</b> කරන්න — ආරක්ෂාව වැඩියි (Import කරද්දී එම password එකම අවශ්‍යයි)</span>
          </label>
          <button className="btn btn-primary w-full mt-4 disabled:opacity-60" disabled={busy} onClick={downloadBackup}>
            <DatabaseBackup size={16} className="hidden" /><Download size={16} /> Generate &amp; Download Backup
          </button>
          <div className="mt-3 text-[11px] text-slate-400">
            Password එක හරි නම් පමණයි ගොනුව බාගැනේ. ZIP එකේ login passwords ඇති නිසා ගොනුව රහසිගතව තබා ගන්න. අලුත් Supabase එකකට යනවා නම් ZIP එකේ schema.sql → database.sql පිළිවෙළට run කරන්න (විස්තර README.txt එකේ).
          </div>
        </div>

        {/* IMPORT */}
        <div className="card p-6">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
            <UploadCloud size={19} className="text-emerald-700" /> Import Backup (Restore)
          </h3>
          <p className="text-slate-500 text-[12px] mt-1.5">
            Download කළ ZIP එකම (හෝ database.sql එක) තෝරන්න — මුලින්ම <b>Preview</b> එකක් පෙන්වනවා (tables/rows ගණන + manifest verify). තහවුරු කළාට පස්සේ විතරයි restore වෙන්නේ.
          </p>
          <label className="field-label mt-4">Import Password</label>
          <input type="password" className="field" value={imPw} onChange={(e) => setImPw(e.target.value)} placeholder="Import password එක ඇතුළත් කරන්න" />
          <label className="field-label mt-3">Encryption Password <span className="normal-case text-slate-400">(encrypted backup එකක් නම් විතරයි)</span></label>
          <input type="password" className="field" value={encPw} onChange={(e) => setEncPw(e.target.value)} placeholder="🔒 backup එක encrypt කළ password එක" />
          <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 cursor-pointer hover:border-emerald-400 mt-4">
            <input type="file" accept=".sql,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) prepareImport(f); }} />
            <span className="btn btn-outline !py-2 !px-4 !text-[12px]">Choose Backup File (.zip / .sql)</span>
            <span className="text-slate-500 text-[12.5px]">backup file එක තෝරන්න…</span>
          </label>
          <div className="mt-3 text-[11px] text-slate-400">
            ⚠ File එක තේරුවම යටින් Preview එකක් එනවා — එහිදී tables තෝරලා (partial restore ද පුළුවන්), RESTORE කියා ලියා තහවුරු කළ යුතුයි. Import එකට කලින් safety backup එකකුත් (විකල්පය) ඉබේම download වේ.
          </div>
        </div>
      </div>

      {/* IMPORT PREVIEW */}
      {preview && (
        <div className="card mt-6 border-l-4 border-emerald-500 p-6">
          <h3 className="text-lg font-extrabold text-slate-900">📋 Import Preview — {preview.fileName}</h3>
          <div className="mt-2 text-[12px] text-slate-600">{preview.manifestMsg}</div>
          <div className="mt-1 text-[12px] text-slate-500">
            Tables {preview.tables.length} · Rows {preview.totalRows}
            {preview.encrypted ? " · 🔒 Encrypted backup" : ""}
            {preview.manifest ? ` · Backup දිනය: ${preview.manifest.generatedAt?.slice(0, 10)}` : ""}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="btn btn-outline !px-3 !py-1 !text-[11px]" onClick={() => setSelected(Object.fromEntries(preview.tables.map((t) => [t.name, t.known])))}>
              සියල්ල තෝරන්න
            </button>
            <button className="btn btn-outline !px-3 !py-1 !text-[11px]" onClick={() => setSelected(Object.fromEntries(preview.tables.map((t) => [t.name, false])))}>
              සියල්ල අයින් කරන්න
            </button>
          </div>

          <div className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {preview.tables.map((t) => (
              <label key={t.name} className={`flex items-center gap-2.5 px-3 py-1.5 text-[12px] ${t.known ? "cursor-pointer hover:bg-slate-50" : "opacity-50"}`}>
                <input
                  type="checkbox"
                  disabled={!t.known}
                  checked={!!selected[t.name]}
                  onChange={(e) => setSelected((s) => ({ ...s, [t.name]: e.target.checked }))}
                />
                <span className="flex-1 font-mono text-slate-800">{t.name}</span>
                <span className="tabular-nums text-slate-500">{t.rows} rows</span>
                {!t.known && <span className="text-[10.5px] font-bold text-rose-500">නොදන්නා table — skip වේ</span>}
              </label>
            ))}
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2 text-[12px] text-slate-600">
            <input type="checkbox" className="mt-0.5" checked={safetyFirst} onChange={(e) => setSafetyFirst(e.target.checked)} />
            <span>🛡 <b>Import එකට කලින්</b> දැන් තියන site එකේ safety backup එකක් auto-download කරන්න <span className="font-bold text-emerald-600">(නිර්දේශිතයි)</span> — වැරදුණොත් ආපහු යන්න පුළුවන්</span>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input className="field !w-52 !py-2 !text-[12px]" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="තහවුරු කරන්න: RESTORE" />
            <button className="btn btn-primary !px-4 !py-2 !text-[12.5px] disabled:opacity-50" disabled={busy || confirmText !== "RESTORE"} onClick={confirmImport}>
              ✅ Restore කරන්න
            </button>
            <button className="btn btn-outline !px-4 !py-2 !text-[12.5px]" disabled={busy} onClick={() => setPreview(null)}>
              අවලංගු කරන්න
            </button>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">⚠ තෝරගත් tables වල දැන් තියන දත්ත සම්පූර්ණයෙන් replace වේ. Login ගිණුම් (auth.users) වලට මෙයින් බලපෑමක් නෑ.</div>
        </div>
      )}

      {/* PASSWORDS */}
      <div className="card p-6 mt-6">
        <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
          <KeyRound size={19} className="text-amber-600" /> Backup Passwords (superadmin පමණි)
        </h3>
        <div className="grid gap-5 sm:grid-cols-2 mt-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-[11px] font-bold text-slate-500">DOWNLOAD PASSWORD</div>
            <div className="text-[15px] font-extrabold text-slate-900 mt-1 tabular-nums">
              {secrets ? (showPw ? secrets.download : "••••••••••••") : "—"}
            </div>
            <div className="flex gap-2 mt-3">
              <input className="field !py-1.5 !text-[12px]" placeholder="අලුත් password" value={newDl} onChange={(e) => setNewDl(e.target.value)} />
              <button
                className="btn btn-primary !py-1.5 !px-3 !text-[12px]"
                onClick={async () => {
                  if (!newDl.trim()) return show("⚠ අලුත් password එකක් දෙන්න");
                  const err = await setBackupSecret("backup_download_password", newDl.trim());
                  if (err) return show(`⚠ ${err}`);
                  void logActivity("PASSWORD_CHANGE", "Backup DOWNLOAD password changed");
                  setSecrets((s) => (s ? { ...s, download: newDl.trim() } : s));
                  setNewDl("");
                  show("✅ Download password එක වෙනස් කළා");
                }}
              >
                <Save size={13} /> Change
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-[11px] font-bold text-slate-500">IMPORT PASSWORD</div>
            <div className="text-[15px] font-extrabold text-slate-900 mt-1 tabular-nums">
              {secrets ? (showPw ? secrets.importPw : "••••••••••••") : "—"}
            </div>
            <div className="flex gap-2 mt-3">
              <input className="field !py-1.5 !text-[12px]" placeholder="අලුත් password" value={newIm} onChange={(e) => setNewIm(e.target.value)} />
              <button
                className="btn btn-primary !py-1.5 !px-3 !text-[12px]"
                onClick={async () => {
                  if (!newIm.trim()) return show("⚠ අලුත් password එකක් දෙන්න");
                  const err = await setBackupSecret("backup_import_password", newIm.trim());
                  if (err) return show(`⚠ ${err}`);
                  void logActivity("PASSWORD_CHANGE", "Backup IMPORT password changed");
                  setSecrets((s) => (s ? { ...s, importPw: newIm.trim() } : s));
                  setNewIm("");
                  show("✅ Import password එක වෙනස් කළා");
                }}
              >
                <Save size={13} /> Change
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button className="btn btn-outline !py-1.5 !px-3 !text-[11.5px]" onClick={() => setShowPw(!showPw)}>
            {showPw ? <EyeOff size={13} /> : <Eye size={13} />} {showPw ? "සඟවන්න" : "passwords පෙන්වන්න"}
          </button>
          <span className="text-[11px] text-slate-400">මේ passwords දෙක පෙන්වන්නේ superadmin ගිණුමට පමණයි — ඕන නම් මෙතනින් වෙනස් කරන්න.</span>
        </div>
      </div>

      {/* EXTRA SAFETY — scheduled + cloud */}
      <div className="card p-6 mt-6">
        <h3 className="text-lg font-extrabold text-slate-900">🛡️ අමතර ආරක්ෂාව</h3>
        <div className="grid gap-4 sm:grid-cols-2 mt-3 text-[12px] text-slate-600">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-extrabold text-slate-800">📅 Scheduled auto-backup (උසස්)</div>
            <p className="mt-1">
              Repo එකේ <span className="font-mono">supabase/functions/scheduled-backup</span> එක deploy කළොත් සතියකට වරක් data-only backup එකක් ඉබේම{" "}
              <span className="font-mono">backups</span> bucket එකට වැටෙනවා. සක්‍රිය කරන පියවර backup ZIP එකේ <b>RECOVERY.txt</b> එකේ ඇත. (මේ පිටුවේ උඩ තියන මතක් කිරීමේ banner එක දැනටමත් ක්‍රියාත්මකයි.)
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-extrabold text-slate-800">☁️ Supabase Pro — දෛනික backups</div>
            <p className="mt-1">
              Pro plan එක ($25/මාසෙට) ගත්තා නම් Supabase එකෙන්ම හැමදාම auto-backup + point-in-time recovery ලැබෙනවා. මේ ZIP backup එකට අමතර දෙවෙනි ආරක්ෂාවක් විදිහට නිර්දේශ කරනවා — supabase.com → Project → Settings → Billing එකෙන් upgrade කළ හැක.
            </p>
          </div>
        </div>
      </div>

      {/* animated overlay */}
      {anim && (
        <div className="fixed inset-0 z-[100] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-8 w-[340px] text-center shadow-2xl">
            {!anim.done ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <div className="mt-4 font-extrabold text-slate-900 text-[14px]">{anim.msg}</div>
                <div className="mt-3 h-2 rounded-full bg-indigo-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-300" style={{ width: `${anim.pct}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-slate-500 tabular-nums">{anim.pct}%</div>
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <div className="mt-4 font-extrabold text-emerald-700 text-[14px]">{anim.msg}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
