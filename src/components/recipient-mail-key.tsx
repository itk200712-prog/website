"use client";

import { useState } from "react";
import { authedClient } from "@/lib/supabase/client";
import { looksLikeAccessKey } from "@/lib/silentforms";

export type RecipientKeyStatus = Record<string, { configured: boolean; preview: string }>;

type Props = {
  email: string;
  status?: { configured: boolean; preview: string };
  metadataReady: boolean;
  onSaved: (metadata: RecipientKeyStatus) => void;
};

/** The saved key is never fetched back; only newly typed values can be revealed. */
export function RecipientMailKey({ email, status, metadataReady, onSaved }: Props) {
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function action(kind: "save" | "remove" | "test") {
    if (kind === "save" && !looksLikeAccessKey(key)) return setNotice("වලංගු SilentForms key එක paste කරන්න.");
    if (kind === "remove" && !window.confirm(`${email} සඳහා save කළ key එක ඉවත් කරන්නද? Email ලිපිනය ඉවත් නොවේ.`)) return;
    setBusy(kind);
    setNotice("");
    try {
      const sb = await authedClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("නැවත login කරන්න");
      const body = kind === "test"
        ? { testTo: email, testProvider: "silentforms" }
        : { recipientEmail: email, recipientAccessKey: kind === "remove" ? "" : key.trim() };
      const res = await fetch("/api/mail/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const result = await res.json() as { ok?: boolean; reason?: string; notice?: string; recipientKeys?: RecipientKeyStatus; failed?: { error?: string }[] };
      if (!res.ok || !result.ok) throw new Error(result.failed?.[0]?.error || result.reason || "Request failed");
      if (result.recipientKeys) onSaved(result.recipientKeys);
      if (kind !== "test") { setKey(""); setVisible(false); }
      setNotice(kind === "test"
        ? result.notice || "Submission accepted — inbox delivery තහවුරු නෑ; Inbox / Spam බලන්න."
        : kind === "remove" ? "Key ඉවත් කළා. Email ලිපිනය වෙනස් නොවේ."
          : "✅ මේ email එකේ key එක සුරැකුණා. මෙම ලිපිනය තියෙන සියලු කාරණාවලටත් අදාළයි. දැන් Test කරන්න.");
    } catch (error) {
      setNotice(`⚠ ${(error as Error).message}`);
    } finally { setBusy(""); }
  }

  return <div className="w-full rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5">
    <div className="mb-2 break-all text-[10.5px] font-semibold text-slate-600">
      🔑 {email} · {!metadataReady ? "Key status loading / unavailable" : status?.configured
        ? `KEY SAVED ✅ ${status.preview} (inbox verified නොවේ)` : "KEY NOT SAVED — මේ email එකේම key එක දාන්න"}
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      <input aria-label={`SilentForms key for ${email}`} type={visible ? "text" : "password"}
        autoComplete="new-password" spellCheck={false} maxLength={128} value={key}
        onChange={e => setKey(e.target.value)} disabled={!!busy}
        placeholder={status?.configured ? "වෙනස් කරන්න නම් අලුත් key එක" : "මේ email එකට ලැබුණු SilentForms access key"}
        className="min-w-0 basis-full flex-1 rounded-lg sm:basis-auto border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400" />
      <button type="button" onClick={() => setVisible(v => !v)} className="rounded-lg bg-white px-2 py-2 text-[10px] font-bold text-slate-600">{visible ? "HIDE" : "SHOW"}</button>
      <button type="button" onClick={() => void action("save")} disabled={!!busy || !key.trim()}
        className="rounded-lg bg-indigo-600 px-2.5 py-2 text-[10.5px] font-bold text-white disabled:opacity-40">{busy === "save" ? "Saving…" : "Save key"}</button>
      <button type="button" onClick={() => void action("test")} disabled={!!busy || !status?.configured || !metadataReady || !!key.trim()}
        title="Save key first; test uses only this email's saved key, without SMTP fallback"
        className="rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-[10.5px] font-bold text-indigo-700 disabled:opacity-40">{busy === "test" ? "Testing…" : "Test key"}</button>
      {status?.configured && <button type="button" onClick={() => void action("remove")} disabled={!!busy}
        className="rounded-lg px-2 py-2 text-[10px] font-bold text-rose-600 disabled:opacity-40">Remove key</button>}
    </div>
    {!!key.trim() && <p className="mt-1 text-[10px] text-amber-800">Unsaved key — Save key කළ පසු Test key කරන්න.</p>}
    {!!notice && <p role="status" aria-live="polite" className="mt-2 break-words text-[11px] leading-relaxed text-slate-700">{notice}</p>}
  </div>;
}
