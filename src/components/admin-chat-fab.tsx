"use client";

// ============================================================================
// Admin → floating Live Chat access (හැම admin page එකකම)
//  · active chats + unread count පෙන්නනවා
//  · click → /admin/live-chat (Live Chats tab)
// ============================================================================

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageImageIcon as MessageCircle } from "@/components/site-icons";
import { authedClient } from "@/lib/supabase/client";

export function AdminChatFab() {
  const [unread, setUnread] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const sb = await authedClient();
        const { data, error } = await sb
          .from("chat_sessions")
          .select("unread_admin,status")
          .neq("status", "closed")
          .limit(200);
        if (error || !alive) return;
        const rows = (data ?? []) as { unread_admin: number; status: string }[];
        setUnread(rows.reduce((a, r) => a + (r.unread_admin || 0), 0));
        setActive(rows.length);
      } catch {
        /* table not created yet */
      }
    };
    void tick();
    const t = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (active === 0 && unread === 0) return null;

  return (
    <Link
      href="/admin/live-chat"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-3.5 py-2.5 text-white shadow-[0_16px_40px_-12px_rgba(79,70,229,0.75)] hover:scale-[1.03] active:scale-95 transition no-print"
      title="Live Chats"
    >
      <span className="relative">
        <MessageCircle size={17} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-black flex items-center justify-center ring-2 ring-white/70">
            {unread}
          </span>
        )}
      </span>
      <span className="text-[11.5px] font-extrabold">Live Chats</span>
      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9.5px] font-bold">{active}</span>
    </Link>
  );
}
