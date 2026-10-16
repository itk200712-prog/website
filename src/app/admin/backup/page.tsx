"use client";

// ============================================================================
// Backup & Restore — SUPERADMIN ONLY
// Download = full-site .sql (password gated) · Import = full restore (password gated)
// Two separate passwords, visible + changeable by superadmin only
// ============================================================================

import { useEffect, useState } from "react";
import {
  DatabaseBackup, Download, Eye, EyeOff, KeyRound, ShieldCheck, UploadCloud, Save,
} from "lucide-react";
import { AdminTopbar, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import {
  generateBackupSql, getBackupSecrets, parseBackupSql, restoreBackup, setBackupSecret,
} from "@/lib/backup";

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
      }
    })();
  }, []);

  async function downloadBackup() {
    if (!secrets) return show("⚠ backup_secrets table එක නෑ — පහත SQL block එක run කරන්න");
    if (dlPw !== secrets.download) return show("⚠ Download password එක වැරදියි ❌");
    setBusy(true);
    setAnim({ pct: 0, msg: "Preparing backup…", done: false });
    try {
      const sql = await generateBackupSql((msg, pct) => setAnim({ pct, msg, done: false }));
      const blob = new Blob([sql], { type: "application/sql" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mpcs-backup-${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      URL.revokeObjectURL(a.href);
      setAnim({ pct: 100, msg: "Backup downloaded ✅", done: true });
      setTimeout(() => setAnim(null), 1800);
    } catch (e) {
      setAnim(null);
      show(`⚠ ${(e as Error).message}`);
    }
    setBusy(false);
  }

  async function importBackup(file: File) {
    if (!secrets) return show("⚠ backup_secrets table එක නෑ — පහත SQL block එක run කරන්න");
    if (imPw !== secrets.importPw) return show("⚠ Import password එක වැරදියි ❌");
    if (!file.name.endsWith(".sql")) return show("⚠ .sql backup file එකක් තෝරන්න");
    if (!confirm("⚠ Import එක දැන් තියෙන දත්ත සම්පූර්ණයෙන් replace කරයි. ඉදිරියට යන්නද?")) return;
    setBusy(true);
    setAnim({ pct: 0, msg: "Reading backup file…", done: false });
    try {
      const sql = await file.text();
      const inserts = parseBackupSql(sql);
      if (!inserts.length) throw new Error("backup file එකේ INSERT rows නෑ");
      const { restored, errors } = await restoreBackup(inserts, (msg, pct) => setAnim({ pct, msg, done: false }));
      const total = Object.values(restored).reduce((a, b) => a + b, 0);
      setAnim({ pct: 100, msg: `Restored ${total} rows ✅`, done: true });
      setTimeout(() => setAnim(null), 2200);
      show(errors.length ? `⚠ Restored with ${errors.length} issue(s): ${errors[0]}` : `✅ සියල්ල restore කළා — ${Object.keys(restored).length} tables, ${total} rows`);
    } catch (e) {
      setAnim(null);
      show(`⚠ ${(e as Error).message}`);
    }
    setBusy(false);
  }

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
      <AdminTopbar title="Backup & Restore" sub="Download the complete site as SQL (members, settings, images, passwords) or restore from a backup file" />
      {node}

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
            <Download size={19} className="text-indigo-700" /> Download Backup (.sql)
          </h3>
          <p className="text-slate-500 text-[12px] mt-1.5">
            සියලුම සාමාජික දත්ත, settings, images/photos, passwords ඇතුළු සියල්ල එක් SQL ගොනුවක් ලෙස බාගන්න.
          </p>
          <label className="field-label mt-4">Download Password</label>
          <div className="flex gap-2">
            <input type={showPw ? "text" : "password"} className="field" value={dlPw} onChange={(e) => setDlPw(e.target.value)} placeholder="Download password එක ඇතුළත් කරන්න" />
            <button className="btn btn-outline !px-3" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          <button className="btn btn-primary w-full mt-4 disabled:opacity-60" disabled={busy} onClick={downloadBackup}>
            <DatabaseBackup size={16} className="hidden" /><Download size={16} /> Generate &amp; Download Backup
          </button>
          <div className="mt-3 text-[11px] text-slate-400">
            Password එක හරි නම් පමණයි ගොනුව බාගැනේ. Server එක down වුණොත් මේ ගොනුව SQL Editor එකෙන් restore කර හෝ Import එකෙන් නැවත ලබාගත හැක.
          </div>
        </div>

        {/* IMPORT */}
        <div className="card p-6">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
            <UploadCloud size={19} className="text-emerald-700" /> Import Backup (Restore)
          </h3>
          <p className="text-slate-500 text-[12px] mt-1.5">
            Backup .sql ගොනුව තෝරන්න — සියලු දත්ත, images සහ settings නැවත පූර්ණ ලෙස restore වේ (දැන් ඇති දත්ත replace වේ).
          </p>
          <label className="field-label mt-4">Import Password</label>
          <input type="password" className="field" value={imPw} onChange={(e) => setImPw(e.target.value)} placeholder="Import password එක ඇතුළත් කරන්න" />
          <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 cursor-pointer hover:border-emerald-400 mt-4">
            <input type="file" accept=".sql" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); }} />
            <span className="btn btn-outline !py-2 !px-4 !text-[12px]">Choose .sql File</span>
            <span className="text-slate-500 text-[12.5px]">backup file එක තෝරන්න…</span>
          </label>
          <div className="mt-3 text-[11px] text-slate-400">
            ⚠ Import password එක හරි නම් පමණයි restore එක පටන් ගනී. රූප ඇතුළු සියල්ල නැවත storage එකටත් උඩුගත වේ.
          </div>
        </div>
      </div>

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
