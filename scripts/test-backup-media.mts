import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://backup-source.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon';
const { generateBackupSql, generateBackupZip, restoreBackup, verifyRestore, BACKUP_TABLES } = await import('../src/lib/backup');
const { parseBackupSql, readBackupTableCounts, decryptBackupText, sha256Hex } = await import('../src/lib/backup-utils');
const { scanMediaReferences, rewriteMediaValue, storageMediaRef, listStoragePaths, MEDIA_INDEX_PATH } = await import('../src/lib/backup-media');
const { publicMediaAddress, readRemoteMedia, validRemoteMediaUrl } = await import('../src/lib/backup-media-server');
const { NextRequest } = await import('next/server');
const { POST: mediaPost } = await import('../src/app/api/backup/media/route');
const { PUBLIC_ASSET_FILES } = await import('../src/lib/public-assets.generated');
let passed = 0;
const pass = (name: string) => { passed++; console.log(`PASS ${name}`); };
type Row = Record<string, any>;
const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 255]);
const encodedKey = 'board/අධ්‍යක්ෂ X #1.png';
const encodedUrl = 'https://backup-source.invalid/storage/v1/object/public/site-images/' + encodedKey.split('/').map(encodeURIComponent).join('/');
const externalUrl = 'https://photos.example/director-avatar';
const signedUrl = 'https://backup-source.invalid/storage/v1/object/sign/site-images/board/signed.png?token=not-a-real-token';
const relativeUrl = '/storage/v1/object/authenticated/site-images/board/signed.png';
const fakeSource = 'export const snapshot = "fixture only";';
let httpFailure = '', schemaFailure = false, snapshotFailure = false, mockRole = 'member';
const originalFetch = globalThis.fetch;
// Isolated fixtures: any unexpected network call fails the test.
globalThis.fetch = (async (url: any, init?: RequestInit) => {
  const u = new URL(String(url), 'https://fixture-site.invalid');
  assert(['fixture-site.invalid', 'backup-source.invalid'].includes(u.hostname), `Unexpected HTTP request ${u.hostname}`);
  if (u.pathname === '/rest/v1/') return Response.json({ definitions: {} });
  if (u.pathname === '/api/backup/schema') return schemaFailure ? new Response('denied', { status: 403 }) : new Response(readFileSync('supabase/schema.sql', 'utf8'));
  if (u.pathname === '/api/backup/site-source') return Response.json({ version: 'fixture', files: snapshotFailure ? [] : [{ path: 'src/fixture.ts', content: fakeSource }] });
  if (u.pathname === '/auth/v1/user') return Response.json({ id: '12345678-1234-1234-1234-123456789abc' });
  if (u.pathname === '/rest/v1/profiles') return Response.json([{ role: mockRole }]);
  assert(PUBLIC_ASSET_FILES.includes(decodeURIComponent(u.pathname.slice(1))), `Unexpected fixture asset ${u.pathname}`);
  if (u.pathname === httpFailure) return new Response('not found', { status: 404 });
  return new Response(imageBytes, { headers: { 'Content-Type': 'image/png' } });
}) as typeof fetch;

class FakeDB {
  tables = new Map<string, Row[]>(BACKUP_TABLES.map((t: any) => [t.name, []]));
  files = new Map<string, { bytes: Uint8Array; type: string }>();
  downloads: string[] = [];
  uploads: string[] = [];
  deletes: string[] = [];
  failTable = ''; failList = false; failDownload = ''; failUpload = ''; failWrite = ''; truncateTable = '';
  auth = { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) };
  constructor(readonly origin: string) {}
  from = (table: string) => {
    const db = this;
    let mode = 'select', payload: Row[] = [], pk = 'id', from = 0, end = Infinity, head = false;
    const filters: [string, unknown][] = [];
    let countRequested = false;
    const query: any = {
      select: (_cols: string, options?: any) => { head = !!options?.head; countRequested = options?.count === 'exact'; return query; },
      order: () => query,
      range: (a: number, b: number) => { from = a; end = b; return query; },
      limit: (n: number) => { end = n - 1; return query; },
      eq: (k: string, v: unknown) => { filters.push([k, v]); return query; },
      not: () => query,
      in: () => query,
      delete: () => { mode = 'delete'; return query; },
      upsert: (rows: Row[] | Row, options: any = {}) => { mode = 'upsert'; payload = Array.isArray(rows) ? rows : [rows]; pk = options.onConflict ?? 'id'; return query; },
      then: (resolve: any, reject: any) => Promise.resolve().then(() => {
        if (table === db.failTable || (mode === 'upsert' && table === db.failWrite)) return { data: null, count: null, error: { message: 'fixture permission denied' } };
        let rows = db.tables.get(table) ?? [];
        if (mode === 'delete') { db.deletes.push(table); db.tables.set(table, []); return { error: null, data: [] }; }
        if (mode === 'upsert') {
          if (table === 'gallery_comments' && payload.some((row) => row.parent_id != null && !rows.some((r) => r.id === row.parent_id) && !payload.some((r) => r.id === row.parent_id))) return { error: { message: 'foreign key parent missing' } };
          rows = [...rows];
          for (const row of payload) {
            const index = rows.findIndex((r) => r[pk] === row[pk]);
            if (index < 0) rows.push(structuredClone(row)); else rows[index] = structuredClone(row);
          }
          db.tables.set(table, rows); return { data: [], error: null };
        }
        rows = rows.filter((r) => filters.every(([k, v]) => r[k] === v));
        const total = rows.length;
        const sliced = rows.slice(from, Math.min(end + 1, table === db.truncateTable ? from + 999 : Infinity));
        return { data: head ? null : structuredClone(sliced), count: countRequested ? total : null, error: null };
      }).then(resolve, reject),
    };
    return query;
  };
  storage = { from: (bucket: string) => ({
    list: async (prefix: string, options: any) => {
      if (this.failList) return { data: null, error: { message: 'listing denied' } };
      const children = new Map<string, any>();
      for (const path of this.files.keys()) {
        if (!path.startsWith(`${bucket}/`)) continue;
        const key = path.slice(bucket.length + 1);
        if (prefix && !key.startsWith(prefix + '/')) continue;
        const rest = key.slice(prefix ? prefix.length + 1 : 0), name = rest.split('/')[0];
        children.set(name, { name, id: rest.includes('/') ? null : 'file-' + name, metadata: rest.includes('/') ? null : { size: 12 } });
      }
      return { data: [...children.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(options.offset, options.offset + options.limit), error: null };
    },
    download: async (key: string) => {
      const path = `${bucket}/${key}`; this.downloads.push(path);
      const file = this.files.get(path);
      return file && key !== this.failDownload ? { data: new Blob([file.bytes as any], { type: file.type }), error: null } : { data: null, error: { message: 'download denied' } };
    },
    upload: async (key: string, blob: Blob) => {
      const path = `${bucket}/${key}`; this.uploads.push(path);
      if (key === this.failUpload) return { error: { message: 'upload denied' } };
      this.files.set(path, { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type }); return { error: null };
    },
    getPublicUrl: (key: string) => ({ data: { publicUrl: `${this.origin}/storage/v1/object/public/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}` } }),
    createSignedUrl: async (key: string) => ({ data: { signedUrl: `${this.origin}/storage/v1/object/sign/${bucket}/${key}?token=fixture-new` }, error: null }),
  }) };
}
const progress = () => {};
const source = new FakeDB('https://backup-source.invalid');
const seedFile = (key: string, bytes = imageBytes, bucket = 'site-images') => source.files.set(`${bucket}/${key}`, { bytes, type: 'image/png' });
seedFile(encodedKey); seedFile('empty.bin', new Uint8Array()); seedFile('board/signed.png'); seedFile('a/b/c/d/e/f/g/h/deep.png'); seedFile('private.pdf', new Uint8Array([37, 80, 68, 70, 45]), 'private-docs');
source.tables.set('board_members', [
  { id: 'board-1', name_si: 'මධුරංග', name_en: 'Maduranga', email: 'director@example.com', photo: encodedUrl },
  { id: 'board-2', name_si: 'අධ්‍යක්ෂ', name_en: 'Director Two', email: 'second@example.com', photo: externalUrl },
]);
source.tables.set('system_settings', [{ key: 'hero_images', value: JSON.stringify([{ url: signedUrl }, { photo: relativeUrl }]) }]);
source.tables.set('membership_applications', [{ id: 'app-1', document: 'https://backup-source.invalid/storage/v1/object/sign/private-docs/private.pdf?token=old' }]);
source.tables.set('site_images_backup', [{ path: encodedKey, data_base64: btoa('STALE-CACHE-IMAGE'), content_type: 'image/png' }]);
source.tables.set('member_rows', Array.from({ length: 52_013 }, (_, i) => ({ id: i + 1, member_no: String(i + 1), full_name: 'Maduranga', nic: '123456789V', address: 'Negombo', postal_address: 'Negombo', gender: 'M', file_name: 'Register.xlsx' })));
const remoteReads: string[] = [];
const reader = async (url: string) => { remoteReads.push(url); assert.equal(url, externalUrl); return { b64: btoa('EXTERNAL-BOARD-PHOTO'), type: 'image/png' }; };

try {
  const nested = scanMediaReferences({ value: JSON.stringify({ images: [encodedUrl, signedUrl, relativeUrl] }) });
  assert.equal(nested.length, 3); assert.equal(nested[0].key, encodedKey); pass('Encoded Unicode/space/hash, signed, authenticated-relative, nested JSON discovery');
  assert.equal(storageMediaRef('/storage/v1/render/image/public/site-images/board/signed.png?width=128')?.key, 'board/signed.png'); pass('Transformed Supabase image URLs resolve original object bytes');
  assert.equal(scanMediaReferences({ facebook_url: 'https://facebook.com/director', photo: externalUrl }).length, 1); pass('External photo field is captured without treating ordinary website links as files');
  assert.throws(() => scanMediaReferences({ photo: 'blob:old-upload' }), /Unpersisted/); pass('Unpersisted blob photos cannot silently produce a complete backup');
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.100.100.200', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(publicMediaAddress(ip), false, ip);
  assert(publicMediaAddress('8.8.8.8')); assert(publicMediaAddress('2606:4700:4700::1111')); pass('SSRF guard blocks private/reserved/mapped/transition IPs and permits public IPs');
  for (const url of ['file:///etc/passwd', 'http://user:pass@example.com/a', 'http://example.com:2375/a']) assert.throws(() => validRemoteMediaUrl(url));
  await assert.rejects(readRemoteMedia('http://127.0.0.1/private'), /Private/); pass('Protocol/credential/port/local-address checks happen before socket requests');
  const denied = await mediaPost(new NextRequest('https://fixture-site.invalid/api/backup/media', { method: 'POST', body: JSON.stringify({ url: externalUrl }) }));
  assert.equal(denied.status, 401); pass('Unauthenticated users cannot use the external-media proxy');
  // Source URL role fixture is a member, so the proxy must reject it as well.
  const memberDenied = await mediaPost(new NextRequest('https://fixture-site.invalid/api/backup/media', { method: 'POST', headers: { Authorization: 'Bearer member-fixture' }, body: JSON.stringify({ url: externalUrl }) }));
  assert.equal(memberDenied.status, 403); pass('Ordinary members cannot fetch media through the superadmin backup proxy');
  mockRole = 'admin';
  assert.equal((await mediaPost(new NextRequest('https://fixture-site.invalid/api/backup/media', { method: 'POST', headers: { Authorization: 'Bearer admin-fixture' }, body: JSON.stringify({ url: externalUrl }) }))).status, 403);
  pass('Non-superadmin admins cannot use the media proxy');
  mockRole = 'superadmin';
  const blockedRoot = await mediaPost(new NextRequest('https://fixture-site.invalid/api/backup/media', { method: 'POST', headers: { Authorization: 'Bearer superadmin-fixture' }, body: JSON.stringify({ url: 'http://127.0.0.1/private' }) }));
  assert.equal(blockedRoot.status, 422); assert.match((await blockedRoot.json()).error, /Private/);
  pass('Even an authenticated superadmin cannot use the media proxy for SSRF');
  const large = await listStoragePaths(async (prefix, offset) => prefix ? [] : Array.from({ length: Math.max(0, Math.min(100, 10_123 - offset)) }, (_, i) => ({ name: `image-${offset + i}`, id: 'file' })));
  assert.equal(large.length, 10_123); pass('Storage paginator captures beyond the old 5,000/10,000 limits');
  await assert.rejects(listStoragePaths(async () => Array.from({ length: 100 }, (_, i) => ({ name: `file-${i}`, id: 'file' }))), /pagination repeated/);
  pass('A server ignoring storage offsets fails instead of looping or duplicating files');
  await assert.rejects(listStoragePaths(async () => { throw new Error('storage down'); }), /storage down/); pass('Storage listing errors are not reported as zero files');

  const generated = await generateBackupSql(progress, source as any, 'https://fixture-site.invalid', { readMedia: reader });
  assert.equal(generated.tableCounts.member_rows, 52_013); assert.equal(generated.registerRows.members.length, 52_013); pass('All 52,013 register rows survive stable paginated export');
  const inserts = parseBackupSql(generated.sql);
  const imageInserts = inserts.filter((r: any) => r.table === 'site_images_backup');
  const photoRows = imageInserts.filter((r: any) => r.values[r.cols.indexOf('path')] === encodedKey);
  assert.equal(photoRows.length, 1); assert.equal(photoRows[0].values[photoRows[0].cols.indexOf('data_base64')], Buffer.from(imageBytes).toString('base64'));
  assert(!generated.sql.includes(btoa('STALE-CACHE-IMAGE'))); pass('Board photo bytes are captured once; stale restored cache never overwrites live image bytes');
  assert(generated.mediaRows.some((r: any) => r.path === 'a/b/c/d/e/f/g/h/deep.png')); pass('Nested storage objects deeper than six levels are included');
  assert.deepEqual(remoteReads, [externalUrl]); assert(generated.mediaRows.some((r: any) => atob(r.b64) === 'EXTERNAL-BOARD-PHOTO')); pass('External Board photo binary is embedded in SQL and mapped, not merely its URL');
  assert.equal(generated.siteAssets.length, PUBLIC_ASSET_FILES.length); pass('Every generated public asset is downloaded');
  const counts = readBackupTableCounts(generated.sql);
  assert.equal(counts.gallery_items, 0); assert.equal(counts.news, 0); assert.equal(counts.site_images_backup, imageInserts.length); pass('SQL snapshot preserves zero-row table metadata and exact media-cache row count');

  const target = new FakeDB('https://backup-target.invalid');
  target.tables.set('gallery_items', [{ id: 'stale-gallery', image: 'old.jpg' }]); target.tables.set('news', [{ id: 'stale-news' }]);
  const restored = await restoreBackup(inserts, progress, { client: target as any, tableCounts: counts });
  assert.deepEqual(restored.errors, []);
  assert.equal(target.files.get('site-images/empty.bin')?.bytes.length, 0);
  pass('Zero-byte stored files survive binary round trip without being silently dropped');
  assert.deepEqual(target.files.get(`site-images/${encodedKey}`)?.bytes, imageBytes); pass('Real engine round trip restores exact Board photo bytes to the target project');
  assert(target.tables.get('board_members')![0].photo.startsWith('https://backup-target.invalid/')); assert(target.tables.get('board_members')![1].photo.includes('/referenced-media/'));
  const hero = JSON.parse(target.tables.get('system_settings')!.find((r) => r.key === 'hero_images')!.value);
  assert(hero.every((r: any) => (r.url ?? r.photo).startsWith('https://backup-target.invalid/'))); pass('Board external URLs and every signed/relative nested settings URL are rewritten across projects');
  assert.equal(target.tables.get('gallery_items')!.length, 0); assert.equal(target.tables.get('news')!.length, 0); pass('Empty tables wipe stale gallery/news rows: deleted content stays deleted');
  assert(!target.uploads.some((p) => p.endsWith(MEDIA_INDEX_PATH))); pass('Media metadata containing old signed tokens is never published to public storage');
  assert(target.files.has('private-docs/private.pdf')); assert(!target.files.has('site-images/site-buckets/private-docs/private.pdf'));
  assert(target.tables.get('membership_applications')![0].document.includes('/object/sign/private-docs/')); pass('Referenced private documents stay in their original bucket; restore does not make them public');
  const verified = await verifyRestore({ member_rows: 52_013, gallery_items: 0 }, target as any);
  assert(verified.every((r: any) => r.ok));
  target.tables.set('member_rows', [{ id: 1 }]); assert.equal((await verifyRestore({ member_rows: 52_013 }, target as any))[0].ok, false); pass('Restore count verification rejects one row when 52,013 were expected');

  const aliases = new Map([[externalUrl, 'ext.png']]);
  const rewritten: any = rewriteMediaValue({ photos: [encodedUrl, encodedUrl.replace('backup-source', 'another-source')], nested: JSON.stringify({ photo: externalUrl }) }, new Map([[encodedKey, 'https://new.example/board.png'], ['ext.png', 'https://new.example/ext.png']]), aliases);
  assert.deepEqual(rewritten.photos, ['https://new.example/board.png', 'https://new.example/board.png']); assert.equal(JSON.parse(rewritten.nested).photo, 'https://new.example/ext.png'); pass('Two old origins sharing a key BOTH rewrite; no single-old-URL Map loss');
  const partial = new FakeDB('https://partial-target.invalid');
  await restoreBackup(inserts, progress, { client: partial as any, onlyTables: ['board_members'], tableCounts: counts });
  assert(partial.files.has(`site-images/${encodedKey}`)); assert.deepEqual(partial.deletes, ['board_members']); pass('Partial Board restore automatically restores required photos without deleting other tables');
  const uploadFailed = new FakeDB('https://failed-target.invalid'); uploadFailed.failUpload = encodedKey;
  await assert.rejects(restoreBackup(inserts, progress, { client: uploadFailed as any, tableCounts: counts }), /before database deletion/);
  assert.equal(uploadFailed.deletes.length, 0); pass('Failed photo uploads abort restore before any database wipe');
  const missingTarget = new FakeDB('https://missing-target.invalid');
  const withoutPhoto = inserts.filter((r: any) => !(r.table === 'site_images_backup' && r.values[r.cols.indexOf('path')] === encodedKey));
  await assert.rejects(restoreBackup(withoutPhoto, progress, { client: missingTarget as any, onlyTables: ['board_members'] }), /missing from backup/);
  assert.equal(missingTarget.deletes.length, 0); pass('Old/incomplete backups cannot report a successful Board restore with missing photos');
  const comments = Array.from({ length: 220 }, (_, i) => ({ table: 'gallery_comments', cols: ['id', 'parent_id', 'text'], values: [`a-child-${i}`, 'z-parent', 'Reply'] }));
  comments.push({ table: 'gallery_comments', cols: ['id', 'parent_id', 'text'], values: ['z-parent', null as any, 'Parent'] });
  const commentDB = new FakeDB('https://comments-target.invalid');
  await restoreBackup(comments, progress, { client: commentDB as any, onlyTables: ['gallery_comments'] });
  assert.equal(commentDB.tables.get('gallery_comments')!.length, 221);
  pass('Gallery replies whose parent sorts after the first 200 rows restore in dependency order');
  const orphanDB = new FakeDB('https://orphan-target.invalid');
  await assert.rejects(restoreBackup(comments.slice(0, 1), progress, { client: orphanDB as any, onlyTables: ['gallery_comments'] }), /missing parent/);
  assert.equal(orphanDB.deletes.length, 0); pass('Missing reply parents are caught before any restore wipe');
  const invalid = new FakeDB('https://invalid-target.invalid');
  await assert.rejects(restoreBackup([{ table: 'site_images_backup', cols: ['path', 'data_base64'], values: ['../bad.png', 'abcd'] }], progress, { client: invalid as any }), /Invalid/);
  assert.equal(invalid.uploads.length, 0); pass('Unsafe backup file paths fail before storage writes');

  source.failTable = 'board_members'; await assert.rejects(generateBackupSql(progress, source as any, 'https://fixture-site.invalid'), /incomplete tables/); source.failTable = ''; pass('Unreadable DB tables abort full export instead of silently generating partial SQL');
  source.failList = true; await assert.rejects(generateBackupSql(progress, source as any, 'https://fixture-site.invalid'), /listing failed/); source.failList = false; pass('Storage permissions/listing failure aborts full export');
  source.failDownload = encodedKey; await assert.rejects(generateBackupSql(progress, source as any, 'https://fixture-site.invalid', { readMedia: reader }), /media .*download denied/); source.failDownload = ''; pass('Photo download failure aborts export; never silently skips or substitutes stale cached photos');
  source.truncateTable = 'member_rows'; await assert.rejects(generateBackupSql(progress, source as any, 'https://fixture-site.invalid'), /pagination was truncated/); source.truncateTable = ''; pass('Server page-size truncation is detected by exact row count');
  // Smaller rows for ZIP/XLSX fixture tests; no real Excel uploads occur.
  source.tables.set('member_rows', source.tables.get('member_rows')!.slice(0, 2));
  const zipOptions = { client: source as any, assetBaseUrl: 'https://fixture-site.invalid', cronSecret: 'dummy-cron', readMedia: reader };
  const zip = await JSZip.loadAsync(await (await generateBackupZip(progress, zipOptions)).arrayBuffer());
  assert.deepEqual(await zip.file(`media/${encodedKey}`)!.async('uint8array'), imageBytes);
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
  for (const [path, info] of Object.entries(manifest.files) as [string, any][]) assert.equal(await sha256Hex(await zip.file(path)!.async('uint8array')), info.sha256);
  assert(zip.file('schema.sql')); assert(zip.file('Members-Register.xlsx')); assert(zip.file('Voters-Register.csv')); assert(zip.file('site-source/src/fixture.ts'));
  pass('Full ZIP contains visible media/board binary, schema, source, registers, and valid hashes for EVERY file');
  const encryptedZip = await JSZip.loadAsync(await (await generateBackupZip(progress, { ...zipOptions, encryptPassword: 'fixture-password' })).arrayBuffer());
  assert.equal(Object.keys(encryptedZip.files).filter((p) => p.startsWith('media/')).length, 0);
  const plain = await decryptBackupText(await encryptedZip.file('database.sql')!.async('string'), 'fixture-password');
  assert(plain.includes(Buffer.from(imageBytes).toString('base64'))); assert(plain.includes(btoa('EXTERNAL-BOARD-PHOTO'))); pass('Encrypted SQL retains media bytes, with NO unencrypted uploaded-media copies in ZIP');
  httpFailure = '/' + PUBLIC_ASSET_FILES[0]; await assert.rejects(generateBackupZip(progress, zipOptions), /Public asset download failed/); httpFailure = ''; pass('Missing public assets fail full ZIP export visibly');
  schemaFailure = true; await assert.rejects(generateBackupZip(progress, zipOptions), /schema.sql/); schemaFailure = false; pass('Missing canonical schema fails full ZIP export visibly');
  snapshotFailure = true; await assert.rejects(generateBackupZip(progress, zipOptions), /source snapshot/); snapshotFailure = false; pass('Empty/unavailable source snapshot fails full ZIP export visibly');
  const failRows = new FakeDB('https://row-failure.invalid'); failRows.failWrite = 'board_members';
  await assert.rejects(restoreBackup(inserts, progress, { client: failRows as any, onlyTables: ['board_members'] }), /not transactional/); pass('Failed table inserts return a failed restore, not a successful row count');
} finally { globalThis.fetch = originalFetch; }
// Build-time future table discovery is tested in an isolated mini-project.
const catalogFixture = mkdtempSync(join(tmpdir(), 'backup-catalog-'));
try {
  for (const dir of ['scripts', 'supabase', 'src/lib', 'public']) mkdirSync(join(catalogFixture, dir), { recursive: true });
  writeFileSync(join(catalogFixture, 'scripts/gen-site-source.mjs'), readFileSync('scripts/gen-site-source.mjs'));
  const schema = 'create table public.future_photos (\n  id uuid primary key,\n  photo text\n);\n';
  writeFileSync(join(catalogFixture, 'supabase/schema.sql'), schema);
  const generated = spawnSync(process.execPath, [join(catalogFixture, 'scripts/gen-site-source.mjs')], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  assert(readFileSync(join(catalogFixture, 'src/lib/backup-catalog.generated.ts'), 'utf8').includes('future_photos'));
  pass('Future canonical tables automatically enter the generated export/import catalog');
  writeFileSync(join(catalogFixture, 'supabase/schema.sql'), 'create table public.future_child (\n  id uuid primary key,\n  parent_id uuid references public.future_parent(id)\n);\ncreate table public.future_parent (\n  id uuid primary key\n);\n');
  const dependencyBuild = spawnSync(process.execPath, [join(catalogFixture, 'scripts/gen-site-source.mjs')], { encoding: 'utf8' });
  assert.equal(dependencyBuild.status, 0, dependencyBuild.stderr);
  const ordered = readFileSync(join(catalogFixture, 'src/lib/backup-catalog.generated.ts'), 'utf8');
  assert(ordered.indexOf('future_parent') < ordered.indexOf('future_child'));
  pass('Future foreign-key dependencies determine safe parent-before-child import order');
  writeFileSync(join(catalogFixture, 'supabase/schema.sql'), 'create table public.composite (\n  a text,\n  b text,\n  primary key (a,b)\n);\n');
  const failed = spawnSync(process.execPath, [join(catalogFixture, 'scripts/gen-site-source.mjs')], { encoding: 'utf8' });
  assert.notEqual(failed.status, 0); assert.match(failed.stderr, /single-column primary key/);
  pass('Unsupported future schema keys stop the build instead of silently losing tables');
} finally { rmSync(catalogFixture, { recursive: true, force: true }); }
console.log(`\n${passed} backup/media behavioral tests passed (fixtures only; no live site writes).`);
