"use client";

// Admin shell — sidebar + content
// ✅ Role guard: admin / superadmin නොවන අයට /admin pages වැරදීමවත් ලැබෙන්නේ නෑ
//    (මේක නිසා "new row violates row-level security policy" වගේ දෝෂ නැති වේ)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin";
import { AdminChatFab } from "@/components/admin-chat-fab";
import { authedClient } from "@/lib/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const r = useRouter();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = await authedClient();
        const { data: u } = await sb.auth.getUser();
        if (!u?.user) {
          r.replace("/signin?next=/admin");
          return;
        }
        const { data: prof } = await sb.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
        const role = (prof as { role?: string } | null)?.role;
        if (!alive) return;
        if (role === "admin" || role === "superadmin") {
          setState("ok");
        } else {
          setState("denied");
          r.replace("/dashboard");
        }
      } catch {
        if (alive) setState("denied");
      }
    })();
    return () => {
      alive = false;
    };
  }, [r]);

  if (state === "checking") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <div className="mt-4 text-slate-500 text-[13px] font-semibold">Verifying administrator access…</div>
        </div>
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="card p-8 max-w-md text-center">
          <div className="text-3xl">🔒</div>
          <div className="mt-3 font-extrabold text-slate-900">Administrator access only</div>
          <p className="mt-1.5 text-slate-500 text-[12.5px]">මේ පිටුව බලන්න admin / superadmin ගිණුමකින් පිවිසෙන්න.</p>
          <a href="/signin" className="btn btn-primary mt-5 inline-flex">Sign In</a>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <main className="flex-1 min-w-0 px-6 lg:px-9 py-6">{children}</main>
      <AdminChatFab />
    </div>
  );
}
