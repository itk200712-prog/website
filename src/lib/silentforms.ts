// ============================================================================
//  📨 SILENTFORMS — site එකේ email service (FormSubmit වෙනුවට)
// ----------------------------------------------------------------------------
//  ඕනෑම HTML form එකක් / fetch එකක් `https://silentforms.com/api/submit` ට POST
//  කළාම submission එක access key එකට සම්බන්ධ inbox එකට email වේ.
//
//  · JSON body (`Content-Type: application/json` + `Accept: application/json`)
//  · පිළිතුර: { status: "success", success: true, ok: true, message }
//  · දෝෂ: 400 (invalid / CAPTCHA) · 401 (key නෑ) · 403 (key වැරදි / paused / domain)
//          413 (>1MB) · 429 (rate limit: IP එකකට 10/min · key එකකට 60/min)
//  · Special fields: email (Reply-To) · replyto · subject/_subject · from_name
//                    sf_extra (honeypot — පිරෙලා තිබ්බොත් spam) · redirect · webhookUrl
//
//  ⚠ මේ module එක browser එකේත්, server එකේත් දෙකේම වැඩ කරයි (fetch විතරයි).
// ============================================================================

export const SILENTFORMS_ENDPOINT = "https://silentforms.com/api/submit";

/** system_settings key — Admin → Emails එකෙන් save කරන access key */
export const SILENTFORMS_KEY_SETTING = "silentforms_access_key";
/** Admin → Emails එකේ “මුලින්ම යවන සේවාව” — "silentforms" (default) හෝ "smtp" */
export const MAIL_PROVIDER_SETTING = "mail_provider";
export type MailProvider = "silentforms" | "smtp";

/** ඔබ දුන් access key — settings එකේ එකක් නැත්නම් මේක පාවිච්චි වේ */
export const SILENTFORMS_DEFAULT_KEY =
  "bf4a0621f8f5f3d1360a356ad57a15dc623b96d52412b27e87cc6f75f64f189b";

/** access key එකක් වගේ පේනවද (hex 32+) */
export function looksLikeAccessKey(v: string): boolean {
  return /^[a-zA-Z0-9_-]{16,128}$/.test(String(v ?? "").trim());
}

/** settings එකේ අගය හිස් නම් default key එක */
export function resolveSilentFormsKey(saved?: string | null): string {
  const v = String(saved ?? "").trim();
  return looksLikeAccessKey(v) ? v : SILENTFORMS_DEFAULT_KEY;
}

export type SilentFormsResult = { ok: boolean; error?: string; status?: string };

/**
 * SilentForms එකට submission එකක් යවයි.
 * `fields` වල `accessKey` සහ `sf_extra` (honeypot) අපිම එකතු කරනවා.
 */
export async function postToSilentForms(
  accessKey: string,
  fields: Record<string, string>,
  timeoutMs = 12_000
): Promise<SilentFormsResult> {
  const key = resolveSilentFormsKey(accessKey);
  const body: Record<string, string> = { ...fields, accessKey: key, sf_extra: "" };
  for (const k of Object.keys(body)) {
    if (body[k] === undefined || body[k] === null) delete body[k];
  }
  try {
    const res = await fetch(SILENTFORMS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    type SfJson = { status?: string; success?: boolean | string; ok?: boolean | string; message?: string } | null;
    let json: SfJson = null;
    try {
      json = (await res.json()) as SfJson;
    } catch {
      json = null;
    }
    const okFlag =
      json?.status === "success" ||
      json?.success === true || json?.success === "true" ||
      json?.ok === true || json?.ok === "true";
    if (res.ok && okFlag) return { ok: true, status: json?.status ?? "success" };
    const reason =
      json?.message ||
      (res.status === 401 ? "access key එක අඩුයි (401)"
        : res.status === 403 ? "access key වැරදි / form paused / domain blocked (403)"
          : res.status === 429 ? "rate limit (429) — විනාඩියකට 10කට වඩා යැව්වා"
            : res.status === 413 ? "පණිවිඩය වැඩිපුර ලොකුයි (413)"
              : res.status === 503 ? "CAPTCHA සේවාවට connect වුණේ නෑ (503)"
                : `HTTP ${res.status}`);
    return { ok: false, error: reason.slice(0, 200), status: json?.status };
  } catch (e) {
    return { ok: false, error: `SilentForms වෙත connect වෙන්න බෑ — ${(e as Error).message}`.slice(0, 200) };
  }
}
