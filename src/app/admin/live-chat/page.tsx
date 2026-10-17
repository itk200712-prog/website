"use client";

// ============================================================================
// Admin → Live Chat (⑳)
//  · Live Chat email setting (contact requests යන ලිපිනය)
//  · Usage analytics — opens, searches, contact requests, 7-day chart
//  · Recent chat activity + contact requests (call back list)
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, CheckCircle2, Clock, Mail, MessageCircle, Phone,
  RefreshCw, Save, Search, Send, TrendingUp, UserRound, X as XIcon,
} from "lucide-react";
import { AdminStatCard, AdminTopbar, dbUpdate, dbUpsert, useNotice } from "@/components/admin";
import { AdminLiveChats } from "@/components/admin-live-chats";
import { authedClient } from "@/lib/supabase/client";

type Event = { id: string; event_type: string; query: string; matched: number; session_id: string; created_at: string };
type Msg = {
  id: string; name: string; phone: string; email: string; department: string;
  subject: string; message: string; status: string; created_at: string;
};

const TYPE_META: Record<string, { label: string; tone: string; icon: typeof Activity }> = {
  open: { label: "Chat opened", tone: "bg-indigo-50 text-indigo-700", icon: MessageCircle },
  search: { label: "Member search", tone: "bg-sky-50 text-sky-700", icon: Search },
  member_no: { label: "Member No lookup", tone: "bg-violet-50 text-violet-700", icon: UserRound },
  managers: { label: "Business managers", tone: "bg-amber-50 text-amber-700", icon: UserRound },
  office: { label: "Office phones", tone: "bg-emerald-50 text-emerald-700", icon: Phone },
  mphone: { label: "Managers phones", tone: "bg-teal-50 text-teal-700", icon: Phone },
  contact: { label: "Contact request", tone: "bg-fuchsia-50 text-fuchsia-700", icon: Send },
  message: { label: "Message form", tone: "bg-slate-100 text-slate-700", icon: Mail },
  search_error: { label: "Search error", tone: "bg-rose-50 text-rose-700", icon: Activity },
  intent_officer: { label: "Asked for an officer", tone: "bg-fuchsia-50 text-fuchsia-700", icon: MessageCircle },
  ask_officer: { label: "Officer Yes/No prompt", tone: "bg-fuchsia-50 text-fuchsia-700", icon: MessageCircle },
  decline_officer: { label: "Officer — declined", tone: "bg-slate-100 text-slate-600", icon: XIcon },
};

export default function AdminLiveChatPage() {
  const { show, node } = useNotice();
  const [email, setEmail] = useState("");
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [requests, setRequests] = useState<Msg[]>([]);
  const [tablesMissing, setTablesMissing] = useState(false);
  const [view, setView] = useState<"overview" | "chats">("overview");
  const [chatCount, setChatCount] = useState({ active: 0, unread: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sb = await authedClient();
      const { data: st } = await sb.from("system_settings").select("key,value").in("key", ["live_chat_email", "contact_email_1"]);
      const map = new Map(((st ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
      setEmail(map.get("live_chat_email") ?? "");
      setFallbackEmail(map.get("contact_email_1") ?? "");

      const { data: ev, error: evErr } = await sb
        .from("live_chat_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(400);
      if (evErr) {
        if (/does not exist|relation|42P01|could not find the table|PGRST205|schema cache/i.test(evErr.message)) setTablesMissing(true);
        setEvents([]);
      } else {
        setTablesMissing(false);
        setEvents((ev ?? []) as Event[]);
      }

      const { data: cs } = await sb.from("chat_sessions").select("unread_admin,status").neq("status", "closed").limit(200);
      const chatRows = (cs ?? []) as { unread_admin: number; status: string }[];
      setChatCount({ active: chatRows.length, unread: chatRows.reduce((a, r) => a + (r.unread_admin || 0), 0) });

      const { data: msgs } = await sb
        .from("messages")
        .select("*")
        .in("department", ["Live Chat", "Live Chat Contact"])
        .order("created_at", { ascending: false })
        .limit(60);
      setRequests((msgs ?? []) as Msg[]);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveEmail() {
    setSaving(true);
    const err = await dbUpsert("system_settings", { key: "live_chat_email", value: email.trim() }, "key");
    setSaving(false);
    if (err) return show(`⚠ ${err}`);
    show("✅ Live Chat email සුරැකුණා");
  }

  async function markHandled(m: Msg) {
    const err = await dbUpdate("messages", { id: m.id }, { status: "read" });
    if (err) return show(`⚠ ${err}`);
    setRequests((xs) => xs.map((x) => (x.id === m.id ? { ...x, status: "read" } : x)));
    show("✅ handled ලෙස සලකුණු කළා");
  }

  /* ------------------------------- stats ------------------------------- */
  const stats = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const t0 = startOfDay.getTime();

    const opens = events.filter((e) => e.event_type === "open");
    const searches = events.filter((e) => e.event_type === "search");
    const contacts = events.filter((e) => e.event_type === "contact");
    const sessions = new Set(events.map((e) => e.session_id).filter(Boolean));

    const today = events.filter((e) => new Date(e.created_at).getTime() >= t0).length;
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      days.push({
        label: d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2),
        count: opens.filter((e) => {
          const t = new Date(e.created_at).getTime();
          return t >= d.getTime() && t < next.getTime();
        }).length,
      });
    }
    const max = Math.max(1, ...days.map((x) => x.count));

    const counts = new Map<string, number>();
    searches.forEach((s) => {
      const k = s.query.trim().toLowerCase();
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const topQueries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const unmatched = searches.filter((s) => s.matched === 0).length;

    return {
      total: events.length,
      today,
      opens: opens.length,
      searches: searches.length,
      contacts: contacts.length,
      sessions: sessions.size,
      unmatched,
      days,
      max,
      topQueries,
      pending: requests.filter((r) => r.status === "unread").length,
    };
  }, [events, requests]);

  const recent = events.slice(0, 25);

  const tabs = (
    <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        onClick={() => setView("overview")}
        className={`rounded-lg px-3.5 py-1.5 text-[11.5px] font-extrabold transition ${view === "overview" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
      >
        📊 Overview
      </button>
      <button
        onClick={() => setView("chats")}
        className={`relative rounded-lg px-3.5 py-1.5 text-[11.5px] font-extrabold transition ${view === "chats" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
      >
        💬 Live Chats
        {chatCount.unread > 0 && (
          <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white">{chatCount.unread}</span>
        )}
      </button>
    </div>
  );

  if (view === "chats") {
    return (
      <div>
        {node}
        <AdminTopbar title="Live Chat" sub="Visitor chats — කෙලින්ම කතා කරන්න" />
        {tabs}
        <AdminLiveChats />
      </div>
    );
  }

  return (
    <div>
      {node}
      <AdminTopbar title="Live Chat" sub="Chat settings · usage analytics · contact requests" />
      {tabs}

      {/* ── Live chat entry — පැහැදිලිවම ── */}
      <button
        onClick={() => setView("chats")}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-3.5 text-left text-white shadow-lg shadow-indigo-600/20 hover:opacity-95 transition"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <MessageCircle size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-extrabold">Live Chats — visitor ලා සමඟ කෙලින්ම කතා කරන්න</span>
          <span className="block text-[11px] text-indigo-100">
            {chatCount.active} active chat{chatCount.active === 1 ? "" : "s"}
            {chatCount.unread > 0 ? ` · ${chatCount.unread} new message${chatCount.unread === 1 ? "" : "s"}` : " · අලුත් messages නෑ"}
          </span>
        </span>
        {chatCount.unread > 0 && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-rose-600">{chatCount.unread}</span>}
        <span className="shrink-0 text-[11.5px] font-extrabold">අරින්න →</span>
      </button>

      {tablesMissing && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-[12.5px] font-extrabold text-amber-800">⚠ live_chat_events table එක තවම හදලා නෑ</div>
          <p className="mt-1 text-[11.5px] text-amber-700">
            supabase/schema.sql එකේ අන්තිම "§20. LIVE CHAT" block එක Supabase → SQL Editor එකේ run කරන්න. ඊට පස්සේ usage analytics පිරෙනවා.
          </p>
        </div>
      )}

      {/* ── stats ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 mb-5">
        <AdminStatCard tag="TODAY" value={String(stats.today)} label="Chat events today" sub="opens · searches · requests" icon={<Activity size={18} />} tone="blue" />
        <AdminStatCard tag="SESSIONS" value={String(stats.sessions)} label="Visitor sessions" sub={`${stats.opens} chat opens`} icon={<MessageCircle size={18} />} tone="green" />
        <AdminStatCard tag="SEARCHES" value={String(stats.searches)} label="Member searches" sub={`${stats.unmatched} without match`} icon={<Search size={18} />} tone="amber" />
        <AdminStatCard tag="CALLBACKS" value={String(stats.contacts)} label="Contact requests" sub={`${stats.pending} pending`} icon={<Send size={18} />} tone={stats.pending > 0 ? "red" : "slate"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        {/* ── email setting ── */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
                <Mail size={15} className="text-indigo-600" /> Live Chat contact email
              </div>
              <p className="mt-0.5 text-[11.5px] text-slate-500">Contact Live Chat ඉල්ලීම් (නම · NIC · දුරකථන) යවන ලිපිනය. මේක වෙනස් කළොත් chat එකට වහාම බලපායි.</p>
            </div>
            <button onClick={() => void load()} className="btn btn-outline !py-1.5 !px-2.5 !text-[11px]" disabled={loading}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={fallbackEmail || "office@example.com"}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:bg-white"
            />
            <button onClick={() => void saveEmail()} disabled={saving} className="btn btn-primary !py-2.5 !px-4 !text-[12px]">
              <Save size={13} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px]">
            <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
              Fallback: {fallbackEmail || "contact_email_1 (හිස්)"}
            </span>
            {!email.trim() && <span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-700">හිස් — fallback ලිපිනය භාවිත වේ</span>}
            <a href={`mailto:${email.trim() || fallbackEmail}`} className="ml-auto text-indigo-600 font-bold hover:underline">
              මේ ලිපිනයට test mail එකක් යවන්න →
            </a>
          </div>

          <div className="mt-3 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-[11px] text-indigo-800">
            <b>FormSubmit</b> හරහා FREE යැවේ — mail එකේ Name / NIC / Phone / Reference අංකය එනවා. පළමු වතාවට FormSubmit එකෙන් activation mail එකක් එයි; එය confirm කරන්න.
          </div>
        </div>

        {/* ── 7 day chart ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
            <TrendingUp size={15} className="text-emerald-600" /> Last 7 days
          </div>
          <p className="text-[11.5px] text-slate-500">Chat opens per day</p>
          <div className="mt-4 flex items-end justify-between gap-1.5 h-[110px]">
            {stats.days.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-fuchsia-500 transition-all" style={{ height: `${Math.max(4, (d.count / stats.max) * 88)}px`, opacity: d.count ? 1 : 0.25 }} />
                <span className="text-[9px] font-bold text-slate-400">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-center text-[10.5px] text-slate-500">
            Total opens: <b className="text-slate-800">{stats.opens}</b>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* ── contact requests ── */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <Send size={15} className="text-fuchsia-600" /> Contact requests
              {stats.pending > 0 && <span className="rounded-full bg-rose-100 text-rose-700 text-[9.5px] font-black px-1.5 py-0.5">{stats.pending} new</span>}
            </div>
            <a href="/admin/messages" className="text-[11px] font-bold text-indigo-600 hover:underline">All messages →</a>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {requests.length === 0 && <div className="px-4 py-8 text-center text-[11.5px] text-slate-400">තවම contact requests නෑ</div>}
            {requests.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-extrabold text-slate-900 truncate">{m.name || "—"}</span>
                      {m.status === "unread" && <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 text-[8.5px] font-black px-1.5 py-0.5">NEW</span>}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-slate-500 line-clamp-2 whitespace-pre-line">{m.message}</div>
                    <div className="mt-1 text-[9.5px] text-slate-400">
                      {new Date(m.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {" · "}{m.department}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {m.phone && (
                      <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center hover:bg-emerald-100" title="Call">
                        <Phone size={12} />
                      </a>
                    )}
                    {m.status === "unread" && (
                      <button onClick={() => void markHandled(m)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200" title="Mark handled">
                        <CheckCircle2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── usage log ── */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <Clock size={15} className="text-indigo-600" /> Recent activity
            </div>
            <span className="text-[10px] font-bold text-slate-400">{events.length} events</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {recent.length === 0 && <div className="px-4 py-8 text-center text-[11.5px] text-slate-400">activity නෑ</div>}
            {recent.map((e) => {
              const meta = TYPE_META[e.event_type] ?? { label: e.event_type, tone: "bg-slate-100 text-slate-600", icon: Activity };
              const Icon = meta.icon;
              return (
                <div key={e.id} className="flex items-center gap-2 px-3.5 py-2">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${meta.tone}`}>
                    <Icon size={11} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-slate-800 truncate">{meta.label}</div>
                    {e.query && <div className="text-[10px] text-slate-400 truncate">“{e.query}”{e.event_type === "search" ? ` · ${e.matched} hit` : ""}</div>}
                  </div>
                  <span className="shrink-0 text-[9px] text-slate-400">
                    {new Date(e.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── top searches ── */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
          <Search size={15} className="text-sky-600" /> Most searched names / NIC
        </div>
        <p className="text-[11.5px] text-slate-500">Visitors ලා chat එකේ සොයන දේවල් — registry එකේ නැති ඒවා මෙතනින් හඳුනාගන්න.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {stats.topQueries.length === 0 && <span className="text-[11.5px] text-slate-400">දත්ත නෑ</span>}
          {stats.topQueries.map(([q, c]) => (
            <span key={q} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {q}
              <span className="rounded-full bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5">{c}</span>
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <ArrowUpRight size={13} className="text-indigo-500" />
          <a href="/admin/data" className="font-bold text-indigo-600 hover:underline">Data &amp; Live Metrics</a> එකේ සම්පූර්ණ registry එක බලන්න
        </div>
      </div>
    </div>
  );
}
