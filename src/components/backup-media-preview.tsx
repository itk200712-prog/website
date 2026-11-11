"use client";
import { useEffect, useMemo, useState } from "react";
import { safeMediaPath } from "@/lib/backup-media";
import { capturedMediaType, type CapturedMedia, type MediaAudit } from "@/lib/backup-media-audit";
const PAGE_SIZE = 24;
function bytes(file: CapturedMedia) {
  const decoded = atob(file.b64), out = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i);
  return out;
}
export function BackupMediaPreview({ media, audit }: { media: CapturedMedia[]; audit: MediaAudit }) {
  const images = useMemo(() => media.map(f => ({ ...f, type: capturedMediaType(f) })).filter((f) => f.b64.length > 0 && /^image\//i.test(f.type)), [media]);
  const [page, setPage] = useState(0);
  const [thumbs, setThumbs] = useState<{ path: string; url: string }[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPage(0); }, [media]);
  useEffect(() => {
    const list = images.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((f) => ({ path: f.path, url: URL.createObjectURL(new Blob([bytes(f)], { type: f.type })) }));
    setThumbs(list);
    return () => list.forEach((f) => URL.revokeObjectURL(f.url));
  }, [images, page]);
  async function download() {
    setBusy(true); setMessage("");
    try {
      const Zip = (await import("jszip")).default;
      const zip = new Zip();
      for (const image of images) {
        if (!safeMediaPath(image.path)) throw new Error("Unsafe archive image path");
        zip.file(image.path, bytes(image), { compression: "STORE" });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "verified-backup-images-DECRYPTED.zip"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMessage("Images ZIP download කළා. මෙය decrypted copy එකක් — රහසිගතව තබන්න.");
    } catch (e) { setMessage(`⚠ ${(e as Error).message}`); }
    setBusy(false);
  }
  return <section className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
    <h4 className="font-extrabold text-indigo-950">🖼 Backup තුළ තිබෙන සැබෑ images — {images.length}</h4>
    <p className="mt-1 text-xs text-slate-600">මෙම previews backup bytes වලින් පමණයි; live image URLs වලින් නොවේ. Restore කිරීමට අවශ්‍ය නැහැ. Encrypted SQL එකත් password එකෙන් විවෘත කර මෙතැන බැලිය හැක.</p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {audit.groups.map((g) => <span key={g.category} className={`rounded-lg border px-2 py-1 ${g.missing ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        {g.category === "board" ? "Board" : g.category === "bot" ? "Live Chat bot" : g.category === "templates" ? "Templates / Animation" : "Other"}: {g.captured}/{g.references} references {g.missing ? `· missing ${g.missing}` : "✓"}
      </span>)}
    </div>
    {!audit.verified && <p className="mt-2 text-xs font-bold text-rose-700">⚠ මෙම backup එකේ referenced media අඩුයි. සම්පූර්ණ restore එකක් ලෙස තහවුරු කළ නොහැක; අලුත් backup එකක් ගන්න.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-outline !px-3 !py-2 !text-xs" onClick={download} disabled={!images.length || busy}>{busy ? "Preparing…" : "Images පමණක් ZIP ලෙස download"}</button>
      <button type="button" className="btn btn-outline !px-2 !py-1 !text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>←</button>
      <span className="text-xs">{images.length ? page + 1 : 0} / {Math.ceil(images.length / PAGE_SIZE)}</span>
      <button type="button" className="btn btn-outline !px-2 !py-1 !text-xs" disabled={(page + 1) * PAGE_SIZE >= images.length} onClick={() => setPage((p) => p + 1)}>→</button>
    </div>
    {message && <p className="mt-2 text-xs">{message}</p>}
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{thumbs.map((f) => <figure key={f.path} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={f.url} alt="Image from selected backup" loading="lazy" className="h-28 w-full rounded-lg object-contain" />
      <figcaption className="mt-1 break-all text-[10px] text-slate-600">{f.path}</figcaption>
    </figure>)}</div>
  </section>;
}
