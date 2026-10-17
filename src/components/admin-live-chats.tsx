"use client";

// ============================================================================
// Admin → Live Chat console (⑳)
//  · visitor sessions list (2-3+ එකවර) — අතර මාරු වෙන්න
//  · එක් session එකක් තෝරලා real-time reply
//  · admin join වුණාම visitor ට "officer connected" පේනවා
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, Circle, Loader2, MessageCircle, Phone, Send, UserRound, X } from "lucide-react";
import { authedClient } from "@/lib/supabase/client";

type Session = {
  id: string;
  session_key: string;
  visitor_name: string;
  visitor_phone: string;
  status: "open" | "joined" | "closed";
  agent_id: string | null;
  agent_name: string;
  last_message: string;
  last_at: string;
  unread_admin: number;
  unread_visitor: number;
  page: string;
  created_at: string;
};

type ChatMsg = {
  id: string;
  session_key: string;
  sender: "visitor" | "agent" | "system";
  sender_name: string;
  body: string;
  created_at: string;
};

const ago = (iso: string) => {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  return `${Math.floor(d / 86400000)}d`;
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function AdminLiveChats() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<{ id: string; name: string }>({ id: "", name: "Officer" });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const activeKey = active?.session_key ?? "";
  // sessions list එකෙන් live status ගන්නවා (join වුණාම header එක update වේ)
  const current = sessions.find((x) => x.session_key === activeKey) ?? active;

  // admin ගේ නම
  useEffect(() => {
    (async () => {
      try {
        const sb = await authedClient();
        const { data: u } = await sb.auth.getUser();
        if (!u?.user) return;
        const { data: prof } = await sb.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
        setMe({ id: u.user.id, name: (prof as { full_name?: string } | null)?.full_name || "Officer" });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const sb = await authedClient();
      const { data } = await sb.from("chat_sessions").select("*").order("last_at", { ascending: false }).limit(60);
      setSessions((data ?? []) as Session[]);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSessions();
    const t = setInterval(() => void loadSessions(), 4000);
    return () => clearInterval(t);
  }, [loadSessions]);

  const loadMsgs = useCallback(async (key: string) => {
    if (!key) return;
    try {
      const sb = await authedClient();
      const { data } = await sb
        .from("chat_messages")
        .select("*")
        .eq("session_key", key)
        .order("created_at", { ascending: true })
        .limit(300);
      setMsgs((data ?? []) as ChatMsg[]);
    } catch {
      /* ignore */
    }
  }, []);

  // active session → poll messages + mark joined
  useEffect(() => {
    if (!activeKey) return;
    void loadMsgs(activeKey);
    const t = setInterval(() => void loadMsgs(activeKey), 2500);
    return () => clearInterval(t);
  }, [activeKey, loadMsgs]);

  // scroll to bottom
  useEffect(() => {
    if (!autoScroll) return;
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, autoScroll]);

  async function openSession(s: Session) {
    setActive(s);
    setNotice("");
    try {
      const sb = await authedClient();
      // join වෙනවා (status joined + agent නම + system message)
      if (s.status !== "joined" || s.agent_id !== me.id) {
        await sb
          .from("chat_sessions")
          .update({ status: "joined", agent_id: me.id || null, agent_name: me.name, unread_admin: 0 })
          .eq("session_key", s.session_key);
        await sb.from("chat_messages").insert({
          session_key: s.session_key,
          sender: "system",
          sender_name: me.name,
          body: `${me.name} joined the chat`,
        });
        setNotice("✅ ඔබ chat එකට join වුණා — visitor ට “officer connected” පේනවා");
        setTimeout(() => setNotice(""), 4000);
      } else {
        await sb.from("chat_sessions").update({ unread_admin: 0 }).eq("session_key", s.session_key);
      }
      void loadSessions();
      void loadMsgs(s.session_key);
    } catch {
      /* ignore */
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setText("");
    try {
      const sb = await authedClient();
      await sb.from("chat_messages").insert({
        session_key: active.session_key,
        sender: "agent",
        sender_name: me.name,
        body,
      });
      await sb
        .from("chat_sessions")
        .update({
          last_message: body.slice(0, 160),
          last_at: new Date().toISOString(),
          status: "joined",
          agent_id: me.id || null,
          agent_name: me.name,
          unread_admin: 0,
          unread_visitor: (active.unread_visitor ?? 0) + 1,
        })
        .eq("session_key", active.session_key);
      await loadMsgs(active.session_key);
      void loadSessions();
    } catch {
      setNotice("⚠ යැවීමට බැරි විය — නැවත උත්සාහ කරන්න");
    }
    setSending(false);
  }

  async function closeChat() {
    if (!active) return;
    try {
      const sb = await authedClient();
      await sb.from("chat_sessions").update({ status: "closed", unread_admin: 0 }).eq("session_key", active.session_key);
      await sb.from("chat_messages").insert({
        session_key: active.session_key,
        sender: "system",
        sender_name: me.name,
        body: "Chat ended by the officer. ඕනෑම වෙලාවක නැවත ලියන්න.",
      });
      await loadMsgs(active.session_key);
      void loadSessions();
      setNotice("Chat එක close කළා");
      setTimeout(() => setNotice(""), 3000);
    } catch {
      /* ignore */
    }
  }

  const totalUnread = sessions.reduce((a, s) => a + (s.unread_admin ?? 0), 0);
  const liveCount = sessions.filter((s) => s.status !== "closed").length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
          <MessageCircle size={15} className="text-indigo-600" /> Live Chats
          <span className="rounded-full bg-emerald-100 text-emerald-700 text-[9.5px] font-black px-1.5 py-0.5">{liveCount} active</span>
          {totalUnread > 0 && <span className="rounded-full bg-rose-100 text-rose-700 text-[9.5px] font-black px-1.5 py-0.5">{totalUnread} new</span>}
        </div>
        {notice && <span className="text-[10.5px] font-bold text-emerald-600">{notice}</span>}
      </div>

      <div className="grid md:grid-cols-[290px_1fr] h-[560px]">
        {/* ── session list ── */}
        <div className="border-r border-slate-100 overflow-y-auto bg-slate-50/60">
          {loading && <div className="p-4 text-[11.5px] text-slate-400"><Loader2 size={13} className="inline animate-spin" /> loading…</div>}
          {!loading && sessions.length === 0 && (
            <div className="p-6 text-center">
              <MessageCircle size={22} className="mx-auto text-slate-300" />
              <div className="mt-2 text-[11.5px] font-semibold text-slate-500">තවම live chats නෑ</div>
              <div className="mt-1 text-[10.5px] text-slate-400">Visitor කෙනෙක් chat එකේ “Live Agent” තෝරාගෙන ලියන විට මෙතන පේනවා.</div>
            </div>
          )}
          {sessions.map((s) => {
            const on = active?.session_key === s.session_key;
            const isLive = Date.now() - new Date(s.last_at).getTime() < 120000;
            return (
              <button
                key={s.id}
                onClick={() => void openSession(s)}
                className={`w-full text-left px-3 py-2.5 border-b border-slate-100 transition ${on ? "bg-indigo-50 border-l-2 border-l-indigo-600" : "hover:bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isLive ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span className="text-[11.5px] font-extrabold text-slate-800 truncate flex-1">
                    {s.visitor_name || "Guest visitor"}
                  </span>
                  <span className="text-[9px] text-slate-400">{ago(s.last_at)}</span>
                  {s.unread_admin > 0 && (
                    <span className="rounded-full bg-rose-500 text-white text-[8.5px] font-black px-1.5 py-0.5">{s.unread_admin}</span>
                  )}
                </div>
                <div className="mt-0.5 pl-4 text-[10.5px] text-slate-500 truncate">{s.last_message || "—"}</div>
                <div className="mt-1 pl-4 flex items-center gap-1.5">
                  <span
                    className={`rounded-full text-[8.5px] font-black px-1.5 py-0.5 ${
                      s.status === "joined" ? "bg-emerald-100 text-emerald-700" : s.status === "closed" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {s.status === "joined" ? "JOINED" : s.status === "closed" ? "CLOSED" : "WAITING"}
                  </span>
                  {s.agent_name && <span className="text-[9px] text-slate-400 truncate">{s.agent_name}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── chat pane ── */}
        {!active ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageCircle size={22} />
            </div>
            <div className="mt-3 text-[12.5px] font-extrabold text-slate-700">Chat එකක් තෝරන්න</div>
            <p className="mt-1 max-w-[300px] text-[11px] text-slate-400">වම් පැත්තේ list එකෙන් visitor කෙනෙක් තෝරන්න. ඔබ join වුණාම visitor ට “officer connected” පේනවා.</p>
          </div>
        ) : (
          <div className="flex flex-col min-h-0">
            {/* chat header */}
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white flex items-center justify-center shrink-0">
                <UserRound size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-extrabold text-slate-900 truncate">{current?.visitor_name || "Guest visitor"}</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <Circle size={6} className={current?.status === "joined" ? "fill-emerald-500 text-emerald-500" : "fill-amber-500 text-amber-500"} />
                  {current?.status === "joined" ? `Connected · ${current.agent_name || me.name}` : current?.status === "closed" ? "Closed" : "Waiting"}
                  {" · "}
                  {new Date(current?.created_at ?? Date.now()).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              {current?.visitor_phone && (
                <a href={`tel:${current.visitor_phone.replace(/\s/g, "")}`} className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center hover:bg-emerald-100" title="Call">
                  <Phone size={12} />
                </a>
              )}
              <button onClick={() => void closeChat()} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600" title="Close chat">
                <X size={13} />
              </button>
            </div>

            {/* messages */}
            <div
              ref={boxRef}
              onScroll={() => {
                const el = boxRef.current;
                if (!el) return;
                setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
              }}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50 min-h-0"
            >
              {msgs.length === 0 && <div className="text-center text-[11px] text-slate-400 py-6">messages නෑ</div>}
              {msgs.map((m) =>
                m.sender === "system" ? (
                  <div key={m.id} className="text-center">
                    <span className="inline-block rounded-full bg-slate-200/70 px-2.5 py-1 text-[9.5px] font-semibold text-slate-500">{m.body}</span>
                  </div>
                ) : (
                  <div key={m.id} className={`flex ${m.sender === "agent" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%]`}>
                      <div className="text-[9px] text-slate-400 mb-0.5 px-1">
                        {m.sender === "agent" ? `${m.sender_name || "Officer"} · ${clock(m.created_at)}` : `${m.sender_name || "Visitor"} · ${clock(m.created_at)}`}
                      </div>
                      <div
                        className={`rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-line ${
                          m.sender === "agent"
                            ? "bg-indigo-600 text-white rounded-br-md"
                            : "bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm"
                        }`}
                      >
                        {m.body}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* composer */}
            <div className="border-t border-slate-100 p-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Reply to the visitor…"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] outline-none focus:border-indigo-400 focus:bg-white"
                />
                <button
                  onClick={() => void send()}
                  disabled={!text.trim() || sending}
                  className="h-10 px-3.5 rounded-xl bg-indigo-600 text-white flex items-center gap-1.5 text-[11.5px] font-extrabold disabled:opacity-40 hover:bg-indigo-700 transition"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
                </button>
              </div>
              <div className="mt-1 text-[9px] text-slate-400 flex items-center gap-1">
                <CheckCheck size={10} /> ඔබ යවන පණිවිඩය visitor ගේ chat එකේ 2 තත්පරයක් ඇතුළත පේනවා
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
