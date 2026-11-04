"use client";

// ============================================================================
// Register update notice — Member Details (All) + Eligible Voters උඩින්
// Admin → Settings එකෙන් on/off · පිටු දෙකට වෙන වෙනම show/hide · text/phone
// ============================================================================

import { AlertCircle, Phone, RefreshCw } from "lucide-react";
import { useLang } from "@/lib/i18n";
import {
  noticeDialFromPhone,
  registerNoticeText,
  shouldShowRegisterNotice,
} from "@/lib/register-notice";
import type { RegisterNoticeSetting } from "@/lib/types";

export function RegisterNotice({
  notice,
  kind,
}: {
  notice?: RegisterNoticeSetting | null;
  kind: "member" | "voter";
}) {
  const { lang } = useLang();
  const si = lang === "si";
  if (!shouldShowRegisterNotice(notice, kind)) return null;

  const setting = notice as RegisterNoticeSetting;
  const { title, message } = registerNoticeText(setting, lang);
  const dial = setting.phoneDial || noticeDialFromPhone(setting.phone);
  const pageLabel = kind === "member" ? (si ? "සාමාජික ලේඛනය" : "Member register") : si ? "ඡන්ද ලේඛනය" : "Voter register";

  return (
    <section className="reg-notice" role="status" aria-live="polite" aria-label={title}>
      <span className="reg-notice-accent" aria-hidden="true" />

      <div className="reg-notice-body">
        <div className="reg-notice-icon" aria-hidden="true">
          <RefreshCw size={21} className="reg-notice-spin" />
        </div>

        <div className="reg-notice-copy">
          <div className="reg-notice-chip-row">
            <span className="reg-notice-chip">
              <span className="reg-notice-dot" aria-hidden="true" />
              {si ? "යාවත්කාලීන වෙමින් පවතී" : "Update in progress"}
            </span>
            <span className="reg-notice-page">{pageLabel}</span>
          </div>

          <h2 className="reg-notice-title">{title}</h2>
          <p className="reg-notice-message">{message}</p>

          <div className="reg-notice-actions">
            <a href={`tel:${dial}`} className="reg-notice-phone">
              <span className="reg-notice-phone-icon" aria-hidden="true">
                <Phone size={15} />
              </span>
              <span className="reg-notice-phone-number">{setting.phone}</span>
            </a>
            <span className="reg-notice-help">
              <AlertCircle size={13} aria-hidden="true" />
              {si
                ? "වැඩිදුර විස්තර සඳහා අමතන්න — සඳුදා සිට සිකුරාදා, පෙ.ව. 8.30 – ප.ව. 5.30"
                : "Call us for more details — Monday to Friday, 8.30 AM – 5.30 PM"}
            </span>
          </div>
        </div>
      </div>

      <span className="reg-notice-progress" aria-hidden="true" />
    </section>
  );
}
