// ============================================================================
// Professional register PDF generator — shared by admin data + members/voters
// Letterhead (Sinhala + English), reg no, phone, date, file/total bar,
// bilingual headers, ALL rows across ALL pages (html2canvas => Sinhala safe).
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

function siDateNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()} ${SI_MONTHS[d.getMonth()]} ${d.getDate()} දින ${hh}.${mm}`;
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
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;";
  document.body.appendChild(host);

  const makePage = (pageRows: RegisterRow[], idx: number, total: number) => {
    const el = document.createElement("div");
    el.style.cssText =
      "width:794px;min-height:1123px;padding:36px 38px;box-sizing:border-box;background:#fff;font-family:'Iskoola Pota','Iskoola-Pota','Abhaya Libre','Noto Sans Sinhala',Arial,sans-serif;color:#1e293b;";
    const bodyRows = pageRows
      .map((r, i) => {
        const no = String((idx * PER_PAGE + i + 1) as number | string);
        const mno = r.member_no ?? r.voter_no ?? "";
        return `<tr style="background:${i % 2 ? "#f4f6fb" : "#fff"};">
            <td style="padding:6px 7px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:10.5px;">${no}</td>
            <td style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#312e81;font-size:11px;">${mno}</td>
            <td style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-size:10.5px;">${r.nic || ""}</td>
            <td style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-weight:600;font-size:11px;">${r.full_name || ""}</td>
            <td style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-size:10.5px;">${r.address || ""}</td>
            <td style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-size:10.5px;">${r.postal_address || ""}</td>
            <td style="padding:6px 7px;border-bottom:1px solid #e2e8f0;font-size:10.5px;">${r.gender || ""}</td>
          </tr>`;
      })
      .join("");

    el.innerHTML = `
      <!-- letterhead -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <div style="display:flex;align-items:center;gap:13px;">
          <div style="width:52px;height:52px;border-radius:50%;background:#9f1239;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;letter-spacing:0.5px;">coop</div>
          <div>
            <div style="font-size:17.5px;font-weight:800;color:#1e3a8a;line-height:1.25;">සි/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය</div>
            <div style="font-size:11px;font-weight:700;color:#334155;letter-spacing:0.6px;margin-top:3px;">PANDUWASNUWARA NEW MULTI-PURPOSE CO-OPERATIVE SOCIETY LTD</div>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#475569;line-height:1.85;white-space:nowrap;">
          <div>ලියාපදිංචි අංකය කුරු/186</div>
          <div>දුරකථන අංකය 037-2291012</div>
          <div>දිනය: ${dateStr}</div>
        </div>
      </div>
      <div style="height:2.5px;background:#1e3a8a;margin:14px 0 16px;"></div>

      <!-- directory info bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;background:#eef2ff;border:1px solid #c7d2fe;border-left:5px solid #4338ca;border-radius:10px;padding:11px 16px;">
        <div>
          <div style="font-size:13.5px;font-weight:800;color:#1e3a8a;">${dirTitle}</div>
          <div style="font-size:9.5px;color:#64748b;margin-top:3px;">${dirSub}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;white-space:nowrap;">
          <div style="font-size:10.5px;color:#475569;">ගොනුව තෝරන්න / ගොනුව: <span style="display:inline-block;background:#fff;border:1px solid #a5b4fc;border-radius:7px;padding:3px 10px;font-weight:800;color:#312e81;">${label}</span></div>
          <div style="font-size:10.5px;color:#475569;">${totalLabel}: <span style="display:inline-block;background:#fff;border:1px solid #a5b4fc;border-radius:7px;padding:3px 10px;font-weight:800;color:#312e81;">${rows.length.toLocaleString()}</span></div>
        </div>
      </div>

      <!-- table -->
      <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:10.5px;">
        <thead>
          <tr style="background:#1e2f6b;color:#fff;">
            ${head.map((h, hi) => `<th style="padding:9px 7px;text-align:${hi === 0 ? "center" : "left"};font-weight:700;font-size:10px;">${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>

      <!-- footer -->
      <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;">
        <span>සි/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය · Reg. No කුරු/186</span>
        <span>Page ${idx + 1} / ${total} · Generated ${dateStr}</span>
      </div>`;
    return el;
  };

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  for (let i = 0; i < pages.length; i++) {
    const el = makePage(pages[i], i, pages.length);
    host.appendChild(el);
    const canvas = await html2canvas(el, { scale: 1.6, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/jpeg", 0.9);
    if (i > 0) doc.addPage();
    doc.addImage(img, "JPEG", 0, 0, 595.28, 841.89);
    host.removeChild(el);
    onProgress?.(Math.round(((i + 1) / pages.length) * 100));
    // browsers හිස් කරන්න ඉඩ දෙන්න (ලොකු PDF වලට)
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }
  document.body.removeChild(host);
  doc.save(`${label}-${isMember ? "members" : "voters"}-register.pdf`);
}
