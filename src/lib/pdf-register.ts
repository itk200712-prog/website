// ============================================================================
// Professional register PDF generator — shared by admin data + members/voters
// Letterhead (Sinhala + English), reg no, phone, date, file/total bar,
// bilingual headers, ALL rows across ALL pages.
//
// ✅ SEARCHABLE PDF: පිටුවේ පෙනුම html2canvas image එකකින් තිබුණත්, ඊට උඩින්
//    නොපෙනෙන (invisible) ඇත්ත Unicode text layer එකක් දානවා. ඒ නිසා PDF reader
//    එකකින් NIC / සාමාජික අංකය / නම / ලිපිනය search කළාම results පේනවා.
// ============================================================================

export type RegisterRow = {
  member_no?: string;
  voter_no?: string;
  nic?: string;
  full_name?: string;
  address?: string;
  postal_address?: string;
  gender?: string;
  file_name?: string;
};

const SI_MONTHS = ["ජන", "පෙබ", "මාර්", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝ", "සැප්", "ඔක්", "නොවැ", "දෙසැ"];

const HTML_PAGE_WIDTH = 794;
const HTML_PAGE_HEIGHT = 1123;
const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const SEARCH_FONT_FILE = "AbhayaLibre-Regular.ttf";
const SEARCH_FONT_URL = "/fonts/AbhayaLibre-Regular.ttf";
const SEARCH_FONT_NAME = "AbhayaLibreSearch";

interface SearchTextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  align: "left" | "center" | "right";
}

let cachedSearchFontBase64: string | null = null;

function siDateNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()} ${SI_MONTHS[d.getMonth()]} ${d.getDate()} දින ${hh}.${mm}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanPdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asciiSearchFallback(value: string): string {
  // Custom Sinhala font එක load නොවුණොත් වත් NIC / member number වගේ ASCII
  // දත්ත ටික හරි search වෙන්න Helvetica layer එකක් දානවා.
  return cleanPdfText(value.replace(/[^\x20-\x7e]+/g, " "));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function loadSearchFontBase64(): Promise<string | null> {
  if (cachedSearchFontBase64) return cachedSearchFontBase64;
  try {
    const res = await fetch(SEARCH_FONT_URL, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Font file එක වෙනුවට HTML/error page එකක් ආවොත් layer එක කැඩෙන්න දෙන්නේ නෑ.
    if (buf.byteLength < 100_000) return null;
    cachedSearchFontBase64 = arrayBufferToBase64(buf);
    return cachedSearchFontBase64;
  } catch {
    return null;
  }
}

type JsPdfDoc = {
  addFileToVFS: (filename: string, filecontent: string) => unknown;
  addFont: (postScriptName: string, id: string, fontStyle: string) => unknown;
  setFont: (fontName: string, fontStyle?: string) => unknown;
  setFontSize: (size: number) => unknown;
  setTextColor: (r: number, g: number, b: number) => unknown;
  splitTextToSize: (text: string, maxlen: number) => string[] | string;
  text: (
    text: string,
    x: number,
    y: number,
    options?: { align?: "left" | "center" | "right"; renderingMode?: "invisible" | "fill" }
  ) => unknown;
};

async function registerSearchFont(doc: JsPdfDoc): Promise<boolean> {
  const fontBase64 = await loadSearchFontBase64();
  if (!fontBase64) return false;
  try {
    doc.addFileToVFS(SEARCH_FONT_FILE, fontBase64);
    doc.addFont(SEARCH_FONT_FILE, SEARCH_FONT_NAME, "normal");
    doc.setFont(SEARCH_FONT_NAME, "normal");
    return true;
  } catch {
    return false;
  }
}

function collectSearchTextBoxes(pageEl: HTMLElement): SearchTextBox[] {
  const pageRect = pageEl.getBoundingClientRect();
  if (!pageRect.width || !pageRect.height) return [];
  const scaleX = PDF_PAGE_WIDTH / pageRect.width;
  const scaleY = PDF_PAGE_HEIGHT / pageRect.height;
  const boxes: SearchTextBox[] = [];

  pageEl.querySelectorAll<HTMLElement>("[data-pdf-text]").forEach((node) => {
    const text = cleanPdfText(node.textContent);
    if (!text) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const style = window.getComputedStyle(node);
    const fontPx = Number.parseFloat(style.fontSize) || 10.5;
    const parsedLineHeight = Number.parseFloat(style.lineHeight);
    const lineHeightPx = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0 ? parsedLineHeight : fontPx * 1.35;
    const padLeft = Number.parseFloat(style.paddingLeft) || 0;
    const padRight = Number.parseFloat(style.paddingRight) || 0;
    const padTop = Number.parseFloat(style.paddingTop) || 0;
    const declaredAlign = node.dataset.pdfAlign;
    const align: SearchTextBox["align"] =
      declaredAlign === "right" || declaredAlign === "center" || declaredAlign === "left"
        ? declaredAlign
        : style.textAlign === "right"
          ? "right"
          : style.textAlign === "center"
            ? "center"
            : "left";
    const contentLeft = rect.left - pageRect.left + padLeft;
    const contentRight = rect.right - pageRect.left - padRight;
    const x =
      align === "right"
        ? contentRight * scaleX
        : align === "center"
          ? ((rect.left - pageRect.left + rect.width / 2) * scaleX)
          : contentLeft * scaleX;

    boxes.push({
      text,
      x,
      // Baseline එක cell එක ඇතුළට වැටෙන විදිහට — reader එකේ search highlight එක හරි තැන පේනවා.
      y: (rect.top - pageRect.top + padTop + fontPx * 0.82) * scaleY,
      width: Math.max(8, (rect.width - padLeft - padRight) * scaleX),
      fontSize: Math.max(4, fontPx * scaleX),
      lineHeight: Math.max(4, lineHeightPx * scaleY),
      align,
    });
  });

  return boxes;
}

function addInvisibleTextLayer(doc: JsPdfDoc, boxes: SearchTextBox[], hasCustomFont: boolean): void {
  if (!boxes.length) return;
  doc.setFont(hasCustomFont ? SEARCH_FONT_NAME : "helvetica", "normal");
  doc.setTextColor(255, 255, 255);

  for (const box of boxes) {
    const text = hasCustomFont ? box.text : asciiSearchFallback(box.text);
    if (!text) continue;
    doc.setFontSize(box.fontSize);
    let lines: string[] = [text];
    try {
      const split = doc.splitTextToSize(text, box.width);
      lines = (Array.isArray(split) ? split : [String(split)]).map(cleanPdfText).filter(Boolean);
      if (!lines.length) lines = [text];
    } catch {
      lines = [text];
    }
    lines.forEach((line, i) => {
      try {
        doc.text(line, box.x, box.y + i * box.lineHeight, {
          align: box.align,
          renderingMode: "invisible",
        });
      } catch {
        /* එක cell එකක් fail වුණත් PDF එකම නවත්තන්නේ නෑ */
      }
    });
  }
}

export async function buildRegisterPdf(opts: {
  kind: "member" | "voter";
  label: string; // file label or "All Files"
  rows: RegisterRow[];
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const { kind, label, rows, onProgress } = opts;
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  // ✅ "ඉස්කෝල පොත" font එක load වනතුරු ඉන්නවා (නැත්නම් fallback වේ)
  try {
    await document.fonts?.ready;
    await document.fonts?.load('700 12px "Iskoola Pota"');
    await document.fonts?.load('700 12px "Abhaya Libre"');
    await document.fonts?.load('400 12px "Abhaya Libre"');
  } catch {
    /* ignore */
  }

  const PER_PAGE = 30;
  const pages: RegisterRow[][] = [];
  for (let i = 0; i < rows.length; i += PER_PAGE) pages.push(rows.slice(i, i + PER_PAGE));
  if (!pages.length) pages.push([]);

  const isMember = kind === "member";
  const head = [
    "#",
    isMember ? "සාමාජික අංකය" : "ඡන්ද අංකය",
    "ජා.හැ.අංකය (NIC)",
    "සම්පූර්ණ නම (Full Name)",
    "ලිපිනය (Address)",
    "තැපැල් ලිපිනය (Postal Address)",
    "ස්ත්‍රී/පුරුෂ",
  ];
  const dirTitle = isMember
    ? "සාමාජික ලේඛනය පිටුව (Registered Members Directory)"
    : "ඡන්ද හිමි ලේඛනය පිටුව (Eligible Voters Directory)";
  const dirSub = isMember
    ? "සාමාජිකයින්ගේ සම්පූර්ණ තොරතුරු ඇතුළත් නිල ලේඛනය වේ. මෙය නිල ලේඛනයක් ලෙස භාවිතා කළ හැක."
    : "ඡන්ද හිමියන්ගේ සම්පූර්ණ තොරතුරු ඇතුළත් නිල ලේඛනය වේ. මෙය නිල ලේඛනයක් ලෙස භාවිතා කළ හැක.";
  const totalLabel = isMember ? "සියලු සාමාජිකයින්" : "සියලු ඡන්ද හිමියන්";
  const dateStr = siDateNow();

  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${HTML_PAGE_WIDTH}px;background:#fff;z-index:-1;`;
  document.body.appendChild(host);

  const makePage = (pageRows: RegisterRow[], idx: number, total: number) => {
    const el = document.createElement("div");
    el.style.cssText =
      `width:${HTML_PAGE_WIDTH}px;min-height:${HTML_PAGE_HEIGHT}px;padding:36px 38px;box-sizing:border-box;background:#fff;font-family:'Iskoola Pota','Iskoola-Pota','Abhaya Libre','Noto Sans Sinhala',Arial,sans-serif;color:#1e293b;`;
    const bodyRows = pageRows
      .map((r, i) => {
        const no = String(idx * PER_PAGE + i + 1);
        const mno = r.member_no ?? r.voter_no ?? "";
        return `<tr style="background:${i % 2 ? "#f4f6fb" : "#fff"};">
            <td data-pdf-text style="padding:6px 7px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:10.5px;">${escapeHtml(no)}</td>
            <td data-pdf-text style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#312e81;font-size:11px;">${escapeHtml(mno)}</td>
            <td data-pdf-text style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-size:10.5px;">${escapeHtml(r.nic || "")}</td>
            <td data-pdf-text style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-weight:600;font-size:11px;">${escapeHtml(r.full_name || "")}</td>
            <td data-pdf-text style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-size:10.5px;">${escapeHtml(r.address || "")}</td>
            <td data-pdf-text style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-size:10.5px;">${escapeHtml(r.postal_address || "")}</td>
            <td data-pdf-text style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-size:10.5px;">${escapeHtml(r.gender || "")}</td>
          </tr>`;
      })
      .join("");

    el.innerHTML = `
      <!-- letterhead -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <div style="display:flex;align-items:center;gap:13px;">
          <div style="width:52px;height:52px;border-radius:50%;background:#9f1239;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;letter-spacing:0.5px;">coop</div>
          <div>
            <div data-pdf-text style="font-size:17.5px;font-weight:800;color:#1e3a8a;line-height:1.25;">සි/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය</div>
            <div data-pdf-text style="font-size:11px;font-weight:700;color:#334155;letter-spacing:0.6px;margin-top:3px;">PANDUWASNUWARA NEW MULTI-PURPOSE CO-OPERATIVE SOCIETY LTD</div>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#475569;line-height:1.85;white-space:nowrap;">
          <div data-pdf-text>ලියාපදිංචි අංකය කුරු/186</div>
          <div data-pdf-text>දුරකථන අංකය 037-2291012</div>
          <div data-pdf-text>දිනය: ${escapeHtml(dateStr)}</div>
        </div>
      </div>
      <div style="height:2.5px;background:#1e3a8a;margin:14px 0 16px;"></div>

      <!-- directory info bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;background:#eef2ff;border:1px solid #c7d2fe;border-left:5px solid #4338ca;border-radius:10px;padding:11px 16px;">
        <div>
          <div data-pdf-text style="font-size:13.5px;font-weight:800;color:#1e3a8a;">${escapeHtml(dirTitle)}</div>
          <div data-pdf-text style="font-size:9.5px;color:#64748b;margin-top:3px;">${escapeHtml(dirSub)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;white-space:nowrap;">
          <div data-pdf-text style="font-size:10.5px;color:#475569;">ගොනුව තෝරන්න / ගොනුව: <span style="display:inline-block;background:#fff;border:1px solid #a5b4fc;border-radius:7px;padding:3px 10px;font-weight:800;color:#312e81;">${escapeHtml(label)}</span></div>
          <div data-pdf-text style="font-size:10.5px;color:#475569;">${escapeHtml(totalLabel)}: <span style="display:inline-block;background:#fff;border:1px solid #a5b4fc;border-radius:7px;padding:3px 10px;font-weight:800;color:#312e81;">${escapeHtml(rows.length.toLocaleString())}</span></div>
        </div>
      </div>

      <!-- table -->
      <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:10.5px;">
        <thead>
          <tr style="background:#1e2f6b;color:#fff;">
            ${head.map((h, hi) => `<th data-pdf-text style="padding:9px 7px;text-align:${hi === 0 ? "center" : "left"};font-weight:700;font-size:10px;">${escapeHtml(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>

      <!-- footer -->
      <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;">
        <span data-pdf-text>සි/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය · Reg. No කුරු/186</span>
        <span data-pdf-text>Page ${idx + 1} / ${total} · Generated ${escapeHtml(dateStr)}</span>
      </div>`;
    return el;
  };

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  doc.setProperties({
    title: `${label} ${isMember ? "Members" : "Voters"} Register`,
    subject: dirTitle,
    keywords: `${label}, ${isMember ? "members" : "voters"}, NIC, searchable register`,
  });
  const hasSearchFont = await registerSearchFont(doc as unknown as JsPdfDoc);

  for (let i = 0; i < pages.length; i++) {
    const el = makePage(pages[i], i, pages.length);
    host.appendChild(el);
    // Layout එක settle වූ පසු හැම cell/block එකේම තැන මැනලා තියාගන්නවා.
    void el.offsetHeight;
    const searchBoxes = collectSearchTextBoxes(el);
    const canvas = await html2canvas(el, { scale: 1.6, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/jpeg", 0.9);
    if (i > 0) doc.addPage();
    doc.addImage(img, "JPEG", 0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
    // ✅ Image එක උඩින් නොපෙනෙන ඇත්ත text layer එක — reader search/copy වලට.
    addInvisibleTextLayer(doc as unknown as JsPdfDoc, searchBoxes, hasSearchFont);
    host.removeChild(el);
    onProgress?.(Math.round(((i + 1) / pages.length) * 100));
    // browsers හිස් කරන්න ඉඩ දෙන්න (ලොකු PDF වලට)
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }
  document.body.removeChild(host);
  doc.save(`${label}-${isMember ? "members" : "voters"}-register.pdf`);
}
