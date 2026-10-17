"use client";

// ============================================================================
// Notification emails — Admin → Emails එකේ add කරපු ලිපින (ඔක්කොම)
// Form submit වෙද්දී හැම ලිපිනයකටම FormSubmit හරහා යවනවා.
// ============================================================================

import { createAnonClient } from "@/lib/supabase/anon";

export type NotifyEmail = { id: string; label: string; email: string; active: boolean; verification: string };

let cache: NotifyEmail[] | null = null;
let at = 0;
const TTL = 60 * 1000;

export async function getNotifyEmails(): Promise<string[]> {
  try {
    if (!cache || Date.now() - at > TTL) {
      const sb = createAnonClient();
      const { data, error } = await sb
        .from("notify_emails")
        .select("id,label,email,active,verification")
        .eq("active", true);
      if (error) return [];
      cache = (data ?? []) as NotifyEmail[];
      at = Date.now();
    }
    const list = cache.filter((r) => r.active && r.email).map((r) => r.email.trim());
    return Array.from(new Set(list));
  } catch {
    return [];
  }
}

/** සියලු addresses වලට එකවර යවනවා (bcc වගේ) */
export async function sendToAllEmails(payload: Record<string, unknown>): Promise<number> {
  const list = await getNotifyEmails();
  let ok = 0;
  await Promise.all(
    list.map(async (to) => {
      try {
        const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) ok++;
      } catch {
        /* ignore */
      }
    })
  );
  return ok;
}

/** FormSubmit activation mail — ලිපිනයකට යවනවා */
export async function sendActivation(email: string): Promise<boolean> {
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: "MPCS — Activate this email address",
        Name: "Panduwasnuwara MPCS",
        Message: "This is the activation request for the society notification list. Please confirm this address to start receiving membership applications.",
        Source: "Admin → Emails (activation)",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function clearNotifyCache() {
  cache = null;
  at = 0;
}
