"use client";

// ============================================================================
// Online presence — කවුරු හරි site එකේ online ද කියලා Real-time track කරනවා
//  · Guest / signed-in member වෙන් කරලා ✓
//  · Supabase Realtime Presence (auth අවශ්‍ය නෑ)
//  · Admin dashboard එකේ "Users Online Now (Guests)" card එකට සජීවී ගණන දෙනවා
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { createAnonClient } from "@/lib/supabase/anon";

const CHANNEL = "mpcs-online";
const GUEST_KEY = "mpcs_guest_id";

function guestId(): string {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = `g-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return `g-${Math.random().toString(36).slice(2)}`;
  }
}

/** Site එකේ සෑම page එකකම mount වේ — presence track කරයි */
export function OnlinePresence() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      try {
        const sb = createAnonClient();
        const { data: sess } = await sb.auth.getSession();
        const signedIn = !!sess.session?.user;
        const ch = sb.channel(CHANNEL, { config: { presence: { key: guestId() } } });
        ch.subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            await ch.track({ guest: !signedIn, since: Date.now() });
          }
        });
        // page hide/unload වුණාම track එක ඉවත් වේ (browser මගින් auto)
      } catch {
        /* realtime unavailable — ignore */
      }
    })();
  }, []);
  return null;
}

/** Admin dashboard එකට — දැන් online සිටින ගණන (guests + total) */
export function useOnlineCounts(): { guests: number; total: number; ready: boolean } {
  const [counts, setCounts] = useState({ guests: 0, total: 0, ready: false });
  useEffect(() => {
    let ch: { unsubscribe: () => void } | null = null;
    let alive = true;
    (async () => {
      try {
        const sb = createAnonClient();
        const c = sb.channel(CHANNEL, { config: { presence: { key: guestId() } } });
        ch = c;
        const compute = () => {
          const state = c.presenceState() as Record<string, unknown[]>;
          const keys = Object.keys(state || {});
          let guests = 0;
          keys.forEach((k) => {
            const arr = state[k] as { guest?: boolean }[];
            if (arr?.some((p) => p && p.guest)) guests += 1;
          });
          if (alive) setCounts({ guests, total: keys.length, ready: true });
        };
        c.on("presence", { event: "sync" }, compute);
        c.on("presence", { event: "join" }, compute);
        c.on("presence", { event: "leave" }, compute);
        c.subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            await c.track({ guest: false, admin: true, since: Date.now() });
            setTimeout(compute, 400);
          }
        });
      } catch {
        if (alive) setCounts({ guests: 0, total: 0, ready: false });
      }
    })();
    return () => {
      alive = false;
      try {
        ch?.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, []);
  return counts;
}
