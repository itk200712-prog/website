"use client";

// ============================================================================
//  MPCS Live Chat — v2 (⑳)
//  · 🔎 Find Member      → නම / NIC මගින් Excel registry එකෙන් සොයයි
//                          + "Apply Membership" → application page
//  · 🏢 Business Managers → එක් එක් අංශය වෙන වෙනම (අංශය + කළමනාකරු නම)
//  · ☎️ Office Phones     → අධ්‍යක්ෂ මණ්ඩලයේ නම් + දුරකථන
//  · 📞 Managers Phones   → කළමනාකරු නම + අංශය + දුරකථන
//  · 📨 Contact Live Chat → නම + NIC + දුරකථන → FormSubmit email + inbox
//                          → "Wait a few minutes, our officer will contact you"
// ============================================================================

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Bot, Building2, CheckCircle2, Clock, Loader2, MessageCircle,
  Phone, PhoneCall, Search, Send, Sparkles, UserRound, X,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { createAnonClient } from "@/lib/supabase/anon";
import { SITE } from "@/lib/seed";

type MemberRow = {
  member_no?: string;
  voter_no?: string;
  full_name?: string;
  nic?: string;
  address?: string;
  postal_address?: string;
  gender?: string;
  file_name?: string;
};

type CardType = "members" | "apply" | "waiting";

type Msg = {
  id: number;
  from: "bot" | "me";
  text: string;
  bold?: string;
  chips?: string[];
  card?: CardType;
  rows?: MemberRow[];
  query?: string;
  ref?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ACTIONS = [
  { key: "find", en: "Find Member", si: "සාමාජික සොයන්න", icon: Search },
  { key: "managers", en: "Business Managers", si: "ව්‍යාපාර කළමනාකරුවන්", icon: Building2 },
  { key: "office", en: "Office Phones", si: "කාර්යාල දුරකථන", icon: PhoneCall },
  { key: "mphone", en: "Managers Phones", si: "කළමනාකරු දුරකථන", icon: Phone },
  { key: "contact", en: "Contact Live Chat", si: "සජීවී සම්බන්ධය", icon: MessageCircle },
] as const;

type ActionKey = (typeof ACTIONS)[number]["key"];

const MEMBER_LIKE = /^(\d{1,3}\s*\/\s*\d{1,4}|\d{1,4}\s*\/\s*\d{1,3})$/;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// usage logging — table එක නැති වුණත් chat break වෙන්නේ නෑ
async function logEvent(event_type: string, query = "", matched = 0, session = "") {
  try {
    const sb = createAnonClient();
    await sb.from("live_chat_events").insert({ event_type, query: query.slice(0, 180), matched, session_id: session });
  } catch {
    /* table not created yet */
  }
}

export function LiveChat() {
  const { lang } = useLang();
  const si = lang === "si";

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "form">("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);

  // panels
  const [panel, setPanel] = useState<null | "find" | "contact">(null);
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [cName, setCName] = useState("");
  const [cNic, setCNic] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cSent, setCSent] = useState(false);

  // legacy message form
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);
  const started = useRef(false);
  const sessionRef = useRef("");

  const push = (m: Omit<Msg, "id">) => setMsgs((xs) => [...xs, { ...m, id: idRef.current++ }]);

  // ── session + පළමු පණිවිඩය ──
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    sessionRef.current = Math.random().toString(36).slice(2, 10);
    push({
      from: "bot",
      bold: si ? "👋 ආයුබෝවන්!" : "👋 Welcome!",
      text: si
        ? `${SITE.short_si} සජීවී සහායකයා.\nපහත බොත්තමක් තෝරන්න — මම වහාම උදව් කරන්නම්.`
        : `This is the ${SITE.short_en} live assistant.\nChoose an option below and I'll help you right away.`,
      chips: si
        ? ["සාමාජික සොයන්න", "ව්‍යාපාර කළමනාකරුවන්", "කාර්යාල දුරකථන", "සජීවී සම්බන්ධය"]
        : ["Find Member", "Business Managers", "Office Phones", "Contact Live Chat"],
    });
  }, [si]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      if (!sessionRef.current) sessionRef.current = Math.random().toString(36).slice(2, 10);
      void logEvent("open", "", 0, sessionRef.current);
    }
  }, [open]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, panel, tab]);

  const closePanel = () => {
    setPanel(null);
    setTerm("");
    setCSent(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  async function runAction(key: ActionKey) {
    setTab("chat");
    setTerm("");
    setCSent(false);
    void logEvent(key, "", 0, sessionRef.current);

    if (key === "find") {
      setPanel("find");
      push({
        from: "bot",
        bold: si ? "🔎 සාමාජිකයෙක් සොයන්න" : "🔎 Find a Member",
        text: si
          ? "ඔබේ නම හෝ ජාතික හැඳුනුම්පත් අංකය (NIC) පහත කොටුවේ ලියා Search ඔබන්න.\nඋදා: මුදිත හෝ 200700203704"
          : "Enter Your Name or NIC in the box below and press Search.\nExample: Muditha or 200700203704",
      });
      return;
    }

    if (key === "managers") {
      setTyping(true);
      try {
        const sb = createAnonClient();
        const [{ data: u }, { data: c }] = await Promise.all([
          sb.from("business_units").select("slug,name_en,name_si,active").eq("active", true),
          sb.from("business_contacts").select("business_slug,name,phone").limit(200),
        ]);
        type U = { slug: string; name_en?: string; name_si?: string };
        type C = { business_slug: string; name?: string; phone?: string };
        const units = (u ?? []) as U[];
        const contacts = (c ?? []) as C[];
        setTyping(false);
        if (!contacts.length) {
          push({ from: "bot", text: si ? "දැනට කළමනාකරු තොරතුරු නොමැත." : "No manager details available right now." });
          return;
        }
        push({
          from: "bot",
          bold: si ? "🏢 ව්‍යාපාර අංශ සහ කළමනාකරුවන්" : "🏢 Business Divisions & Managers",
          text: si ? "එක් එක් අංශය වෙන වෙනම පහතින්." : "Each division is listed separately below.",
        });
        for (const ct of contacts) {
          const unit = units.find((x) => x.slug === ct.business_slug);
          const unitName = si ? unit?.name_si || unit?.name_en || ct.business_slug : unit?.name_en || ct.business_slug;
          const manager = (ct.name ?? "").replace(/\s*\(manager\)\s*$/i, "").trim();
          push({ from: "bot", bold: `🏢 ${unitName}`, text: `👤 ${si ? "කළමනාකරු" : "Manager"}: ${manager || "—"}` });
          await sleep(190);
        }
        push({
          from: "bot",
          text: si ? "දුරකථන අංක සඳහා “කළමනාකරු දුරකථන” තෝරන්න." : "Tap “Managers Phones” for their phone numbers.",
          chips: si ? ["කළමනාකරු දුරකථන", "කාර්යාල දුරකථන"] : ["Managers Phones", "Office Phones"],
        });
      } catch {
        setTyping(false);
        push({ from: "bot", text: si ? "⚠ දත්ත ලබාගත නොහැකි විය." : "⚠ Could not load data." });
      }
      return;
    }

    if (key === "office") {
      setTyping(true);
      try {
        const sb = createAnonClient();
        const { data } = await sb
          .from("board_members")
          .select("name_en,name_si,position_en,position_si,phone,category")
          .order("order");
        setTyping(false);
        type B = { name_en?: string; name_si?: string; position_en?: string; position_si?: string; phone?: string };
        const rows = (data ?? []) as B[];
        push({
          from: "bot",
          bold: si ? "☎️ කාර්යාල දුරකථන — අධ්‍යක්ෂ මණ්ඩලය" : "☎️ Office Phones — Board of Directors",
          text: rows.length
            ? rows
                .map(
                  (r) =>
                    `• ${(si ? r.name_si || r.name_en : r.name_en) ?? "—"}${
                      (si ? r.position_si || r.position_en : r.position_en) ? ` (${si ? r.position_si || r.position_en : r.position_en})` : ""
                    }\n   📞 ${r.phone || "—"}`
                )
                .join("\n")
            : si
              ? "දුරකථන තොරතුරු නොමැත."
              : "No phone numbers available.",
          chips: si ? ["කළමනාකරු දුරකථන", "සජීවී සම්බන්ධය"] : ["Managers Phones", "Contact Live Chat"],
        });
      } catch {
        setTyping(false);
        push({ from: "bot", text: si ? "⚠ දත්ත ලබාගත නොහැකි විය." : "⚠ Could not load data." });
      }
      return;
    }

    if (key === "mphone") {
      setTyping(true);
      try {
        const sb = createAnonClient();
        const [{ data: u }, { data: c }] = await Promise.all([
          sb.from("business_units").select("slug,name_en,name_si"),
          sb.from("business_contacts").select("business_slug,name,phone,role_en,role_si").limit(200),
        ]);
        type U = { slug: string; name_en?: string; name_si?: string };
        type C = { business_slug: string; name?: string; phone?: string; role_en?: string; role_si?: string };
        const units = (u ?? []) as U[];
        const contacts = (c ?? []) as C[];
        setTyping(false);
        if (!contacts.length) {
          push({ from: "bot", text: si ? "දැනට දුරකථන තොරතුරු නොමැත." : "No phone details available right now." });
          return;
        }
        push({
          from: "bot",
          bold: si ? "📞 කළමනාකරුවන්ගේ දුරකථන" : "📞 Managers’ Phone Numbers",
          text: si ? "අංශය · නම · දුරකථන අංකය" : "Division · Name · Phone",
        });
        // 4 blocks per message — කියවන්න ලේසි
        for (let i = 0; i < contacts.length; i += 4) {
          const chunk = contacts.slice(i, i + 4);
          const text = chunk
            .map((ct) => {
              const unit = units.find((x) => x.slug === ct.business_slug);
              const unitName = si ? unit?.name_si || unit?.name_en || ct.business_slug : unit?.name_en || ct.business_slug;
              const manager = (ct.name ?? "").replace(/\s*\(manager\)\s*$/i, "").trim();
              return `🏢 ${unitName}\n👤 ${manager || "—"}\n📞 ${ct.phone || "—"}`;
            })
            .join("\n\n");
          push({ from: "bot", text });
          await sleep(260);
        }
        push({
          from: "bot",
          text: si ? "තව විස්තර: /businesses" : "More details: /businesses",
          chips: si ? ["කාර්යාල දුරකථන", "සජීවී සම්බන්ධය"] : ["Office Phones", "Contact Live Chat"],
        });
      } catch {
        setTyping(false);
        push({ from: "bot", text: si ? "⚠ දත්ත ලබාගත නොහැකි විය." : "⚠ Could not load data." });
      }
      return;
    }

    if (key === "contact") {
      setTab("chat");
      setPanel("contact");
      setCSent(false);
      push({
        from: "bot",
        bold: si ? "📨 සජීවී සම්බන්ධය" : "📨 Contact Live Chat",
        text: si
          ? "ඔබේ නම, NIC සහ දුරකථන අංකය පහත ඇතුළත් කර Submit කරන්න.\nඅපගේ නිලධාරියෙක් ඉක්මනින් ඔබට කතා කරනවා."
          : "Enter your Name, NIC and Phone Number below, then press Submit.\nOne of our officers will contact you shortly.",
      });
    }
  }

  // ── Find member search ──
  async function searchMember(e: React.FormEvent) {
    e.preventDefault();
    const raw = term.trim();
    if (!raw || busy) return;
    push({ from: "me", text: raw });
    setTerm("");
    setBusy(true);
    setTyping(true);
    const safe = raw.replace(/[%,()*]/g, " ").replace(/\s+/g, " ").trim();
    try {
      const sb = createAnonClient();
      const { data, error } = await sb
        .from("member_rows")
        .select("member_no,full_name,nic,address,postal_address,gender,file_name")
        .or(`full_name.ilike.*${safe}*,nic.ilike.*${safe}*,member_no.ilike.*${safe}*`)
        .limit(8);
      setTyping(false);
      setBusy(false);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as MemberRow[];
      void logEvent("search", raw, rows.length, sessionRef.current);
      if (rows.length) {
        push({
          from: "bot",
          bold: si ? `✅ ප්‍රතිඵල ${rows.length}` : `✅ ${rows.length} result${rows.length > 1 ? "s" : ""}`,
          text: si ? `“${raw}” සඳහා ගැළපෙන සාමාජිකයන්:` : `Members matching “${raw}”:`,
          card: "members",
          rows,
          query: raw,
        });
      } else {
        push({
          from: "bot",
          bold: si ? "❌ ප්‍රතිඵල නොමැත" : "❌ No results",
          text: si
            ? `“${raw}” සමඟ සාමාජිකයෙක් හමු නොවීය.\nනම සම්පූර්ණයෙන් හෝ NIC අංකය නිවැරදිද පරීක්ෂා කරන්න.`
            : `No member found for “${raw}”.\nCheck the full name or NIC number and try again.`,
          card: "apply",
          chips: si ? ["නැවත සොයන්න"] : ["Search again"],
        });
      }
    } catch (err) {
      setTyping(false);
      setBusy(false);
      void logEvent("search_error", raw, 0, sessionRef.current);
      push({ from: "bot", text: si ? `⚠ ${String((err as Error).message)}` : `⚠ ${String((err as Error).message)}` });
    }
  }

  function applyCta() {
    push({
      from: "bot",
      bold: si ? "🪪 සාමාජිකත්වය සඳහා අයදුම් කරන්න" : "🪪 Apply for Membership",
      text: si
        ? "පහත බොත්තමෙන් අයදුම්පත් පිටුවට යන්න. පින්තූර 3ක් සහ අත්සන් කළ පිටපතක් සූදානම් කරගන්න."
        : "Open the application form below. Keep your photo and signed copy ready.",
      card: "apply",
    });
  }

  // ── Contact request submit ──
  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = cName.trim();
    const nic = cNic.trim();
    const phone = cPhone.trim();
    if (!name || !nic || !phone) return;
    setBusy(true);
    const ref = `LC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    push({ from: "me", text: `${name} · ${nic} · ${phone}` });
    try {
      const { getLiveChatEmail } = await import("@/lib/contact-email");
      const to = await getLiveChatEmail();
      await fetch(`https://formsubmit.co/ajax/${to}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `🔔 Live Chat contact request — ${name} (${ref})`,
          _template: "table",
          Source: "Website Live Chat — Contact Request",
          Reference: ref,
          Name: name,
          NIC: nic,
          Phone: phone,
          Message: "A visitor requested an officer to contact them via the live chat widget.",
        }),
      });
    } catch {
      /* offline — DB එකට යනවා */
    }
    try {
      const sb = createAnonClient();
      await sb.from("messages").insert({
        name,
        phone,
        email: "",
        department: "Live Chat Contact",
        subject: `Contact request ${ref}`,
        message: `NIC: ${nic}\nPhone: ${phone}\nRequested via live chat — officer to call back.`,
        status: "unread",
      });
    } catch {
      /* best effort */
    }
    void logEvent("contact", `${name} · ${nic}`, 0, sessionRef.current);

    setBusy(false);
    setCName("");
    setCNic("");
    setCPhone("");
    setPanel(null);
    setCSent(true);
    push({
      from: "bot",
      bold: si ? "⏳ නිලධාරියෙක් එනතුරු රැඳී සිටින්න" : "⏳ Waiting for an officer",
      text: si
        ? "ඔබේ ඉල්ලීම අපගේ කාර්යාලයට ලැබුණා ✅\n\n⏱ Waiting a few minutes — our officer will contact you.\n\nකරුණාකර දුරකථනය ළඟ රැඳී සිටින්න."
        : "Your request has reached our office ✅\n\n⏱ Waiting a few minutes — our officer will contact you.\n\nPlease keep your phone close.",
      card: "waiting",
      ref,
    });
    setTimeout(() => setCSent(false), 8000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  TEXT BOT (existing brains + shortcuts)
  // ─────────────────────────────────────────────────────────────────────────
  async function botReply(raw: string) {
    const q = raw.trim();
    const n = norm(q);
    if (!q) return;

    // action shortcut
    const hit = ACTIONS.find((a) => norm(a.en) === n || norm(a.si) === n || (a.key === "find" && /^(search again|නැවත සොයන්න)$/.test(n)));
    if (hit) {
      await runAction(hit.key);
      return;
    }

    if (MEMBER_LIKE.test(q.replace(/\s/g, ""))) {
      const key = q.replace(/\s/g, "");
      setTyping(true);
      try {
        const sb = createAnonClient();
        const [m, v] = await Promise.all([
          sb.from("member_rows").select("member_no,full_name,nic,address,postal_address,gender,file_name").eq("member_no", key).limit(1),
          sb.from("voter_rows").select("voter_no,full_name,nic,address,postal_address,gender,file_name").eq("voter_no", key).limit(1),
        ]);
        setTyping(false);
        const row = (m.data?.[0] || v.data?.[0]) as MemberRow | undefined;
        if (row) {
          push({
            from: "bot",
            bold: row.full_name || "",
            text: si
              ? `✅ සාමාජික අංකය: ${row.member_no ?? row.voter_no}\n📇 ජා.හැ.අංකය: ${row.nic || "—"}\n🏠 ලිපිනය: ${row.address || "—"}\n📮 තැපැල් ලිපිනය: ${row.postal_address || "—"}\n👤 ස්ත්‍රී/පුරුෂ: ${row.gender || "—"}`
              : `✅ Member No: ${row.member_no ?? row.voter_no}\n📇 NIC: ${row.nic || "—"}\n🏠 Address: ${row.address || "—"}\n📮 Postal: ${row.postal_address || "—"}\n👤 Gender: ${row.gender || "—"}`,
            chips: si ? ["සාමාජික සොයන්න", "ව්‍යාපාර කළමනාකරුවන්"] : ["Find Member", "Business Managers"],
          });
          void logEvent("member_no", key, 1, sessionRef.current);
        } else {
          push({
            from: "bot",
            text: si ? `❌ ${key} අංකයට සාමාජික විස්තර හමු නොවීය. (උදා: 41/01)` : `❌ No member found for ${key}. (e.g. 41/01)`,
            chips: si ? ["සාමාජික සොයන්න"] : ["Find Member"],
          });
        }
      } catch {
        setTyping(false);
        push({ from: "bot", text: si ? "⚠ දත්ත ලබාගත නොහැකි විය." : "⚠ Could not fetch data." });
      }
      return;
    }

    if (/(hour|time|වේලා|open|විවෘත|close|වහන)/.test(n)) {
      push({ from: "bot", bold: si ? "🕘 කාර්යාල වේලාවන්" : "🕘 Office Hours", text: (si ? SITE.hours_si : SITE.hours_en).join("\n") });
      return;
    }

    if (/(address|location|map|ලිපින|කොහෙද|සිතියම)/.test(n)) {
      push({
        from: "bot",
        bold: si ? "📍 අපගේ ලිපිනය" : "📍 Our Location",
        text: `${si ? SITE.address_si : SITE.address_en}\nhttps://maps.app.goo.gl/JFbV9o8sknmp1jDy7`,
      });
      return;
    }

    if (/(join|register|apply|සාමාජික|ලියාපදිංචි|අයදුම්)/.test(n)) {
      applyCta();
      return;
    }

    if (/(fuel|petrol|diesel|kerosene|ඉන්ධන|පෙට්‍රල්|ඩීසල්)/.test(n)) {
      setTyping(true);
      try {
        const sb = createAnonClient();
        const { data } = await sb.from("fuel_prices").select("*").limit(10);
        setTyping(false);
        const rows = (data ?? []) as { type?: string; fuel_type?: string; price?: number | string }[];
        push({
          from: "bot",
          bold: si ? "⛽ ඉන්ධන මිල" : "⛽ Fuel Prices",
          text: rows.length ? rows.map((r) => `• ${r.type ?? r.fuel_type}: Rs. ${r.price}`).join("\n") : si ? `දැනට නොමැත — අමතන්න ${SITE.phones[0]}` : `Unavailable — call ${SITE.phones[0]}`,
        });
      } catch {
        setTyping(false);
        push({ from: "bot", text: SITE.phones.join(" | ") });
      }
      return;
    }

    if (/(phone|call|දුරකථන|අමතන්න|contact|manager|කළමනාකර)/.test(n)) {
      push({
        from: "bot",
        bold: si ? "📞 අප අමතන්න" : "📞 Contact Us",
        text: `${SITE.phones.join("\n")}\n📍 ${si ? SITE.address_si : SITE.address_en}`,
        chips: si ? ["කාර්යාල දුරකථන", "කළමනාකරු දුරකථන"] : ["Office Phones", "Managers Phones"],
      });
      return;
    }

    if (/(hello|hi|hey|ayubowan|ආයුබෝ|හෙලෝ|කොහොමද)/.test(n)) {
      push({
        from: "bot",
        text: si ? "ආයුබෝවන්! 😊 පහත බොත්තමක් තෝරන්න හෝ සාමාජික අංකයක් (41/01) යවන්න." : "Hello! 😊 Pick an option below or send a member number (41/01).",
        chips: si ? ["සාමාජික සොයන්න", "සජීවී සම්බන්ධය"] : ["Find Member", "Contact Live Chat"],
      });
      return;
    }

    push({
      from: "bot",
      text: si
        ? "පහත විකල්ප වලින් එකක් තෝරන්න 👇"
        : "Please pick one of the options below 👇",
      chips: si ? ["සාමාජික සොයන්න", "ව්‍යාපාර කළමනාකරුවන්", "කාර්යාල දුරකථන", "සජීවී සම්බන්ධය"] : ["Find Member", "Business Managers", "Office Phones", "Contact Live Chat"],
    });
  }

  function send(text?: string) {
    const v = (text ?? input).trim();
    if (!v) return;
    push({ from: "me", text: v });
    setInput("");
    setTimeout(() => void botReply(v), 350);
  }

  // ── legacy "Message" tab (free text) ──
  async function submitMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      _subject: `MPCS Live Chat message — ${String(fd.get("name") || "Guest")}`,
      Source: "Website Live Chat",
      Name: String(fd.get("name") || ""),
      Phone: String(fd.get("phone") || ""),
      Email: String(fd.get("email") || "—"),
      Message: String(fd.get("message") || ""),
    };
    try {
      const { getLiveChatEmail } = await import("@/lib/contact-email");
      const to = await getLiveChatEmail();
      await fetch(`https://formsubmit.co/ajax/${to}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* offline */
    }
    try {
      const { createAnonClient } = await import("@/lib/supabase/anon");
      await createAnonClient().from("messages").insert({
        name: payload.Name,
        phone: payload.Phone,
        email: payload.Email,
        department: "Live Chat",
        subject: "Live Chat message",
        message: payload.Message,
        status: "unread",
      });
    } catch {
      /* best effort */
    }
    void logEvent("message", payload.Name, 0, sessionRef.current);
    setSending(false);
    setSentOk(true);
    form.reset();
    setTimeout(() => setSentOk(false), 5000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-[72px] right-4 sm:bottom-20 sm:right-6 z-[90] h-14 w-14 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white shadow-2xl shadow-indigo-900/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform no-print"
        aria-label="Live chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">{unread}</span>
        )}
        {!open && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />}
      </button>

      {open && (
        <div className="fixed bottom-[140px] right-4 sm:bottom-[150px] sm:right-6 z-[90] w-[calc(100vw-2rem)] sm:w-[400px] max-h-[min(660px,72vh)] rounded-3xl overflow-hidden bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.55)] border border-slate-200 flex flex-col pop-in no-print">
          {/* ── header ── */}
          <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-fuchsia-600 px-4 pt-3.5 pb-3 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
                <Bot size={20} />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-indigo-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-[14px] leading-tight truncate">{si ? "MPCS සජීවී සහායක" : "MPCS Live Assistant"}</div>
                <div className="text-[10.5px] text-indigo-100 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> {si ? "සබැඳි · ක්ෂණික පිළිතුරු" : "Online · instant answers"}
                </div>
              </div>
              <a href={`tel:${SITE.phones[0].replace(/\s/g, "")}`} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition" title={si ? "අමතන්න" : "Call us"}>
                <Phone size={14} />
              </a>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition" aria-label="Close">
                <X size={15} />
              </button>
            </div>

            {/* tabs */}
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-white/15 p-1">
              <button onClick={() => setTab("chat")} className={`rounded-lg py-1.5 text-[11.5px] font-bold transition ${tab === "chat" ? "bg-white text-indigo-700 shadow" : "text-white/90 hover:bg-white/10"}`}>
                <Sparkles size={12} className="inline mr-1" /> {si ? "සහායක" : "Assistant"}
              </button>
              <button onClick={() => setTab("form")} className={`rounded-lg py-1.5 text-[11.5px] font-bold transition ${tab === "form" ? "bg-white text-indigo-700 shadow" : "text-white/90 hover:bg-white/10"}`}>
                <Send size={12} className="inline mr-1" /> {si ? "පණිවිඩයක්" : "Message"}
              </button>
            </div>
          </div>

          {tab === "chat" ? (
            <>
              {/* ── action bar ── */}
              <div className="shrink-0 border-b border-slate-200 bg-white px-2 py-2">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => void runAction(a.key)}
                      className={`shrink-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-bold transition ${
                        a.key === "contact"
                          ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                      }`}
                    >
                      <a.icon size={12} />
                      {si ? a.si : a.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── messages ── */}
              <div ref={boxRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 bg-slate-50 min-h-[180px]">
                {msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] ${m.from === "me" ? "order-1" : ""}`}>
                      <div className="flex items-end gap-1.5">
                        {m.from === "bot" && (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mb-0.5">
                            <Bot size={13} />
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-line ${
                            m.from === "me" ? "bg-indigo-600 text-white rounded-br-md" : "bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm"
                          }`}
                        >
                          {m.bold && <div className="font-extrabold mb-1 text-slate-900">{m.bold}</div>}
                          {m.text}

                          {/* member result cards */}
                          {m.card === "members" && m.rows && (
                            <div className="mt-2 space-y-1.5">
                              {m.rows.map((r, i) => (
                                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-extrabold text-[12px] text-slate-900 leading-tight">{r.full_name || "—"}</div>
                                    <span className="shrink-0 rounded-md bg-indigo-600 text-white text-[9.5px] font-black px-1.5 py-0.5">{r.member_no || "—"}</span>
                                  </div>
                                  <div className="mt-1 text-[10.5px] text-slate-500 leading-relaxed">
                                    <span className="font-semibold text-slate-600">NIC:</span> {r.nic || "—"}
                                    <br />
                                    <span className="font-semibold text-slate-600">{si ? "ලිපිනය" : "Address"}:</span> {r.address || "—"}
                                  </div>
                                </div>
                              ))}
                              <button
                                onClick={applyCta}
                                className="mt-1 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-2 text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 hover:opacity-95 transition"
                              >
                                <UserRound size={13} /> {si ? "සාමාජිකත්වයට අයදුම් කරන්න" : "Apply Membership"} <ArrowRight size={13} />
                              </button>
                            </div>
                          )}

                          {/* apply CTA */}
                          {m.card === "apply" && (
                            <a
                              href="/membership/apply"
                              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-2.5 text-[12px] font-extrabold hover:opacity-95 transition"
                            >
                              <UserRound size={14} /> {si ? "අයදුම්පත් පිටුව විවෘත කරන්න" : "Open Application Form"} <ArrowRight size={14} />
                            </a>
                          )}

                          {/* waiting card */}
                          {m.card === "waiting" && (
                            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-800">
                                <Clock size={12} /> {si ? "සක්‍රීය ඉල්ලීම" : "Active request"}
                              </div>
                              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5">
                                <span className="text-[10px] font-bold text-slate-500">{si ? "යොමු අංකය" : "Reference"}</span>
                                <span className="font-mono text-[10.5px] font-black text-slate-800">{m.ref}</span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-amber-700">
                                <CheckCircle2 size={11} /> {si ? "කාර්යාලයට ලැබුණි" : "Received by the office"}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {m.chips && m.chips.length > 0 && (
                        <div className="mt-1.5 ml-7 flex flex-wrap gap-1.5">
                          {m.chips.map((c) => (
                            <button key={c} onClick={() => send(c)} className="rounded-full border border-indigo-200 bg-white text-indigo-700 px-2.5 py-1 text-[10.5px] font-bold hover:bg-indigo-50 transition">
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {typing && (
                  <div className="flex items-end gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Bot size={13} />
                    </div>
                    <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-3.5 py-3 flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── panels ── */}
              {panel === "find" && (
                <form onSubmit={searchMember} className="shrink-0 border-t border-slate-200 bg-white px-3 pt-2.5 pb-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wide text-indigo-600">{si ? "නම හෝ NIC ඇතුළත් කරන්න" : "Enter Your Name or NIC"}</label>
                    <button type="button" onClick={closePanel} className="text-slate-400 hover:text-slate-600" aria-label="Cancel">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      autoFocus
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      placeholder={si ? "උදා: මුදිත / 200700203704" : "e.g. Muditha / 200700203704"}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-indigo-400 focus:bg-white"
                    />
                    <button
                      type="submit"
                      disabled={busy || !term.trim()}
                      className="rounded-xl bg-indigo-600 text-white px-3.5 text-[11.5px] font-extrabold disabled:opacity-40 hover:bg-indigo-700 transition flex items-center gap-1"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} {si ? "සොයන්න" : "Search"}
                    </button>
                  </div>
                </form>
              )}

              {panel === "contact" && (
                <form onSubmit={submitContact} className="shrink-0 border-t border-slate-200 bg-white px-3 pt-2.5 pb-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wide text-fuchsia-600">{si ? "සජීවී සම්බන්ධතා තොරතුරු" : "Contact details"}</label>
                    <button type="button" onClick={closePanel} className="text-slate-400 hover:text-slate-600" aria-label="Cancel">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="mt-1 space-y-1.5">
                    <input
                      autoFocus
                      required
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder={si ? "ඔබේ නම *" : "Your Name *"}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-fuchsia-400 focus:bg-white"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        required
                        value={cNic}
                        onChange={(e) => setCNic(e.target.value)}
                        placeholder={si ? "NIC අංකය *" : "NIC Number *"}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-fuchsia-400 focus:bg-white"
                      />
                      <input
                        required
                        value={cPhone}
                        onChange={(e) => setCPhone(e.target.value)}
                        inputMode="tel"
                        placeholder={si ? "දුරකථන අංකය *" : "Phone Number *"}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-fuchsia-400 focus:bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !cName.trim() || !cNic.trim() || !cPhone.trim()}
                      className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white py-2.5 text-[12px] font-extrabold disabled:opacity-40 hover:opacity-95 transition flex items-center justify-center gap-1.5"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {si ? "ඉදිරිපත් කරන්න" : "Submit"}
                    </button>
                  </div>
                </form>
              )}

              {cSent && (
                <div className="shrink-0 bg-emerald-50 border-t border-emerald-200 px-3 py-2 text-[10.5px] font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> {si ? "ඉල්ලීම යවන ලදි — නිලධාරියෙක් ඔබට කතා කරනු ඇත." : "Request sent — an officer will contact you."}
                </div>
              )}

              {/* ── composer ── */}
              {!panel && (
                <div className="shrink-0 border-t border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder={si ? "සාමාජික අංකයක් හෝ ප්‍රශ්නයක් ලියන්න…" : "Type a member number or ask anything…"}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:bg-white"
                    />
                    <button onClick={() => send()} disabled={!input.trim()} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-indigo-700 transition">
                      <Send size={16} />
                    </button>
                  </div>
                  <div className="mt-1.5 text-center text-[9.5px] text-slate-400">{si ? "නිල ලේඛන දත්ත වලින් · 24/7" : "Official registry data · 24/7"}</div>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={submitMessage} className="flex-1 overflow-y-auto bg-slate-50 p-3.5 space-y-2.5">
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-[11px] text-indigo-800 font-semibold">
                {si ? "📨 ඔබේ පණිවිඩය කෙලින්ම අපගේ කාර්යාලයට email එකක් ලෙස යැවේ." : "📨 Your message goes straight to our office as an email."}
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{si ? "නම" : "Name"} *</label>
                <input name="name" required className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{si ? "දුරකථන" : "Phone"} *</label>
                  <input name="phone" required className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Email</label>
                  <input name="email" type="email" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{si ? "පණිවිඩය" : "Message"} *</label>
                <textarea name="message" required rows={4} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400 resize-none" />
              </div>
              {sentOk && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-[11.5px] font-bold text-emerald-700">
                  ✅ {si ? "පණිවිඩය යැවුණා! අපි ඉක්මනින් සම්බන්ධ වන්නෙමු." : "Message sent! We'll get back to you shortly."}
                </div>
              )}
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white py-2.5 text-[12.5px] font-extrabold disabled:opacity-60 hover:opacity-95 transition flex items-center justify-center gap-2"
              >
                <Send size={14} /> {sending ? (si ? "යවමින්…" : "Sending…") : si ? "පණිවිඩය යවන්න" : "Send Message"}
              </button>
              <div className="text-center text-[9.5px] text-slate-400 pb-1">{si ? `හෝ අමතන්න ${SITE.phones[0]}` : `Or call us ${SITE.phones[0]}`}</div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
