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

// ============================================================================
// Validation (⑳) — NIC · Phone · Password
// ============================================================================
/** NIC: ඉලක්කම් 12 හෝ ඉලක්කම් 9 + v/V */
export function validateNic(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "NIC අංකය ඇතුළත් කරන්න / NIC is required";
  if (/^\d{12}$/.test(v)) return null;
  if (/^\d{9}[vV]$/.test(v)) return null;
  return "NIC අංකය වැරදියි — ඉලක්කම් 12ක් හෝ ඉලක්කම් 9ක් + v/V (උදා: 123456789012 / 123456789V)";
}

/** Phone: 0 + ඉලක්කම් 9 (මුළු 10) හෝ +94 + ඉලක්කම් 9 */
export function validatePhone(raw: string): string | null {
  const v = raw.replace(/[\s-]/g, "");
  if (!v) return "දුරකථන අංකය ඇතුළත් කරන්න / Phone is required";
  if (/^0\d{9}$/.test(v)) return null;
  if (/^\+94\d{9}$/.test(v)) return null;
  if (/^94\d{9}$/.test(v)) return null;
  return "දුරකථන අංකය වැරදියි — 0 සමඟ ඉලක්කම් 10ක් (උදා: 0771234567) හෝ +94 සමඟ ඉලක්කම් 9ක් (උදා: +94771234567)";
}

/** දුර්වල මුරපද — 123456, 111111, 654321, 11112222 වගේ */
export function validatePassword(pw: string): string | null {
  if (!pw) return "මුරපදය ඇතුළත් කරන්න / Password is required";
  if (pw.length < 6) return "මුරපදය අවම අකුරු 6ක් විය යුතුය";
  if (/^(\d)\1+$/.test(pw)) return "මේ මුරපදය දුර්වලයි — එකම ඉලක්කම් නැවත නැවත භාවිතා කර ඇත";
  // ඉලක්කම් පමණක් නම්: අනුක්‍රමික (123456/654321) හෝ පුනරාවර්තන (11112222) බැ
  if (/^\d+$/.test(pw)) {
    const seq = "0123456789876543210";
    if (seq.includes(pw)) return "මේ මුරපදය දුර්වලයි — අනුක්‍රමික ඉලක්කම් භාවිතා කර ඇත";
    const uniq = new Set(pw.split("")).size;
    if (uniq <= 2) return "මේ මුරපදය දුර්වලයි — ඉලක්කම් 2කට වඩා වැඩි විය යුතුය";
    const half = pw.slice(0, Math.floor(pw.length / 2));
    if (pw.startsWith(half + half)) return "මේ මුරපදය දුර්වලයි — එකම කොටස නැවත නැවත භාවිතා කර ඇත";
  }
  const common = ["password", "qwerty", "abc123", "admin123", "iloveyou", "123456789", "888888", "666666", "777777", "000000"];
  if (common.includes(pw.toLowerCase())) return "මේ මුරපදය ඉතා පොදුයි — වෙනත් මුරපදයක් තෝරන්න";
  return null;
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
  // ✅ NIC field එකේ email එකක් දැම්මත් වැඩ (පරණ accounts වලට safety net)
  const raw = nic.trim();
  const email = raw.includes("@") ? raw : nicToEmail(raw);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/email not confirmed/i.test(error.message || "")) {
      return { error: "Email confirm වී නැත — Supabase හි \"Confirm email\" OFF කරලා admin ට කියන්න" };
    }
    // Superadmin seed uses superadmin@mpcs.lk — try fallback email forms
    const alt = await sb.auth.signInWithPassword({
      email: raw.toLowerCase() === "superadmin" ? "superadmin@mpcs.lk" : email,
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

/**
 * ✅ සම්පූර්ණ logout — Supabase session + localStorage tokens එකම වරට ඉවත් කර
 * අනිත් open tabs වලටත් signal එකක් යවයි. Admin panel / site / dashboard
 * හැම තැනකින්ම මේකම භාවිතා කරන්න.
 */
export async function logout(redirectTo?: string): Promise<void> {
  try {
    if (isSupabaseConfigured()) await createClient().auth.signOut();
  } catch {
    /* ignore */
  }
  clearTokens();
  if (typeof window !== "undefined") {
    try {
      // storage event → වෙනත් tabs වල header එකත් logged-out වේ
      localStorage.setItem("mpcs_logged_out_at", String(Date.now()));
    } catch {
      /* ignore */
    }
    if (redirectTo !== undefined) window.location.href = redirectTo;
  }
}
