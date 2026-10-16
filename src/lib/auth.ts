// ============================================================================
// Auth helpers — NIC-based login (Supabase Auth + synthetic email)
// email = {nic}@members.mpcs.lk  (හැඳුනුම්පත් අංකයෙන් පිවිසීම)
// ============================================================================

"use client";

import { clearTokens, createClient, isSupabaseConfigured, storeTokens } from "@/lib/supabase/client";

export function nicToEmail(nic: string): string {
  return `${nic.trim().toLowerCase()}@members.mpcs.lk`;
}

export function encodePw(pw: string): string {
  try {
    return btoa(unescape(encodeURIComponent(pw)));
  } catch {
    return "";
  }
}

export function decodePw(enc: string): string {
  try {
    return decodeURIComponent(escape(atob(enc)));
  } catch {
    return "";
  }
}

export async function registerMember(input: {
  full_name: string;
  nic: string;
  phone: string;
  password: string;
}): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: "Supabase වින්‍යාස වී නොමැත (.env.local)" };
  const sb = createClient();
  const email = nicToEmail(input.nic);
  const { data, error } = await sb.auth.signUp({ email, password: input.password });
  if (error) return { error: error.message };
  const uid = data.user?.id;
  if (uid) {
    await sb.from("profiles").upsert({
      id: uid,
      full_name: input.full_name,
      nic: input.nic.trim().toUpperCase(),
      phone: input.phone,
      auth_email: email,
      password_display: encodePw(input.password),
      role: "member",
      status: "active",
    });
  }
  return { error: null };
}

export async function loginWithNic(
  nic: string,
  password: string
): Promise<{ error: string | null; role?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase වින්‍යාස වී නොමැත (.env.local)" };
  const sb = createClient();
  const email = nicToEmail(nic);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/email not confirmed/i.test(error.message || "")) {
      return { error: "Email confirm වී නැත — Supabase හි \"Confirm email\" OFF කරලා admin ට කියන්න" };
    }
    // Superadmin seed uses superadmin@mpcs.lk — try fallback email forms
    const alt = await sb.auth.signInWithPassword({
      email: nic.trim().toLowerCase() === "superadmin" ? "superadmin@mpcs.lk" : email,
      password,
    });
    if (alt.error) {
      if (/email not confirmed/i.test(alt.error?.message || "")) {
        return { error: "Email confirm වී නැත — Supabase හි \"Confirm email\" OFF කරලා admin ට කියන්න" };
      }
      return { error: "Invalid NIC or password" };
    }
    storeTokens(alt.data.session); // ✅ localStorage එකට token
    return { error: null, role: "superadmin" };
  }
  storeTokens(data.session); // ✅ localStorage එකට token
  const uid = data.user?.id;
  let role = "member";
  if (uid) {
    const { data: prof } = await sb.from("profiles").select("role").eq("id", uid).single();
    if (prof?.role) role = prof.role;
  }
  return { error: null, role };
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await createClient().auth.signOut();
  } catch {
    /* ignore */
  }
  clearTokens();
}
