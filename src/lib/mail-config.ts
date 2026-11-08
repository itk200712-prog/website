// Public, pure configuration helpers only. No passwords or server environment variables.
export const MAIL_SLOTS = 10;

export const SMTP_PRESETS = {
  gmail: { label: "Gmail", host: "smtp.gmail.com", port: 465, secure: true },
  mailcom: { label: "Mail.com", host: "smtp.mail.com", port: 465, secure: true },
  outlook: { label: "Outlook", host: "smtp-mail.outlook.com", port: 587, secure: false },
  yahoo: { label: "Yahoo", host: "smtp.mail.yahoo.com", port: 465, secure: true },
} as const;

/** Only identify known consumer-provider mismatches; allow custom Google Workspace domains. */
export function smtpConfigurationIssue(input: { host?: string; user?: string }): string | null {
  const host = (input.host ?? "").trim().toLowerCase();
  const domain = (input.user ?? "").trim().toLowerCase().split("@")[1] ?? "";
  if (host === "smtp.gmail.com" && ["mail.com", "gmx.com", "gmx.net", "outlook.com", "hotmail.com", "live.com", "yahoo.com"].includes(domain)) {
    return `SMTP provider mismatch: @${domain} ලිපිනය Gmail SMTP login එකක් නොවේ. සැබෑ Gmail / Google Workspace account එක + එහි App Password දාන්න, නැත්නම් එම ලිපිනයේ නිවැරදි SMTP server එක තෝරන්න. @mail.com සඳහා smtp.mail.com භාවිත කරන්න.`;
  }
  if (host === "smtp.mail.com" && ["gmail.com", "googlemail.com"].includes(domain)) {
    return "SMTP provider mismatch: Gmail ලිපිනය සඳහා smtp.gmail.com + එම Gmail එකේ App Password භාවිත කරන්න; smtp.mail.com නොවේ.";
  }
  return null;
}
