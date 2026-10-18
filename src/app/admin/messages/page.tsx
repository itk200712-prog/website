"use client";

// ============================================================================
// Messages & Inquiries — business categories + status + Reply option
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Mail, RefreshCw, Reply, Search, Send, Trash2 } from "lucide-react";
import { AdminTopbar, dbDelete, dbUpdate, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";

type Msg = {
  id: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  subject?: string | null;
  message: string;
  status: "unread" | "read" | "replied";
  reply: string;
  ago: string;
};

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

const DEPTS = [
  "All Messages",
  "Live Chat",
  "Rural Bank",
  "Consumer Section",
  "Fuel Station",
  "Maliban Biscuits Agency",
  "Maliban Milk Agency",
  "Nature's Secrets Agency",
  "Hemas Agency",
  "Ristbury Tiara Agency",
  "Funeral Services Section",
  "Co-op City Supermarket",
  "General Society Inquiries",
];

const STATUS = ["all", "unread", "read", "replied"] as const;

export default function AdminMessagesPage() {
  const { show, node } = useNotice();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState("All Messages");
  const [status, setStatus] = useState<(typeof STATUS)[number]>("all");
  const [q, setQ] = useState("");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState("");

  // ඇත්ත පණිවිඩ database එකෙන් — Contact form, business inquiries සහ
  // චැට් එකේ Message tab එකෙන් එන ඔක්කොම මෙතැනට එයි
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sb = await authedClient();
      const { data, error } = await sb
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      setMsgs(
        ((data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id ?? ""),
          name: String(r.name ?? ""),
          phone: String(r.phone ?? ""),
          email: String(r.email ?? ""),
          department: String(r.department ?? "General Society Inquiries"),
          subject: (r.subject as string | null) ?? null,
          message: String(r.message ?? ""),
          status: (["unread", "read", "replied"].includes(String(r.status)) ? r.status : "unread") as Msg["status"],
          reply: String(r.reply ?? ""),
          ago: timeAgo(r.created_at as string | undefined),
        }))
      );
    } catch (e) {
      show(`⚠ පණිවිඩ load කිරීමට බැරි විය: ${e instanceof Error ? e.message : "error"}`);
    }
    setLoading(false);
  }, [show]);

  useEffect(() => {
    void load();
  }, [load]);

  // දත්තවල තියෙන අමතර department උත් tabs වලට එකතු කරන්න
  const depts = useMemo(() => {
    const extra = Array.from(new Set(msgs.map((m) => m.department).filter((d) => d && !DEPTS.includes(d))));
    return [...DEPTS, ...extra];
  }, [msgs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return msgs.filter(
      (m) =>
        (dept === "All Messages" || m.department === dept) &&
        (status === "all" || m.status === status) &&
        (!s ||
          m.name.toLowerCase().includes(s) ||
          m.message.toLowerCase().includes(s) ||
          (m.subject ?? "").toLowerCase().includes(s) ||
          m.email.toLowerCase().includes(s) ||
          m.phone.includes(s))
    );
  }, [msgs, dept, status, q]);

  function openReply(m: Msg) {
    setReplyFor(replyFor === m.id ? null : m.id);
    if (m.status === "unread") {
      setMsgs((xs) => xs.map((x) => (x.id === m.id ? { ...x, status: "read" } : x)));
      void dbUpdate("messages", { id: m.id }, { status: "read" });
    }
  }

  async function sendReply(m: Msg, text: string) {
    setMsgs((xs) => xs.map((x) => (x.id === m.id ? { ...x, status: "replied", reply: text } : x)));
    const err = await dbUpdate("messages", { id: m.id }, { status: "replied", reply: text });
    setReplyFor(null);
    show(err ? `⚠ ${err}` : "✅ Reply sent — status: Replied");
  }

  async function deleteMessage(m: Msg) {
    if (!confirm(`මේ පණිවිඩය (${m.name || "Unknown"} — ${m.department}) මකන්නද? මේක ආපසු ගන්න බෑ.`)) return;
    setDeletingId(m.id);
    const err = await dbDelete("messages", { id: m.id });
    setDeletingId("");
    if (err) return show(`⚠ ${err}`);
    setMsgs((xs) => xs.filter((x) => x.id !== m.id));
    if (replyFor === m.id) setReplyFor(null);
    show("✅ පණිවිඩය මැකුණා");
  }

  return (
    <div>
      <AdminTopbar title="Messages & Inquiries" sub="Review and manage member records, moderate gallery discussions, and configure communication preferences." />
      {node}

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Mail size={20} className="text-indigo-700" /> Customer Inquiries &amp; Messages
            </h2>
            <p className="text-slate-500 text-[12px] mt-1">
              Incoming messages from the website — contact form, business pages and the chat Message tab
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="field !pl-10" placeholder="Search inquiries by sender, subject, or phone..." />
          </div>
        </div>

        {/* business category tabs (scrollable) */}
        <div className="scroll-x mt-5 pb-1">
          <div className="flex gap-2 min-w-max">
            {depts.map((d) => {
              const count = msgs.filter((m) => d === "All Messages" || m.department === d).length;
              return (
                <button
                  key={d}
                  onClick={() => setDept(d)}
                  className={`rounded-full px-4 py-2 text-[11.5px] font-bold border whitespace-nowrap ${
                    dept === d ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {d} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* status tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-[10.5px] font-bold tracking-[0.16em] text-slate-400">STATUS:</span>
          {STATUS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold border ${
                status === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {s[0].toUpperCase() + s.slice(1)} {s === "all" ? msgs.length : msgs.filter((m) => m.status === s).length}
            </button>
          ))}
          <button className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center ml-1" onClick={() => void load()} disabled={loading} title="Refresh">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* messages list */}
      <div className="mt-5 space-y-4">
        {filtered.length === 0 ? (
          <div className="card py-16 text-center">
            <Mail size={40} className="mx-auto text-slate-300" />
            <div className="text-slate-600 font-bold text-[15px] mt-3">{loading ? "Loading messages…" : "No inquiries found for this category."}</div>
            <div className="text-slate-400 text-[12px]">Messages from the contact form, business pages and the chat Message tab appear here automatically.</div>
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-[14px]">{m.name}</span>
                    <span className="badge-amber rounded-full px-2 py-0.5 text-[9.5px] font-bold">{m.department}</span>
                    {m.status === "unread" && <span className="badge-red rounded-full px-2 py-0.5 text-[9.5px] font-bold">Unread</span>}
                    {m.status === "replied" && <span className="badge-green rounded-full px-2 py-0.5 text-[9.5px] font-bold">Replied</span>}
                  </div>
                  <div className="text-slate-500 text-[11.5px] mt-1">
                    📞 {m.phone} · ✉ {m.email || "—"}
                  </div>
                  {m.subject && <div className="text-slate-400 text-[11px] mt-0.5 font-semibold">{m.subject}</div>}
                  <div className="text-slate-700 text-[12.5px] mt-2">{m.message}</div>
                  {m.reply && (
                    <div className="mt-2.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 text-[12px] text-emerald-900">
                      <strong>Reply:</strong> {m.reply}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-slate-400 text-[10.5px]">{m.ago}</div>
                  <div className="mt-2 flex gap-1.5 justify-end">
                    <button className="btn btn-primary !py-1.5 !px-3.5 !text-[11.5px]" onClick={() => openReply(m)}>
                      <Reply size={13} /> Reply
                    </button>
                    <button
                      className="btn btn-outline !py-1.5 !px-3 !text-[11.5px] !border-rose-200 !text-rose-600 hover:!bg-rose-50 disabled:opacity-50"
                      onClick={() => void deleteMessage(m)}
                      disabled={deletingId === m.id}
                      title="මේ පණිවිඩය මකන්න"
                    >
                      <Trash2 size={13} /> {deletingId === m.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
              {replyFor === m.id && (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = (new FormData(e.currentTarget).get("reply") as string) || "";
                    if (text.trim()) sendReply(m, text.trim());
                  }}
                >
                  <input name="reply" className="field" placeholder="Type your reply to the customer..." autoFocus />
                  <button type="submit" className="btn btn-primary shrink-0">
                    <Send size={15} /> Send
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-5 text-[11px] text-slate-400 flex items-center gap-1.5">
        <Building2 size={12} /> Contact form, business "Send Inquiry" forms and the chat Message tab all route here. Notification email addresses are set in Admin → Emails.
      </div>
    </div>
  );
}
