"use client";

// ============================================================================
//  MPCS Live Chat — v2 (⑳) + Baymax brain (③)
//  · 🔎 Find Member      → නම / NIC මගින් Excel registry එකෙන් සොයයි
//                          + "Apply Membership" → application page
//  · ⛽ Fuel Prices      → ඉන්ධනය തෝරන්න → ඒ වර්ගයේ අද මිල (③ අලුත්)
//  · 📰 News             → published පුවත්/නිවේදන cards → සම්පූර්ණ විස්තරය
//  · 🖼️ Gallery           → published ඡායාරූප + tagline → විස්තරය
//  · 🏢 Business Managers → එක් එක් අංශය වෙන වෙනම (අංශය + කළමනාකරු නම)
//  · ☎️ Office Phones     → අධ්‍යක්ෂ මණ්ඩලයේ නම් + දුරකථන
//  · 📞 Managers Phones   → කළමනාකරු නම් බොත්තම් → තෝරපු අයගේ දුරකථනය (Office Phones වගේමයි)
//  · 📨 Contact Live Chat → නම + NIC + දුරකථන → FormSubmit email + inbox
//                          → "Wait a few minutes, our officer will contact you"
//  · 🧠 Smalltalk brain   → hi/hello/කොහොමද ආචාර, නම මතක තබා ගැනීම,
//                          තේරුණේ නැති පණිවිඩ log කිරීම (src/lib/chatbot.ts)
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, BellOff, Bot, Building2, CheckCircle2, Clock, Fuel, Images, Loader2, Lock, MessageCircle, Minus, Newspaper, Phone, PhoneCall, Search, Send, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { createAnonClient } from "@/lib/supabase/anon";
import { tokens } from "@/lib/search";
import { BOARD, BUSINESSES, FUEL_PRICES, GALLERY, NEWS, RURAL_BANK_BRANCHES, SETTINGS, SITE } from "@/lib/seed";
import {
  detectBanking,
  detectComplaint,
  detectFuel,
  detectGallery,
  detectNameIntro,
  detectNews,
  detectOfficerRequest,
  detectSmalltalk,
  canUseLiveChat,
  getLiveChatHoursStatus,
  nextLiveChatOpenPhrase,
  hasClearableHistory,
  resetBaymaxMemory,
  replyIsSi,
  shouldShowTyping,
  type BaymaxMemory,
} from "@/lib/chatbot";
import {
  buildKnowledgeIndex,
  searchKnowledge,
  type IndexedKnowledgeEntry,
  type KnowledgeSourceData,
} from "@/lib/knowledge";
import type {
  BoardMember,
  BusinessBranch,
  BusinessContact,
  BusinessService,
  BusinessUnit,
  FuelPrice,
  GalleryItem,
  NewsItem,
} from "@/lib/types";

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

type CardType = "members" | "apply" | "waiting" | "choices" | "news" | "gallery";
type ListItem = { label: string; sub?: string; value: string };
/** news / gallery පෙන්වීමට ඇති rich card අංග — click කළාම සම්පූර්ණ විස්තරය එනවා */
type RichItem = { id: string; title: string; sub?: string; desc?: string; image?: string; badge?: string };

type LiveMsg = { id: string; sender: "visitor" | "agent" | "system"; sender_name: string; body: string; created_at: string };

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
  choices?: { label: string; kind: "yes" | "no" }[];
  list?: ListItem[];
  action?: "biz" | "board" | "fuel" | "mphone";
  items?: RichItem[];
  link?: { href: string; label: string };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ACTIONS = [
  { key: "find", en: "Find Member", si: "සාමාජික සොයන්න", icon: Search },
  { key: "fuel", en: "Fuel Prices", si: "ඉන්ධන මිල", icon: Fuel },
  { key: "news", en: "News", si: "නිවේදන හා පුවත්", icon: Newspaper },
  { key: "gallery", en: "Gallery", si: "ගැලරිය", icon: Images },
  { key: "managers", en: "Business Managers", si: "ව්‍යාපාර කළමනාකරුවන්", icon: Building2 },
  { key: "office", en: "Office Phones", si: "කාර්යාල දුරකථන", icon: PhoneCall },
  { key: "mphone", en: "Managers Phones", si: "කළමනාකරු දුරකථන", icon: Phone },
  { key: "contact", en: "Request a Call", si: "ඇමතුමක් ඉල්ලන්න", icon: MessageCircle },
  { key: "live", en: "Live Chat", si: "සජීවී චැට්", icon: UserRound },
] as const;

/** ප්‍රධාන මෙනුව — greeting / help පිළිතුරු යටතේ එන shortcut බොත්තම් */
const MENU_CHIPS_SI = ["සාමාජික සොයන්න", "ඉන්ධන මිල", "නිවේදන හා පුවත්", "ගැලරිය"];
const MENU_CHIPS_EN = ["Find Member", "Fuel Prices", "News", "Gallery"];

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
  const [tab, setTab] = useState<"chat" | "live" | "form">("chat");
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
  const [sentErr, setSentErr] = useState(false);

  // ── live agent (2-way) ──
  const [sessionKey, setSessionKey] = useState("");
  // ✅ Bot identity — admin Settings එකෙන් වෙනස් කළ හැකි නම + පින්තූරය
  const [botName, setBotName] = useState("Baymax");
  const [botAvatar, setBotAvatar] = useState("");
  // ✨ Admin → Live Chat එකෙන් on කළොත් විතරයි Gemini AI fallback එක කැඳවන්නේ
  const [aiEnabled, setAiEnabled] = useState(false);
  const [liveMsgs, setLiveMsgs] = useState<LiveMsg[]>([]);
  const [liveStatus, setLiveStatus] = useState<"open" | "joined" | "closed">("open");
  const [agentName, setAgentName] = useState("");
  const [liveText, setLiveText] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveErr, setLiveErr] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [agentTyping, setAgentTyping] = useState(false);
  const [liveUsed, setLiveUsed] = useState(false);
  // ✅ callback request කළාම session එකක් තියෙනවා → admin join වුණාම notify කරන්න poll කරයි
  const [sessionActive, setSessionActive] = useState(false);
  const [officerJoined, setOfficerJoined] = useState(false);
  // 🕘 Live Chat කාර්යාල වේලාව (Asia/Colombo) — තත්පර 30කට වරක් refresh වේ
  const [liveHours, setLiveHours] = useState(() => getLiveChatHoursStatus());
  // visitor ඇසූ භාෂාව officer flow එක පුරාම තබා ගන්න — ඊළඟ Yes/No click එකකදීත්
  // මුල් සිංහල පණිවිඩය අතේ නැති නිසා page locale එකෙන් විතරක් තීරණය කරන්න බෑ.
  const [officerReplySi, setOfficerReplySi] = useState<boolean | null>(null);
  const contactReplySi = officerReplySi ?? si;
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(true);
  const typingAt = useRef(0);
  const clearedAtRef = useRef("");
  const liveBoxRef = useRef<HTMLDivElement>(null);
  const lastTs = useRef("1970-01-01T00:00:00Z");

  const boxRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);
  const flowRef = useRef(0);          // flow එකක් අතරමැදි වීම වළක්වයි
  // ✅ bot "මතකය" — කතාව අතරේ දැනගන්නා දෑ (නම, අන්තිමට ඇසූ දේ) මතක තබා ගැනීම
  const convoRef = useRef<BaymaxMemory>({});
  const knowledgeIndexRef = useRef<IndexedKnowledgeEntry[] | null>(null);
  const knowledgeLoadRef = useRef<Promise<IndexedKnowledgeEntry[]> | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const started = useRef(false);
  const sessionRef = useRef("");

  const push = (m: Omit<Msg, "id">) => setMsgs((xs) => [...xs, { ...m, id: idRef.current++ }].slice(-80));

  /** Baymax හි පළමු (welcome) පණිවිඩය — reset කළාම ආයෙත් පේන්නේ මේක විතරයි */
  function makeWelcomeMessage(): Msg {
    const welcome = si
      ? `මම ${botName} — ${SITE.short_si} සහායකයා.\nසමිතිය, සේවා, සාමාජිකත්වය හෝ අංශ ගැන ඕනෑම දෙයක් අහන්න. අංශයක නමක් විතරක් වුණත් ඇති — උදා: “Maliban”, “රක්ෂණය” හෝ “සභාපතිගේ නම”.`
      : `I'm ${botName} — the ${SITE.short_en} assistant.\nAsk me anything about the society, services, membership or divisions. A single keyword works too — e.g. “Maliban”, “insurance” or “chairman name”.`;
    return {
      id: 0,
      from: "bot",
      bold: si ? "👋 ආයුබෝවන්!" : "👋 Welcome!",
      text: welcome,
      chips: si ? [...MENU_CHIPS_SI, "ව්‍යාපාර කළමනාකරුවන්"] : [...MENU_CHIPS_EN, "Business Managers"],
    };
  }

  /**
   * 🧹 Baymax conversation එක සම්පූර්ණයෙන්ම අයින් කර අලුතින් පටන් ගනී.
   * පණිවිඩ history එක විතරක් නෙවෙයි — follow-up context (last intent/topic),
   * open වෙලා තිබුණු panel, type කරපු text සහ callback form එකේ විස්තරත් අයින් වේ.
   * Live (officer) session එකට මෙයින් කිසිම බලපෑමක් නෑ.
   */
  function resetBaymaxConversation() {
    flowRef.current++; // දුවමින් තිබුණු Baymax flow එකක් තිබුණොත් ඒකත් නවත්වයි
    idRef.current = 1;
    started.current = true;
    convoRef.current = resetBaymaxMemory(convoRef.current);
    setMsgs([makeWelcomeMessage()]);
    setInput("");
    setPanel(null);
    setTerm("");
    setBusy(false);
    setCName("");
    setCNic("");
    setCPhone("");
    setCSent(false);
    setOfficerReplySi(null);
    setTyping(false);
    setAutoScroll(true);
  }

  // ── bot නම + avatar + AI on/off (system_settings → public read; API key එක මෙතැන නෑ) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = createAnonClient();
        const { data } = await sb
          .from("system_settings")
          .select("key,value")
          .in("key", ["chat_bot_name", "chat_bot_avatar", "chat_ai_enabled"]);
        const map = new Map(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
        if (!alive) return;
        const n = (map.get("chat_bot_name") || "").trim();
        if (n) setBotName(n);
        setBotAvatar((map.get("chat_bot_avatar") || "").trim());
        setAiEnabled(["1", "true", "yes", "on"].includes((map.get("chat_ai_enabled") || "").trim().toLowerCase()));
      } catch {
        /* default Baymax */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 🕘 කාර්යාල වේලාව තත්‍ය වේලාවෙන්ම තබා ගන්න (widget එක ඇරලා තියෙද්දී වේලාව පැන ගියත්)
  useEffect(() => {
    const id = setInterval(() => setLiveHours(getLiveChatHoursStatus()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── session + පළමු පණිවිඩය ──
  useEffect(() => {
    const welcome = makeWelcomeMessage();
    if (started.current) {
      // bot නම පසුව load වුණා නම් පළමු පණිවිඩයේ නම refresh කරයි
      setMsgs((xs) => xs.map((m) => (m.id === 0 ? { ...m, bold: welcome.bold, text: welcome.text, chips: welcome.chips } : m)));
      return;
    }
    started.current = true;
    sessionRef.current = Math.random().toString(36).slice(2, 10);
    idRef.current = 1;
    setMsgs([welcome]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [si, botName]);

  // visitor session key (localStorage — reload කළත් එකම chat එක)
  useEffect(() => {
    try {
      let k = localStorage.getItem("mpcs_chat_key");
      if (!k) {
        k = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("mpcs_chat_key", k);
      }
      setSessionKey(k);
      const n = localStorage.getItem("mpcs_chat_name");
      if (n) {
        setVisitorName(n);
        convoRef.current.name = n;
      }

      // ✅ refresh කළත් chat එක close වෙන්නේ නෑ
      const t = localStorage.getItem("mpcs_chat_tab");
      if (t === "live" || t === "form" || t === "chat") setTab(t);
      if (localStorage.getItem("mpcs_chat_sound") === "0") {
        setSoundOn(false);
        soundRef.current = false;
      }
      if (localStorage.getItem("mpcs_chat_used") === "1") setLiveUsed(true);
      if (localStorage.getItem("mpcs_chat_min") === "1") {
        setMinimized(true);
        setOpen(true);
      } else if (localStorage.getItem("mpcs_chat_open") === "1") {
        setOpen(true);
      }
    } catch {
      /* private mode */
    }
  }, []);

  // ✅ state persist — open / minimized / tab / sound
  useEffect(() => {
    try {
      localStorage.setItem("mpcs_chat_open", open ? "1" : "0");
      localStorage.setItem("mpcs_chat_min", minimized ? "1" : "0");
      localStorage.setItem("mpcs_chat_tab", tab);
      localStorage.setItem("mpcs_chat_sound", soundOn ? "1" : "0");
      localStorage.setItem("mpcs_chat_used", liveUsed ? "1" : "0");
    } catch {
      /* ignore */
    }
    soundRef.current = soundOn;
  }, [open, minimized, tab, soundOn, liveUsed]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      if (!sessionRef.current) sessionRef.current = Math.random().toString(36).slice(2, 10);
      void logEvent("open", "", 0, sessionRef.current);
      void loadKnowledge().catch(() => undefined);
    }
  }, [open]);

  useEffect(() => {
    // user උඩට scroll කරලා කියවනවා නම් බලෙන් පහළට ඇදින්නේ නෑ
    if (!autoScroll) return;
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, panel, tab, autoScroll]);

  const closePanel = () => {
    setPanel(null);
    setTerm("");
    setCSent(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  async function runAction(key: ActionKey, responseSi: boolean = si) {
    if (key === "live") {
      setOfficerReplySi(responseSi);
      // ✅ නිලධාරියෙක් දැනටමත් join වී ඇත්නම් විතරක් Live Chat එක කෙලින්ම අරිනවා
      if (canUseLiveChat(liveStatus) || officerJoined) {
        setTab("live");
        setPanel(null);
        setLiveUsed(true);       // ✅ live chat පටන් ගත්තා → polling on
        setOfficerJoined(false);
        void logEvent("live_agent", "", 0, sessionRef.current);
        return;
      }
      // 🕘 කාර්යාල වේලාවෙන් පිටත නම් ඊළඟ විවෘත වේලාව පෙන්වනවා
      if (showLiveChatClosedNotice(responseSi)) return;
      // 🔒 direct live chat නෑ — Baymax හරහා ඇමතුමක් ඉල්ලා නිලධාරියා join වෙනකම් ඉන්න ඕන
      setTab("chat");
      setPanel(null);
      void logEvent("live_locked", "", 0, sessionRef.current);
      if (sessionActive) {
        push({
          from: "bot",
          bold: responseSi ? "⏳ ඔබේ ඉල්ලීම ලැබී ඇත" : "⏳ Your request has been received",
          text: responseSi
            ? "නිලධාරියෙක් join වුණු ගමන් මෙතැන කොළ පාට දැනුම්දීමක් එනවා — ඒ බොත්තම ඔබලා Live Chat එකට එන්න පුළුවන්. කරුණාකර ටිකක් රැඳී සිටින්න."
            : "As soon as an officer joins, a green button will appear here — tap it to enter the live chat. Please hang tight a moment.",
        });
        return;
      }
      push({
        from: "bot",
        bold: responseSi ? "🔒 Live Chat එක පටන් ගන්නේ නිලධාරියෙක් join වුණාමයි" : "🔒 Live chat starts when an officer joins",
        text: responseSi
          ? "මෙතැනින් කෙලින්ම chat පටන් ගන්න බෑ. මුලින් පහතින් ඔබේ විස්තර එවන්න — අපේ නිලධාරියෙක් join වුණු ගමන් ඔබට දැනුම් දීලා Live Chat එක unlock කරනවා."
          : "You can't start chatting from here directly. First send your details below — the moment our officer joins, we'll notify you and unlock the live chat.",
      });
      void runAction("contact", responseSi);
      return;
    }
    const my = ++flowRef.current;          // පරණ flow එක නවත්වයි
    setTab("chat");
    setTerm("");
    setCSent(false);
    setPanel(null);                        // පරණ panel එක වහනවා
    setAutoScroll(true);
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
        if (flowRef.current !== my) return;
        if (!units.length) {
          push({ from: "bot", text: si ? "දැනට ව්‍යාපාර තොරතුරු නොමැත." : "No business details available right now." });
          return;
        }
        // ✅ ව්‍යාපාර වල නම් සහිත බොත්තම් panel එක
        const list: ListItem[] = units.map((un) => {
          const ct = contacts.find((x) => x.business_slug === un.slug);
          return {
            label: (si ? un.name_si || un.name_en : un.name_en) ?? un.slug,
            sub: ct ? (ct.name ?? "").replace(/\s*\(manager\)\s*$/i, "").trim() : "",
            value: un.slug,
          };
        });
        push({
          from: "bot",
          bold: si ? "🏢 ව්‍යාපාර අංශ" : "🏢 Business Divisions",
          text: si
            ? "ඔබට අදාළ ව්‍යාපාරයේ බොත්තම ඔබන්න — කළමනාකරුගේ නම සහ දුරකථන අංකය එවන්නම්."
            : "Tap your business below — I'll show the manager's name and phone number.",
          card: "choices",
          list,
          action: "biz",
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
        if (!rows.length) {
          push({ from: "bot", text: si ? "දුරකථන තොරතුරු නොමැත." : "No phone numbers available." });
          return;
        }
        // ✅ අධ්‍යක්ෂවරුන්ගේ නම් සහිත බොත්තම් panel එක
        push({
          from: "bot",
          bold: si ? "☎️ කාර්යාල දුරකථන" : "☎️ Office Phones",
          text: si ? "අදාළ පුද්ගලයාගේ බොත්තම ඔබන්න — දුරකථන අංකය එවන්නම්." : "Tap a name below to see the phone number.",
          card: "choices",
          action: "board",
          list: rows.map((r, i) => ({
            label: (si ? r.name_si || r.name_en : r.name_en) ?? "—",
            sub: (si ? r.position_si || r.position_en : r.position_en) ?? "",
            value: String(i),
          })),
        });
      } catch {
        setTyping(false);
        push({ from: "bot", text: si ? "⚠ දත්ත ලබාගත නොහැකි විය." : "⚠ Could not load data." });
      }
      return;
    }

    if (key === "mphone") {
      // ✅ Office Phones වගේමයි — කළමනාකරුවන්ගේ නම් සහිත බොත්තම් panel එක,
      //    නමක් එබුවම ඒ කළමනාකරුගේ දුරකථන අංකය විතරක් පෙන්වයි
      setTyping(true);
      try {
        const sb = createAnonClient();
        const [{ data: u }, { data: c }] = await Promise.all([
          sb.from("business_units").select("slug,name_en,name_si").order("order"),
          sb.from("business_contacts").select("id,business_slug,name,phone,role_en,role_si").limit(200),
        ]);
        type U = { slug: string; name_en?: string; name_si?: string };
        type C = { id?: string; business_slug: string; name?: string; phone?: string; role_en?: string; role_si?: string };
        const units = (u ?? []) as U[];
        const contacts = (c ?? []) as C[];
        setTyping(false);
        if (flowRef.current !== my) return;
        if (!contacts.length) {
          push({ from: "bot", text: si ? "දැනට දුරකථන තොරතුරු නොමැත." : "No phone details available right now." });
          return;
        }
        // ව්‍යාපාර අංශ පිළිවෙළට, ඊට පස්සේ නමින් sort කරයි
        const unitIndex = new Map(units.map((un, i) => [un.slug, i] as const));
        const sorted = [...contacts].sort((a, b) => {
          const d = (unitIndex.get(a.business_slug) ?? 999) - (unitIndex.get(b.business_slug) ?? 999);
          return d !== 0 ? d : String(a.name ?? "").localeCompare(String(b.name ?? ""));
        });
        push({
          from: "bot",
          bold: si ? "📞 කළමනාකරුවන්ගේ දුරකථන" : "📞 Managers’ Phone Numbers",
          text: si ? "අදාළ කළමනාකරුගේ නම ඔබන්න — දුරකථන අංකය එවන්නම්." : "Tap a manager’s name below — I’ll show the phone number.",
          card: "choices",
          action: "mphone",
          list: sorted.map((ct) => {
            const unit = units.find((x) => x.slug === ct.business_slug);
            const unitName = si ? unit?.name_si || unit?.name_en || ct.business_slug : unit?.name_en || ct.business_slug;
            const manager = (ct.name ?? "").replace(/\s*\(manager\)\s*$/i, "").trim();
            const role = si ? ct.role_si || ct.role_en : ct.role_en || ct.role_si;
            return {
              label: manager || unitName,
              sub: `🏢 ${unitName}${role ? ` · ${role}` : ""}`,
              value: String(ct.id ?? ""),
            };
          }),
        });
      } catch {
        setTyping(false);
        push({ from: "bot", text: si ? "⚠ දත්ත ලබාගත නොහැකි විය." : "⚠ Could not load data." });
      }
      return;
    }

    if (key === "fuel") {
      await showFuelPicker();
      return;
    }

    if (key === "news") {
      await showNews(null);
      return;
    }

    if (key === "gallery") {
      await showGallery();
      return;
    }

    if (key === "contact") {
      setOfficerReplySi(responseSi);
      if (showLiveChatClosedNotice(responseSi)) return;
      setTab("chat");
      setPanel("contact");
      setCSent(false);
      push({
        from: "bot",
        bold: responseSi ? "📨 සජීවී සම්බන්ධය" : "📨 Contact Live Chat",
        text: responseSi
          ? "ඔබේ නම, NIC සහ දුරකථන අංකය පහත ඇතුළත් කර Submit කරන්න.\nඅපගේ නිලධාරියෙක් ඉක්මනින් ඔබට කතා කරනවා."
          : "Enter your Name, NIC and Phone Number below, then press Submit.\nOne of our officers will contact you shortly.",
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  FUEL · NEWS · GALLERY (③) — තෝරන්න → විස්තරය එන interactive flows
  // ─────────────────────────────────────────────────────────────────────────

  /** fuel_prices (live DB) + seed fallback — data.ts getFuelPrices() වගෙම merge එකක් */
  async function loadFuelPrices(): Promise<FuelPrice[]> {
    try {
      const sb = createAnonClient();
      const { data, error } = await sb.from("fuel_prices").select("*").limit(10);
      if (error || !data || !data.length) return FUEL_PRICES;
      const byType = new Map<string, number>();
      for (const r of data as { type?: string; fuel_type?: string; price?: number | string }[]) {
        const t = r.type ?? r.fuel_type;
        if (t && r.price != null) byType.set(String(t), Number(r.price));
      }
      return FUEL_PRICES.map((f) => (byType.has(f.type) ? { ...f, price: byType.get(f.type)! } : f));
    } catch {
      return FUEL_PRICES;
    }
  }

  const fmtRs = (v: number) => `රු. ${Number(v).toLocaleString("en-LK")}`;
  const fmtRsEn = (v: number) => `Rs. ${Number(v).toLocaleString("en-LK")}`;

  function fmtDate(d?: string): string {
    if (!d) return "";
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString(si ? "si-LK" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  }

  /** ⛽ "fuel prices" ගැහුවාම — මුලින්ම ඉන්ධනය තෝරන මෙනුව, මිල පෙන්වන්නේ තේරුවට පස්සේ */
  async function showFuelPicker() {
    const myFlow = flowRef.current;
    setTyping(true);
    const prices = await loadFuelPrices();
    setTyping(false);
    if (flowRef.current !== myFlow) return; // close/clear කළා නම් පරණ පිළිතුර නොදක්වයි
    const list: ListItem[] = prices.map((p) => ({
      label: (si ? p.name_si || p.name_en : p.name_en) ?? p.type,
      sub: si ? `${p.tag}${p.name_en && p.name_en !== p.tag ? ` · ${p.name_en}` : ""}` : p.tag,
      value: p.type,
    }));
    list.push({
      label: si ? "සියලුම මිල ගණන් එකවර" : "All prices at once",
      sub: si ? "ඉන්ධන වර්ග සියල්ලම" : "Every fuel type",
      value: "__all",
    });
    push({
      from: "bot",
      bold: si ? "⛽ ඉන්ධන මිල ගණන්" : "⛽ Fuel Prices",
      text: si
        ? "ඔබට මිල බලන්න ඕන ඉන්ධන වර්ගය තෝරන්න 👇\nතෝරාපු ගමන් අද මිල එවන්නම්."
        : "Choose the fuel type you want 👇\nI'll show today's price as soon as you pick one.",
      card: "choices",
      list,
      action: "fuel",
    });
    convoRef.current.lastIntent = "fuel";
    void logEvent("fuel_picker", "", prices.length, sessionRef.current);
  }

  /** තෝරපු ඉන්ධන වර්ගයක මිල */
  async function showFuelPrice(type: FuelPrice["type"]) {
    const myFlow = flowRef.current;
    setTyping(true);
    const prices = await loadFuelPrices();
    setTyping(false);
    if (flowRef.current !== myFlow) return;
    const p = prices.find((x) => x.type === type);
    if (!p) {
      await showFuelPicker();
      return;
    }
    const name = (si ? p.name_si || p.name_en : p.name_en) ?? p.type;
    const others = prices.filter((x) => x.type !== type);
    push({
      from: "bot",
      bold: `⛽ ${name} (${p.tag})`,
      text: si
        ? `💰 අද මිල: ${fmtRs(p.price)} / ලීටරය\n📍 අපේ හෙට්ටිපොල සමූපකාර ඉන්ධන පිරවුම්හලේ නිල සිල්ලර මිලයි.\nℹ️ මිල ගණන් වෙනස් විය හැක — තහවුරු කිරීමට ${SITE.phones[0]} අමතන්න.`
        : `💰 Today's price: ${fmtRsEn(p.price)} / litre\n📍 Official retail price at our Hettipola Co-operative Fuel Station.\nℹ️ Prices may change — call ${SITE.phones[0]} to confirm.`,
      chips: [...others.map((x) => (si ? x.name_si || x.name_en : x.name_en)), si ? "ඉන්ධන මිල" : "Fuel Prices"],
      link: { href: "/businesses/fuel-station", label: si ? "ඉන්ධන පිරවුම්හල පිටුව අරින්න" : "Open the Fuel Station page" },
    });
    convoRef.current.lastIntent = "fuel";
    void logEvent("fuel_price", type, 1, sessionRef.current);
  }

  /** ඉන්ධන මිල සියල්ලම එකවර */
  async function showAllFuelPrices() {
    const myFlow = flowRef.current;
    setTyping(true);
    const prices = await loadFuelPrices();
    setTyping(false);
    if (flowRef.current !== myFlow) return;
    push({
      from: "bot",
      bold: si ? "⛽ අද ඉන්ධන මිල ගණන්" : "⛽ Today's Fuel Prices",
      text:
        prices.map((p) => `• ${si ? p.name_si || p.name_en : p.name_en} — ${si ? fmtRs(p.price) : fmtRsEn(p.price)} / ${si ? "ලීටරය" : "L"}`).join("\n") +
        (si ? `\n\n📍 හෙට්ටිපොල සමූපකාර ඉන්ධන පිරවුම්හල · ${SITE.phones[0]}` : `\n\n📍 Hettipola Co-operative Fuel Station · ${SITE.phones[0]}`),
      chips: si ? ["ඉන්ධන මිල", "නිවේදන හා පුවත්"] : ["Fuel Prices", "News"],
      link: { href: "/businesses/fuel-station", label: si ? "ඉන්ධන පිරවුම්හල පිටුව අරින්න" : "Open the Fuel Station page" },
    });
    convoRef.current.lastIntent = "fuel";
    void logEvent("fuel_all", "", prices.length, sessionRef.current);
  }

  const NEWS_CAT: Record<string, { en: string; si: string; emoji: string }> = {
    vacancy: { en: "Job Vacancy", si: "රැකියා නිවේදන", emoji: "💼" },
    notice: { en: "Special Notice", si: "විශේෂ නිවේදන", emoji: "📢" },
    tender: { en: "Tender", si: "ටෙන්ඩර්", emoji: "📄" },
    general: { en: "News & Updates", si: "පුවත් හා යාවත්කාලීන", emoji: "📰" },
  };

  /** 📰 publish වුණු (published=true) නිවේදන හා පුවත් — pinned මුලින්ම, අලුත්ම මුලින් */
  async function showNews(category: "vacancy" | "tender" | null) {
    const myFlow = flowRef.current;
    setTyping(true);
    let rows: NewsItem[] = [];
    try {
      const sb = createAnonClient();
      let q = sb.from("news").select("*").eq("published", true);
      if (category) q = q.eq("category", category);
      const { data, error } = await q.order("pinned", { ascending: false }).order("date", { ascending: false }).limit(6);
      if (error || !data) throw new Error(error?.message ?? "no data");
      rows = data as unknown as NewsItem[];
    } catch {
      rows = NEWS.filter((n) => n.published && (!category || n.category === category));
    }
    setTyping(false);
    if (flowRef.current !== myFlow) return;
    const catLabel = category ? (si ? NEWS_CAT[category].si : NEWS_CAT[category].en) : si ? "නිවේදන හා පුවත්" : "News & Notices";
    if (!rows.length) {
      push({
        from: "bot",
        bold: si ? "📰 පුවත් නොමැත" : "📰 No news yet",
        text: si
          ? `දැනට “${catLabel}” යටතේ ප්‍රකාශ කළ (published) අයිතම නැත. අලුත් එකක් දාපු ගමන් මෙතන පේනවා.`
          : `There are no published items under “${catLabel}” right now. New posts will appear here as soon as they go live.`,
        chips: si ? ["නිවේදන හා පුවත්", "ගැලරිය"] : ["News", "Gallery"],
        link: { href: "/news", label: si ? "පුවත් පිටුව අරින්න" : "Open the News page" },
      });
      void logEvent("news", category ?? "all", 0, sessionRef.current);
      return;
    }
    const items: RichItem[] = rows.slice(0, 6).map((n) => {
      const cat = NEWS_CAT[n.category] ?? NEWS_CAT.general;
      const badge = si ? cat.si : n.badge_text || cat.en;
      return {
        id: String(n.id),
        title: (si ? n.title_si || n.title_en : n.title_en || n.title_si) ?? "—",
        sub: `${cat.emoji} ${badge}${n.date ? ` · 📅 ${fmtDate(n.date)}` : ""}${n.pinned ? (si ? " · 📌 ඉහළින්ම" : " · 📌 Pinned") : ""}`,
        desc: (si ? n.desc_si || n.desc_en : n.desc_en || n.desc_si) ?? "",
        image: n.image || "",
        badge,
      };
    });
    push({
      from: "bot",
      bold: `📰 ${catLabel}`,
      text: si
        ? `ප්‍රකාශ කළ (published) අලුත්ම අයිතම ${items.length}ක් 👇\nසම්පූර්ණ විස්තරය බලන්න එකක් ඔබන්න.`
        : `The latest ${items.length} published item${items.length > 1 ? "s" : ""} 👇\nTap one to read the full details.`,
      card: "news",
      items,
      link: { href: "/news", label: si ? "සියලුම පුවත් — පුවත් පිටුව අරින්න" : "All news — open the News page" },
    });
    convoRef.current.lastIntent = "news";
    void logEvent("news", category ?? "all", items.length, sessionRef.current);
  }

  /** 🖼️ publish කළ ගැලරි ඡායාරූප — tagline (title + description) සමඟ */
  async function showGallery() {
    const myFlow = flowRef.current;
    setTyping(true);
    let rows: GalleryItem[] = [];
    try {
      const sb = createAnonClient();
      const { data, error } = await sb.from("gallery_items").select("*").limit(8);
      if (error || !data || !data.length) throw new Error(error?.message ?? "no data");
      rows = data as unknown as GalleryItem[];
    } catch {
      rows = GALLERY;
    }
    setTyping(false);
    if (flowRef.current !== myFlow) return;
    if (!rows.length) {
      push({
        from: "bot",
        bold: si ? "🖼️ ගැලරිය" : "🖼️ Gallery",
        text: si ? "දැනට ගැලරියේ ප්‍රකාශ කළ ඡායාරූප නැත." : "No published gallery photos right now.",
        link: { href: "/gallery", label: si ? "ගැලරි පිටුව අරින්න" : "Open the Gallery page" },
      });
      void logEvent("gallery", "", 0, sessionRef.current);
      return;
    }
    const items: RichItem[] = rows.slice(0, 8).map((g) => ({
      id: String(g.id),
      title: g.title || "—",
      desc: g.description || "",
      image: g.image || "",
      sub: typeof g.likes === "number" && g.likes > 0 ? `❤️ ${g.likes}` : "",
    }));
    push({
      from: "bot",
      bold: si ? "🖼️ අපේ ගැලරිය" : "🖼️ Our Gallery",
      text: si
        ? `ප්‍රකාශ කළ ඡායාරූප ${items.length}ක් — මාතෘකාව සහ විස්තරය සමඟ 👇\nවිස්තරය බලන්න ඡායාරූපයක් ඔබන්න.`
        : `${items.length} published photo${items.length > 1 ? "s" : ""} with their captions 👇\nTap a photo to see its details.`,
      card: "gallery",
      items,
      link: { href: "/gallery", label: si ? "සියලුම ඡායාරූප — ගැලරි පිටුව අරින්න" : "All photos — open the Gallery page" },
    });
    convoRef.current.lastIntent = "gallery";
    void logEvent("gallery", "", items.length, sessionRef.current);
  }

  // ── business / board / fuel / manager-phone button එකක් එබුවම ──
  async function pickFromList(action: "biz" | "board" | "fuel" | "mphone", value: string, label: string) {
    push({ from: "me", text: label });
    if (action === "fuel") {
      if (value === "__all") await showAllFuelPrices();
      else await showFuelPrice(value as FuelPrice["type"]);
      return;
    }
    setTyping(true);
    try {
      const sb = createAnonClient();
      if (action === "biz") {
        const [{ data: u }, { data: c }] = await Promise.all([
          sb.from("business_units").select("slug,name_en,name_si").eq("slug", value).limit(1),
          sb.from("business_contacts").select("name,phone,role_en,role_si,location").eq("business_slug", value).limit(10),
        ]);
        setTyping(false);
        const unit = (u ?? [])[0] as { name_en?: string; name_si?: string } | undefined;
        const cs = (c ?? []) as { name?: string; phone?: string; role_en?: string; role_si?: string; location?: string }[];
        const unitName = (si ? unit?.name_si || unit?.name_en : unit?.name_en) ?? label;
        if (!cs.length) {
          push({ from: "bot", bold: `🏢 ${unitName}`, text: si ? "මෙම අංශයට කළමනාකරු තොරතුරු නොමැත." : "No manager details for this division." });
          return;
        }
        push({
          from: "bot",
          bold: `🏢 ${unitName}`,
          text: cs
            .map((x) => {
              const role = si ? x.role_si || x.role_en : x.role_en || x.role_si;
              const nm = (x.name ?? "").replace(/\s*\(manager\)\s*$/i, "").trim();
              return `${si ? "👤 කළමනාකරු" : "👤 Manager"}: ${nm || "—"}${role ? `\n🏷 ${role}` : ""}\n📞 ${x.phone || "—"}${x.location ? `\n📍 ${x.location}` : ""}`;
            })
            .join("\n\n"),
          chips: si ? ["ව්‍යාපාර කළමනාකරුවන්", "සජීවී චැට්"] : ["Business Managers", "Live Chat"],
        });
      } else if (action === "board") {
        const { data } = await sb
          .from("board_members")
          .select("name_en,name_si,position_en,position_si,phone,email")
          .order("order");
        setTyping(false);
        const rows = (data ?? []) as { name_en?: string; name_si?: string; position_en?: string; position_si?: string; phone?: string; email?: string }[];
        const r = rows[Number(value)];
        if (!r) {
          push({ from: "bot", text: si ? "තොරතුරු හමු නොවීය." : "Details not found." });
          return;
        }
        push({
          from: "bot",
          bold: (si ? r.name_si || r.name_en : r.name_en) ?? label,
          text: `${(si ? r.position_si || r.position_en : r.position_en) ?? ""}\n📞 ${r.phone || "—"}${r.email ? `\n📧 ${r.email}` : ""}`,
          chips: si ? ["කාර්යාල දුරකථන", "ඇමතුමක් ඉල්ලන්න"] : ["Office Phones", "Request a Call"],
        });
      } else {
        // 📞 Managers Phones — තෝරපු කළමනාකරුගේ දුරකථන අංකය (contact id එකෙන් හොයයි)
        const [{ data: c }, { data: u }] = await Promise.all([
          sb.from("business_contacts").select("id,business_slug,name,phone,role_en,role_si,location,note_en,note_si").eq("id", value).limit(1),
          sb.from("business_units").select("slug,name_en,name_si"),
        ]);
        setTyping(false);
        type MC = { business_slug: string; name?: string; phone?: string; role_en?: string; role_si?: string; location?: string; note_en?: string; note_si?: string };
        const ct = (c ?? [])[0] as MC | undefined;
        if (!ct) {
          push({ from: "bot", text: si ? "තොරතුරු හමු නොවීය." : "Details not found." });
          return;
        }
        const units = (u ?? []) as { slug: string; name_en?: string; name_si?: string }[];
        const unit = units.find((x) => x.slug === ct.business_slug);
        const unitName = (si ? unit?.name_si || unit?.name_en : unit?.name_en) ?? ct.business_slug;
        const manager = (ct.name ?? "").replace(/\s*\(manager\)\s*$/i, "").trim() || label;
        const role = si ? ct.role_si || ct.role_en : ct.role_en || ct.role_si;
        const note = si ? ct.note_si || ct.note_en : ct.note_en || ct.note_si;
        const phone = (ct.phone ?? "").trim();
        push({
          from: "bot",
          bold: `👤 ${manager}`,
          text: `🏢 ${unitName}${role ? `\n🏷 ${role}` : ""}\n📞 ${phone || "—"}${ct.location ? `\n📍 ${ct.location}` : ""}${note ? `\n📝 ${note}` : ""}`,
          chips: si ? ["කළමනාකරු දුරකථන", "ව්‍යාපාර කළමනාකරුවන්"] : ["Managers Phones", "Business Managers"],
          link: phone ? { href: `tel:${phone.replace(/[^\d+]/g, "")}`, label: si ? `📞 ${phone} කෙලින්ම අමතන්න` : `📞 Call ${phone}` } : undefined,
        });
      }
    } catch {
      setTyping(false);
      push({ from: "bot", text: si ? "⚠ දත්ත ලබාගත නොහැකි විය." : "⚠ Could not load data." });
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
    // ✅ "ඉඳුවර කුමාරතුංග" → වචන දෙකම තියෙන සියලු අය (පිළිවෙළ වැදගත් නෑ)
    const toks = tokens(raw).map((t) => t.replace(/[%,()*]/g, "")).filter(Boolean);
    const FIELDS = "member_no,full_name,nic,address,postal_address,gender,file_name";
    const orFor = (t: string) => `or(full_name.ilike.*${t}*,nic.ilike.*${t}*,member_no.ilike.*${t}*)`;
    // PostgREST nested logic — or=(and(or(...),or(...)))
    const q1 = toks.length > 1 ? `(and(${toks.map(orFor).join(",")}))` : orFor(safe);
    try {
      const sb = createAnonClient();
      let { data, error } = await sb.from("member_rows").select(FIELDS).or(q1).limit(40);
      // exact tokens වලින් නැත්නම් — වචනයක් වත් ගැළපෙන ඒවා
      if (!error && (!data || data.length === 0) && toks.length > 1) {
        const r2 = await sb.from("member_rows").select(FIELDS).or(`(${toks.map(orFor).join(",")})`).limit(40);
        data = r2.data;
        error = r2.error;
      }
      setTyping(false);
      setBusy(false);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as MemberRow[];
      void logEvent("search", raw, rows.length, sessionRef.current);
      if (rows.length) {
        push({
          from: "bot",
          bold: si ? `✅ ප්‍රතිඵල ${rows.length}${rows.length >= 40 ? "+" : ""}` : `✅ ${rows.length}${rows.length >= 40 ? "+" : ""} result${rows.length > 1 ? "s" : ""}`,
          text: si
            ? `“${raw}” සමඟ ගැළපෙන සාමාජිකයන් ${rows.length}ක්. එක් අයෙකුගේ නම ඔබන්න — සම්පූර්ණ විස්තර පෙන්නන්නම්.`
            : `${rows.length} match${rows.length > 1 ? "es" : ""} for “${raw}”. Tap a name to see full details.`,
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
    const responseSi = contactReplySi;
    const name = cName.trim();
    const nic = cNic.trim();
    const phone = cPhone.trim();
    if (!name || !nic || !phone) return;
    // 🕘 form එක ඇරලා තියෙද්දී කාර්යාල වේලාව ඉවර වුණොත් ඉල්ලීම නොයවයි
    if (showLiveChatClosedNotice(responseSi)) return;
    setBusy(true);
    const ref = `LC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    push({ from: "me", text: `${name} · ${nic} · ${phone}` });
    try {
      // ✅ ㉕ Admin → Emails → "Live Chat Requests & Callbacks" route එකේ හැම ලිපිනයකටම
      const { sendToRoute } = await import("@/lib/mail-routes");
      await sendToRoute("livechat", {
        _subject: `🔔 Live Chat contact request — ${name} (${ref})`,
        _template: "table",
        Source: "Website Live Chat — Contact Request",
        Reference: ref,
        Name: name,
        NIC: nic,
        Phone: phone,
        Message: "A visitor requested an officer to contact them via the live chat widget.",
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

    // ✅ admin ට Live Chats ලැයිස්තුවේ පේන්න session එකක් හදනවා (නම · දුරකථන · reference)
    const cbNote = `📞 Callback request · ${ref} · NIC ${nic} · ${phone}`;
    try {
      const sb = createAnonClient();
      const key = sessionKey || sessionRef.current;
      const { error } = await sb.rpc("chat_identify", { p_session: key, p_name: name, p_phone: phone, p_note: cbNote });
      // SQL block එක තවම run කරලා නැත්නම් — session එක හදලා note එක යවන පරණ ක්‍රමයට වැටෙනවා
      if (error) {
        await sb.rpc("chat_start", { p_session: key });
        await sb.rpc("chat_send", { p_session: key, p_body: cbNote, p_name: name });
      }
      setSessionActive(true);
      try { localStorage.setItem("mpcs_chat_request", "1"); } catch { /* ignore */ }
    } catch {
      /* ignore */
    }

    setBusy(false);
    setCName("");
    setCNic("");
    setCPhone("");
    setPanel(null);
    setCSent(true);
    push({
      from: "bot",
      bold: responseSi ? "✅ ඉල්ලීම යවන ලදි" : "✅ Request sent",
      text: responseSi
        ? "ඔබේ තොරතුරු අපගේ කාර්යාලයට ලැබුණා.\nතහවුරු කිරීමේ email එකක් ද යවා ඇත.\n\n⏱ විනාඩි කීපයක් ඇතුළත අපගේ නිලධාරියෙක් ඔබට කතා කරනවා.\n\nකරුණාකර දුරකථනය ළඟ රැඳී සිටින්න."
        : "Your details have reached our office and a confirmation email was sent.\n\n⏱ Our officer will contact you within a few minutes.\n\nPlease keep your phone close.",
      card: "waiting",
      ref,
    });
    setTimeout(() => setCSent(false), 8000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  LIVE AGENT (2-way with admin)
  // ─────────────────────────────────────────────────────────────────────────
  // ── notification sound (Web Audio — file එකක් ඕන නෑ) ──
  function unlockAudio() {
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        audioRef.current = new AC();
      }
      if (audioRef.current.state === "suspended") void audioRef.current.resume();
    } catch {
      /* ignore */
    }
  }

  function ping() {
    if (!soundRef.current) return;
    try {
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, t0);
      o.frequency.exponentialRampToValueAtTime(1320, t0 + 0.12);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.55);
    } catch {
      /* browser blocked */
    }
  }

  async function pull(reset = false) {
    if (!sessionKey) return;
    try {
      const sb = createAnonClient();
      // ✅ user "End & clear" කළා නම් ඒ වෙලාවට පස්සේ එන messages විතරයි (admin history එහෙමම)
      let clearedAt = clearedAtRef.current || "1970-01-01T00:00:00Z";
      if (!clearedAtRef.current) {
        try {
          clearedAt = localStorage.getItem("mpcs_chat_cleared_at") || clearedAt;
          clearedAtRef.current = clearedAt;
        } catch {
          /* ignore */
        }
      }
      const { data, error } = await sb.rpc("chat_sync", {
        p_session: sessionKey,
        p_after: reset ? clearedAt : lastTs.current,
      });
      if (error || !data) return;
      const d = data as { status?: string; agent?: string; typing?: boolean; messages?: LiveMsg[] };
      const nextStatus = (d.status as "open" | "joined" | "closed") ?? "open";
      const prevStatus = liveStatus;
      setLiveStatus(nextStatus);
      setAgentName(d.agent ?? "");
      // ✅ admin join වුණා → "Live Chat" callout එක පෙන්නන්න (tab එකේ නැත්නම්)
      if (nextStatus === "joined" && prevStatus !== "joined") {
        setOfficerJoined(true);
        ping();
        if (tab !== "live" || !open) setUnread((u) => u + 1);
      }
      if (nextStatus === "closed") setOfficerJoined(false);
      // ✅ chat එක close නම් "Officer is typing" කවදාවත් පෙන්වන්නේ නෑ (stale typing flag එකත් අයින් වෙනවා)
      setAgentTyping(shouldShowTyping(nextStatus, Boolean(d.typing)));
      const list = d.messages ?? [];
      if (reset) {
        setLiveMsgs(list);
        lastTs.current = list.length ? list[list.length - 1].created_at : clearedAt;
      } else if (list.length) {
        const seen = new Set(liveMsgs.map((m) => m.id));
        const fresh = list.filter((m) => !seen.has(m.id));
        const newAgent = fresh.filter((m) => m.sender === "agent");
        setLiveMsgs((xs) => {
          const s2 = new Set(xs.map((m) => m.id));
          return [...xs, ...fresh.filter((m) => !s2.has(m.id))];
        });
        lastTs.current = list[list.length - 1].created_at;
        if (newAgent.length) {
          ping();                                   // 🔔 admin message → sound
          if (tab !== "live" || !open) setUnread((u) => u + newAgent.length);
        }
      }
      setLiveErr("");
    } catch {
      /* tables not created yet — silently ignore */
    }
  }

  useEffect(() => {
    if (!sessionKey || (!liveUsed && !sessionActive)) return;
    let alive = true;
    (async () => {
      try {
        const sb = createAnonClient();
        await sb.rpc("chat_start", { p_session: sessionKey });
        if (alive) await pull(true);
      } catch {
        /* ignore */
      }
    })();
    // live tab එකේ නම් 2.5s · callback request එකක් විතරක් තියෙනවා නම් 6s (admin join වුණාම දැනගන්න)
    const every = liveUsed ? 2500 : 6000;
    const t = setInterval(() => {
      if (alive) void pull();
    }, every);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sessionKey, liveUsed, sessionActive]);

  useEffect(() => {
    liveBoxRef.current?.scrollTo({ top: liveBoxRef.current.scrollHeight, behavior: "smooth" });
  }, [liveMsgs, liveStatus]);

  useEffect(() => {
    if (tab === "live" && open) setOfficerJoined(false);
  }, [tab, open]);

  // ✅ page reload වුණත් callback request එක තියෙනවා නම් officer join වීම දිගටම බලනවා
  useEffect(() => {
    try {
      if (localStorage.getItem("mpcs_chat_request") === "1") setSessionActive(true);
    } catch {
      /* ignore */
    }
  }, []);

  function onLiveType(v: string) {
    setLiveText(v);
    const now = Date.now();
    if (!sessionKey || now - typingAt.current < 2500) return;
    typingAt.current = now;
    try {
      void createAnonClient().rpc("chat_typing", { p_session: sessionKey });
    } catch {
      /* ignore */
    }
  }

  // ✅ chat එක සම්පූර්ණයෙන්ම close — Live history එකත් Baymax history එකත්
  //    visitor පැත්තෙන් අයින් වේ (admin history එක server එකේ ඉතුරු වේ)
  async function endChat() {
    // 🧹 Baymax කතාබහත් ඔක්කොම අයින් කර welcome එකෙන් අලුතින් පටන් ගනී
    resetBaymaxConversation();
    setTab("chat");
    setLiveText("");
    setLiveErr("");
    if (!sessionKey) {
      setLiveMsgs([]);
      setLiveStatus("closed");
      setAgentTyping(false);
      setOpen(false);
      setMinimized(false);
      return;
    }
    // ⚡ marker + UI clear කලින්ම (poll එකට කලින් වැදගත්)
    clearedAtRef.current = new Date().toISOString();
    try {
      localStorage.setItem("mpcs_chat_cleared_at", clearedAtRef.current);
      localStorage.setItem("mpcs_chat_open", "0");
      localStorage.setItem("mpcs_chat_min", "0");
      localStorage.setItem("mpcs_chat_used", "0");
      localStorage.removeItem("mpcs_chat_request");
    } catch {
      /* ignore */
    }
    setLiveMsgs([]);
    lastTs.current = clearedAtRef.current;
    setLiveStatus("closed");
    setAgentTyping(false);
    setOpen(false);
    setMinimized(false);
    setLiveUsed(false);
    setSessionActive(false);   // ✅ clear කළාට පස්සේ officer-join poll එකත් නවතිනවා
    setOfficerJoined(false);
    void logEvent("chat_closed", "", 0, sessionRef.current);

    // DB එකට දැනුම් දීම පස්සේ (admin history එකේ "chat ended" note එක එකතු වේ)
    try {
      await createAnonClient().rpc("chat_close", {
        p_session: sessionKey,
        p_note: si ? "පැමිණිල්ල අවසන් කළා" : "Chat ended by visitor",
      });
    } catch {
      /* RPC not created yet — ප්‍රශ්නයක් නෑ */
    }

    // ✅ clear කළාට පස්සේ නැවත ඇරියත් "Chat ended" note එකවත් පරණ typing එකවත්
    //    ආයේ නොපෙනෙන්න — note එක DB එකට ගිය පසු marker එක අලුතින් stamp කරයි
    //    (admin history එක server එකේ නොවෙනස්ව ඉතුරු වේ · අලුත් msg ආවොත් පේනවා)
    clearedAtRef.current = new Date().toISOString();
    try {
      localStorage.setItem("mpcs_chat_cleared_at", clearedAtRef.current);
    } catch {
      /* ignore */
    }
    setLiveMsgs([]);
    lastTs.current = clearedAtRef.current;
    setAgentTyping(false);
  }

  async function sendLive() {
    const body = liveText.trim();
    if (!body || !sessionKey || liveBusy) return;
    // 🔒 නිලධාරියෙක් join වී නැත්නම් පණිවිඩ යැවිය නොහැකියි
    if (!canUseLiveChat(liveStatus)) {
      setLiveErr(si ? "🔒 නිලධාරියෙක් join වන තුරු පණිවිඩ යැවිය නොහැකිය" : "🔒 You can send messages once an officer joins");
      return;
    }
    setLiveUsed(true);
    setLiveText("");
    setLiveBusy(true);
    try {
      if (visitorName.trim()) localStorage.setItem("mpcs_chat_name", visitorName.trim());
      const sb = createAnonClient();
      const { error } = await sb.rpc("chat_send", {
        p_session: sessionKey,
        p_body: body,
        p_name: visitorName.trim(),
      });
      if (error) throw new Error(error.message);
      await pull();
    } catch {
      setLiveErr(si ? "⚠ යැවීමට බැරි විය — නැවත උත්සාහ කරන්න" : "⚠ Could not send — please try again");
    }
    setLiveBusy(false);
  }

  /**
   * 🕘 කාර්යාල වේලාවෙන් පිටත Live Chat නිලධාරියෙක් ඉල්ලුවොත් — ඉල්ලීම
   * නොයවා, ඊළඟට විවෘත වන වේලාව කියා දෙනවා. දැනටමත් join වී ඇති
   * සංවාදයකට මෙයින් බාධාවක් නෑ. @returns වසා ඇති බව දැනුම් දුන්නා නම් true
   */
  function showLiveChatClosedNotice(responseSi: boolean = contactReplySi): boolean {
    setOfficerReplySi(responseSi);
    const status = getLiveChatHoursStatus();
    setLiveHours(status);
    if (status.open || canUseLiveChat(liveStatus)) return false;
    setTab("chat");
    setPanel(null);
    setCSent(false);
    push({
      from: "bot",
      bold: responseSi ? "🕘 Live Chat දැන් වසා ඇත" : "🕘 Live Chat is closed right now",
      text: responseSi
        ? `මේ වෙලාවේ සජීවී නිලධාරියෙක් සම්බන්ධ කර ගැනීම අපහසුයි.\nකරුණාකර ${nextLiveChatOpenPhrase(true)} නැවත සම්බන්ධ වෙන්න.\n\nLive Chat වේලාවන්:\nසඳුදා – සිකුරාදා : පෙ.ව. 8.30 – ප.ව. 5.30\nසෙනසුරාදා : පෙ.ව. 8.30 – ප.ව. 1.30\nඉරිදා : වසා ඇත\n\nඊට අතරතුරු මට (Baymax) ඕනෑම දෙයක් අහන්න පුළුවන්. පණිවිඩයක් තියන්න ඕන නම් උඩ තියෙන “පණිවිඩය” tab එක පාවිච්චි කරන්න — නිලධාරීන් ඊළඟ කාර්යාල වේලාවේදී එය බලනවා.`
        : `It's difficult to connect you with a live officer at this time.\nPlease reconnect ${nextLiveChatOpenPhrase(false)}.\n\nLive Chat hours:\nMonday – Friday : 8:30 AM – 5:30 PM\nSaturday : 8:30 AM – 1:30 PM\nSunday : Closed\n\nIn the meantime, you can ask me (Baymax) anything. If you'd like to leave a message, use the “Message” tab above — our officers will see it during the next office hours.`,
      chips: si ? MENU_CHIPS_SI : MENU_CHIPS_EN,
    });
    void logEvent("live_outside_hours", "", 0, sessionRef.current);
    return true;
  }

  // ── "Do you want to contact an officer?" — Yes / No ──
  function askOfficer(responseSi: boolean = contactReplySi) {
    setOfficerReplySi(responseSi);
    if (showLiveChatClosedNotice(responseSi)) return;
    setTab("chat");
    setPanel(null);
    setCSent(false);
    push({
      from: "bot",
      bold: responseSi ? "🤝 නිලධාරියෙක් සම්බන්ධ කරගන්නද?" : "🤝 Do you want to contact an officer?",
      text: responseSi
        ? "අපගේ නිලධාරියෙක් ඔබට කෙලින්ම කතා කරන්න පුළුවන්.\nඔබේ නම, NIC සහ දුරකථන අංකය දුන්නොත් විනාඩි කීපයක් ඇතුළත අපි සම්බන්ධ කරගන්නම්."
        : "One of our officers can call you back directly.\nShare your name, NIC and phone number and we will contact you within a few minutes.",
      choices: [
        { label: responseSi ? "ඔව්, සම්බන්ධ කරගන්න" : "Yes, contact me", kind: "yes" },
        { label: responseSi ? "නෑ, පස්සේ" : "No, not now", kind: "no" },
      ],
    });
    void logEvent("ask_officer", "", 0, sessionRef.current);
  }

  function declineContact(responseSi: boolean = contactReplySi) {
    push({
      from: "bot",
      bold: responseSi ? "🙏 කමක් නෑ" : "🙏 No problem",
      text: responseSi
        ? "ඕනෑම වෙලාවක “Contact Live Chat” බොත්තමෙන් අපිට කියන්න පුළුවන්.\n📞 දැන්ම කතා කරන්න ඕන නම්: " + SITE.phones[0]
        : "You can reach us anytime with the “Contact Live Chat” button.\n📞 To talk right now: " + SITE.phones[0],
      chips: responseSi ? ["කාර්යාල වේලාවන්", "සාමාජික සොයන්න"] : ["Office hours", "Find Member"],
    });
    void logEvent("decline_officer", "", 0, sessionRef.current);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  TEXT BOT (existing brains + shortcuts)
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // SITE BRAIN — live public website content + seed fallback
  // ─────────────────────────────────────────────────────────────────────────

  function seedKnowledgeData(): KnowledgeSourceData {
    return {
      businesses: BUSINESSES,
      board: BOARD,
      ruralBranches: RURAL_BANK_BRANCHES,
      news: NEWS,
      gallery: GALLERY,
      settings: SETTINGS,
    };
  }

  /** Load public site content once, then answer from a cached search index. */
  function loadKnowledge(): Promise<IndexedKnowledgeEntry[]> {
    if (knowledgeIndexRef.current) return Promise.resolve(knowledgeIndexRef.current);
    if (knowledgeLoadRef.current) return knowledgeLoadRef.current;

    knowledgeLoadRef.current = (async () => {
      let data = seedKnowledgeData();

      try {
        const sb = createAnonClient();
        const [unitsRes, servicesRes, contactsRes, branchesRes, boardRes, newsRes, galleryRes, settingsRes] = await Promise.all([
          sb.from("business_units").select("*").order("order").limit(100),
          sb.from("business_services").select("*").order("order").limit(500),
          sb.from("business_contacts").select("*").limit(500),
          sb.from("business_branches").select("*").limit(500),
          sb.from("board_members").select("*").order("order").limit(100),
          sb.from("news").select("*").eq("published", true).order("date", { ascending: false }).limit(100),
          sb.from("gallery_items").select("*").limit(100),
          sb.from("system_settings").select("key,value").in("key", [
            "members_total",
            "voters_total",
            "members_files_count",
            "voters_files_count",
            "years_of_service",
          ]),
        ]);

        if (unitsRes.data?.length) {
          type ServiceRow = BusinessService & { business_slug: string };
          type ContactRow = BusinessContact & { business_slug: string };
          type BranchRow = BusinessBranch & { business_slug: string };

          const servicesBySlug = new Map<string, BusinessService[]>();
          for (const row of (servicesRes.data ?? []) as unknown as ServiceRow[]) {
            const list = servicesBySlug.get(row.business_slug) ?? [];
            list.push({
              order: Number(row.order ?? 0),
              title_en: row.title_en ?? "",
              title_si: row.title_si ?? "",
              desc_en: row.desc_en ?? "",
              desc_si: row.desc_si ?? "",
              features_en: Array.isArray(row.features_en) ? row.features_en : [],
              features_si: Array.isArray(row.features_si) ? row.features_si : [],
              active: row.active !== false && String(row.active) !== "false",
            });
            servicesBySlug.set(row.business_slug, list);
          }

          const contactsBySlug = new Map<string, BusinessContact[]>();
          for (const row of (contactsRes.data ?? []) as unknown as ContactRow[]) {
            const list = contactsBySlug.get(row.business_slug) ?? [];
            list.push({
              role_en: row.role_en ?? "",
              role_si: row.role_si ?? "",
              name: row.name ?? "",
              location: row.location ?? "",
              phone: row.phone ?? "",
              note_en: row.note_en,
              note_si: row.note_si,
            });
            contactsBySlug.set(row.business_slug, list);
          }

          const branchesBySlug = new Map<string, BusinessBranch[]>();
          for (const row of (branchesRes.data ?? []) as unknown as BranchRow[]) {
            const list = branchesBySlug.get(row.business_slug) ?? [];
            list.push({
              name: row.name ?? "",
              manager: row.manager ?? "",
              location: row.location ?? "",
              phone: row.phone ?? "",
            });
            branchesBySlug.set(row.business_slug, list);
          }

          const units = unitsRes.data as unknown as BusinessUnit[];
          data = {
            ...data,
            businesses: units.map((unit) => ({
              ...unit,
              active: unit.active === true || String(unit.active) === "true",
              is_new: unit.is_new === true || String(unit.is_new) === "true",
              contacts: contactsBySlug.get(unit.slug) ?? [],
              branches: branchesBySlug.get(unit.slug) ?? [],
              services: servicesBySlug.get(unit.slug) ?? [],
            })),
          };
        }

        if (boardRes.data?.length) {
          const seen = new Set<string>();
          const board = (boardRes.data as unknown as BoardMember[]).filter((member) => {
            const key = (member.email || member.name_en || member.name_si || "").trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (board.length) data = { ...data, board };
        }
        if (newsRes.data?.length) data = { ...data, news: newsRes.data as unknown as NewsItem[] };
        if (galleryRes.data?.length) data = { ...data, gallery: galleryRes.data as unknown as GalleryItem[] };

        if (settingsRes.data?.length) {
          const settingsMap = new Map(
            (settingsRes.data as { key: string; value: string }[]).map((row) => [row.key, row.value]),
          );
          const settingNumber = (key: string, fallback: number) => {
            const value = Number(settingsMap.get(key));
            return Number.isFinite(value) && value > 0 ? value : fallback;
          };
          data = {
            ...data,
            settings: {
              ...SETTINGS,
              members_total: settingNumber("members_total", SETTINGS.members_total),
              voters_total: settingNumber("voters_total", SETTINGS.voters_total),
              members_files_count: settingNumber("members_files_count", SETTINGS.members_files_count),
              voters_files_count: settingNumber("voters_files_count", SETTINGS.voters_files_count),
              years_of_service: settingNumber("years_of_service", SETTINGS.years_of_service),
            },
          };
        }
      } catch {
        data = seedKnowledgeData();
      }

      let index: IndexedKnowledgeEntry[];
      try {
        index = buildKnowledgeIndex(data);
      } catch {
        index = buildKnowledgeIndex(seedKnowledgeData());
      }
      knowledgeIndexRef.current = index;
      return index;
    })();

    return knowledgeLoadRef.current;
  }

  /** Search the website brain; returns false when no verified site answer is found. */
  async function answerFromKnowledge(q: string, rsi: boolean): Promise<boolean> {
    // Explicit requests for a person keep using the officer-confirmation flow.
    if (detectOfficerRequest(q)) return false;

    const myFlow = flowRef.current;
    setTyping(true);
    try {
      const index = await loadKnowledge();
      if (flowRef.current !== myFlow) {
        setTyping(false);
        return true; // handled — but conversation was reset, so stay silent
      }
      const lastTopic = convoRef.current.lastTopic;
      const followUp = /(ඒක|එයා|එම|එහි|ඒ ගැන|එයාගේ|ඒකේ|තව විස්තර|\beke\b|\beyage\b|that (business|division|branch|person)|its|their|more details)/i.test(q);
      const searchText = followUp && lastTopic
        ? `${q} ${lastTopic.replace(/^(biz|person|branch):/, "").replace(/-/g, " ")}`
        : q;
      const result = searchKnowledge(searchText, index);
      setTyping(false);
      if (!result) return false;

      if (result.ambiguous && result.alternatives.length > 1) {
        push({
          from: "bot",
          bold: rsi ? "🤔 මේවායින් කෝකද අදහස් කළේ?" : "🤔 Which one did you mean?",
          text: result.alternatives
            .map((entry, i) => `${i + 1}. ${rsi ? entry.title_si : entry.title_en}`)
            .join("\n"),
          chips: result.alternatives.map((entry) => (rsi ? entry.title_si : entry.title_en).slice(0, 54)),
        });
        convoRef.current.lastIntent = "knowledge_ambiguous";
        void logEvent("knowledge_ambiguous", q, Math.round(result.score), sessionRef.current);
        return true;
      }

      const entry = result.entry;
      const body = rsi ? entry.body_si : entry.body_en;
      const phone = body.match(/0\d{2}\s\d{3}\s\d{4}/)?.[0];
      const phoneIntent = /(phone|telephone|number|contact|call|manager|දුරකථන|අංකය|අමතන්න|කළමනාකරු|නොම්බර)/i.test(q);
      push({
        from: "bot",
        bold: `${entry.emoji ?? "💡"} ${rsi ? entry.title_si : entry.title_en}`,
        text: body,
        chips: rsi ? entry.chips_si : entry.chips_en,
        link:
          phone && phoneIntent
            ? { href: `tel:${phone.replace(/\s/g, "")}`, label: rsi ? `📞 ${phone} කෙලින්ම අමතන්න` : `📞 Call ${phone}` }
            : entry.href
              ? {
                  href: entry.href,
                  label:
                    (rsi ? entry.linkLabel_si : entry.linkLabel_en) ??
                    (rsi ? "අදාළ පිටුව විවෘත කරන්න" : "Open the relevant page"),
                }
              : undefined,
      });
      convoRef.current.lastIntent = "knowledge";
      if (entry.topic) convoRef.current.lastTopic = entry.topic;
      void logEvent("knowledge", `${entry.id} · ${q}`, Math.round(result.score), sessionRef.current);
      return true;
    } catch {
      setTyping(false);
      return false;
    }
  }

  /**
   * ✨ Gemini AI fallback — site brain එකට උත්තරයක් නැති පොදු දැනුම් ප්‍රශ්නවලට.
   * API key එක browser එකට එන්නේ නෑ: /api/baymax-ai server route එක හරහායි යන්නේ.
   * AI off නම් / key එක නැත්නම් / error එකක් නම් false → පරණ fallback එකමයි.
   */
  async function answerFromAI(q: string, rsi: boolean): Promise<boolean> {
    if (!aiEnabled || detectOfficerRequest(q)) return false;
    const myFlow = flowRef.current;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    setTyping(true);
    try {
      const res = await fetch("/api/baymax-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, language: rsi ? "si" : "en" }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; answer?: string } | null;
      setTyping(false);
      if (flowRef.current !== myFlow) return true; // conversation reset වුණා — නිහඬව ඉන්නවා
      const answer = typeof data?.answer === "string" ? data.answer.trim() : "";
      if (!res.ok || !data?.ok || !answer) return false;
      push({
        from: "bot",
        bold: rsi ? "✨ Baymax AI පිළිතුර" : "✨ Baymax AI answer",
        text: answer,
        chips: [...(rsi ? MENU_CHIPS_SI : MENU_CHIPS_EN), rsi ? "ඇමතුමක් ඉල්ලන්න" : "Request a Call"],
      });
      convoRef.current.lastIntent = "ai";
      void logEvent("ai_answer", q, 0, sessionRef.current);
      return true;
    } catch {
      setTyping(false);
      return flowRef.current !== myFlow;
    } finally {
      clearTimeout(timer);
    }
  }

  async function botReply(raw: string) {
    const q = raw.trim();
    const n = norm(q);
    if (!q) return;

    // action shortcut
    const hit = ACTIONS.find((a) => norm(a.en) === n || norm(a.si) === n || (a.key === "find" && /^(search again|නැවත සොයන්න)$/.test(n)));
    if (hit) {
      await runAction(hit.key, replyIsSi(q, si));
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

    // ───────────────────────────────────────────────────────────────────────
    //  Baymax brain (④) — smalltalk, නම මතක තබා ගැනීම, fuel/news/gallery
    //  patterns ඔක්කොම src/lib/chatbot.ts එකේ — අලුත් වචන එතැනින් ට්‍රේන් කරන්න
    // ───────────────────────────────────────────────────────────────────────
    const rsi = replyIsSi(q, si);
    const myName = (visitorName.trim() || convoRef.current.name || "").trim();
    const firstName = myName ? myName.split(/\s+/)[0] : "";
    const menuChips = rsi ? MENU_CHIPS_SI : MENU_CHIPS_EN;

    // "මගේ නම ..." කියූ විට — නම මතක තබා, පස්සේ නමින් අමතන්න
    const introName = detectNameIntro(q);
    if (introName) {
      convoRef.current.name = introName;
      convoRef.current.lastIntent = "how_are_you";
      setVisitorName(introName);
      try {
        localStorage.setItem("mpcs_chat_name", introName);
      } catch {
        /* ignore */
      }
      push({
        from: "bot",
        bold: rsi ? `😊 හඳුනාගැනීම සතුටුයි, ${introName}!` : `😊 Nice to meet you, ${introName}!`,
        text: rsi
          ? `මම ${botName} — ${SITE.short_si} එකේ සජීවී සහායකයා.\nකොහොමද ඉන්නේ?`
          : `I'm ${botName} — the live assistant of ${SITE.short_en}.\nHow are you doing?`,
      });
      void logEvent("intent_name_intro", "", 0, sessionRef.current);
      return;
    }

    // “live chat / සජීවී චැට්” කෙටි නියෝගයම නම් පරණ direct live action එකම පාවිච්චි කරයි.
    if (/^(live ?chat|live agent|සජීවී ?චැට්|සජීවී|ලයිව් ?චැට්|ලයිව්)$/.test(n)) {
      void runAction("live", rsi);
      return;
    }

    // 👤 කාර්යාලයේ කෙනෙකු/නිලධාරියෙකු කෙලින්ම ඉල්ලන විට — සිංහල අක්ෂර
    // වින්‍යාස වෙනස්කම්ද තේරුම් ගෙන, knowledge/fallback වලට කලින් හරි flow එකට යවයි.
    if (detectOfficerRequest(q)) {
      setOfficerReplySi(rsi);
      convoRef.current.lastIntent = "officer";
      void logEvent("intent_officer", q, 0, sessionRef.current);
      askOfficer(rsi);
      return;
    }

    const talk = detectSmalltalk(q);
    if (talk) {
      const wasAsked = convoRef.current.lastIntent === "how_are_you";
      void logEvent(`intent_${talk.intent}`, q, 0, sessionRef.current);
      switch (talk.intent) {
        case "hi":
          convoRef.current.lastIntent = "how_are_you";
          push({
            from: "bot",
            text: rsi ? `Hi${firstName ? ` ${firstName}` : ""}! 👋 කොහොමද ඉන්නේ?` : `Hi${firstName ? ` ${firstName}` : ""}! 👋 How are you doing?`,
            chips: menuChips,
          });
          return;
        case "hello":
          convoRef.current.lastIntent = "greeted";
          push({
            from: "bot",
            text: rsi
              ? `Hello${firstName ? ` ${firstName}` : ""}! 👋\nමම ${botName} බොට් — ${SITE.short_si} එකේ සජීවී සහායකයා.\nමම කොහොමද ඔබට උදව් කරන්න ඕනෙ?`
              : `Hello${firstName ? ` ${firstName}` : ""}! 👋\nI'm ${botName}, the live assistant of ${SITE.short_en}.\nHow may I help you?`,
            chips: menuChips,
          });
          return;
        case "ayubowan":
          convoRef.current.lastIntent = "greeted";
          push({
            from: "bot",
            text: rsi
              ? `ආයුබෝවන්${firstName ? ` ${firstName}` : ""}! 🙏\n${SITE.short_si} වෙත සාදරයෙන් පිළිගනිමු. මම ${botName} — ඔබට කොහොමද උදව් කරන්න ඕනෙ?`
              : `Ayubowan${firstName ? ` ${firstName}` : ""}! 🙏\nWelcome to ${SITE.short_en}. I'm ${botName} — how may I help you?`,
            chips: menuChips,
          });
          return;
        case "daypart": {
          convoRef.current.lastIntent = "greeted";
          const greetSi = { morning: "සුබ උදෑසනක්! ☀️", afternoon: "සුබ දහවලක්! 🌤️", evening: "සුබ සැන්දෑවක්! 🌇", night: "සුබ රාත්‍රියක්! 🌙" }[talk.part ?? "morning"];
          const greetEn = { morning: "Good morning! ☀️", afternoon: "Good afternoon! 🌤️", evening: "Good evening! 🌇", night: "Good night! 🌙" }[talk.part ?? "morning"];
          push({
            from: "bot",
            text: rsi
              ? `${greetSi}${firstName ? ` ${firstName}` : ""}\nමම ${botName} — අද ඔබට කොහොමද උදව් කරන්න ඕනෙ?`
              : `${greetEn}${firstName ? ` ${firstName}` : ""}\nI'm ${botName} — how may I help you today?`,
            chips: menuChips,
          });
          return;
        }
        case "how_are_you":
          convoRef.current.lastIntent = "how_are_you";
          push({
            from: "bot",
            text: rsi ? "මම හොඳින් ඉන්නවා, ස්තූතියි! 😊 ඔයාට කොහොමද?" : "I'm doing well, thank you! 😊 How about you?",
          });
          return;
        case "wellbeing_good":
          convoRef.current.lastIntent = "greeted";
          push({
            from: "bot",
            text: rsi
              ? wasAsked
                ? "අහන්න ලැබීම ගොඩක් සතුටුයි! 😊\nකියන්න, මම අද ඔබට උදව් කරන්නේ කොහොමද?"
                : "නියමයි! 😊 කියන්න, මම ඔබට උදව් කරන්නේ කොහොමද?"
              : wasAsked
                ? "Glad to hear that! 😊\nTell me — how may I help you today?"
                : "Great! 😊 Tell me — how may I help you?",
            chips: menuChips,
          });
          return;
        case "wellbeing_bad":
          convoRef.current.lastIntent = "greeted";
          push({
            from: "bot",
            text: rsi
              ? "අයියෝ, ඒක අහන්න කණගාටුයි 🫂\nසමිති කාර්යාලයෙන් උදව්වක් අවශ්‍ය නම් නිලධාරියෙක් සම්බන්ධ කරලා දෙන්නම් — පහත “ඇමතුමක් ඉල්ලන්න” ඔබන්න."
              : "I'm sorry to hear that 🫂\nIf you need help from our office, I can connect you with an officer — tap “Request a Call” below.",
            chips: rsi ? ["ඇමතුමක් ඉල්ලන්න", "සජීවී චැට්"] : ["Request a Call", "Live Chat"],
          });
          return;
        case "thanks":
          convoRef.current.lastIntent = "greeted";
          push({
            from: "bot",
            text: rsi ? "ඔබව සාදරයෙන් පිළිගන්නවා! 🙏\nතවත් මොනවා හරි උදව්වක් ඕනෙද?" : "You're most welcome! 🙏\nIs there anything else I can help you with?",
            chips: menuChips,
          });
          return;
        case "bye":
          convoRef.current.lastIntent = "closed";
          push({
            from: "bot",
            text: rsi
              ? `ගිහිල්ලා එන්න${firstName ? ` ${firstName}` : ""}! 👋\nඅපව විශ්වාස කළාට ස්තූතියි — ඕනෑම වෙලාවක ආයෙත් එන්න. සුබ දවසක්! 🙏`
              : `Goodbye${firstName ? ` ${firstName}` : ""}! 👋\nThank you for visiting us — please come back anytime. Have a great day! 🙏`,
          });
          return;
        case "who_are_you":
          convoRef.current.lastIntent = "greeted";
          push({
            from: "bot",
            bold: `🤖 ${botName}`,
            text: rsi
              ? `මම ${botName} — ${SITE.short_si} එකේ සජීවී චැට් සහායකයා.\nමට පුළුවන්: සාමාජිකයන් සොයන්න, ඉන්ධන මිල කියන්න, පුවත් හා ගැලරි පෙන්වන්න, කළමනාකරුවන්ගේ දුරකථන දෙන්න සහ නිලධාරියෙක් සම්බන්ධ කරන්න.\nඋත්සාහ කරන්න: “fuel prices” කියලා ලියන්න 😊`
              : `I'm ${botName} — the live chat assistant of ${SITE.short_en}.\nI can find members, share fuel prices, show news and the gallery, give managers' phone numbers and connect you with an officer.\nTry typing “fuel prices” 😊`,
            chips: menuChips,
          });
          return;
        case "help":
          convoRef.current.lastIntent = "greeted";
          push({
            from: "bot",
            bold: rsi ? "🧭 මට ඔබට උදව් කරන්න පුළුවන් දෑ" : "🧭 Here's how I can help",
            text: rsi
              ? "ඔබට ඕනෑම දෙයක් නිදහසේ අහන්න පුළුවන් — උදා: “සමිතියේ සම්පූර්ණ නම”, “සභාපතිගේ නම”, “සාමාජිකත්වයට අයදුම් කරන්නේ කොහොමද?”\nඅංශයක නමක් හෝ keyword එකක් විතරක් වුණත් ඇති — “Maliban”, “පොහොර”, “රක්ෂණය”, “සුපර් මාර්කට්”.\n🔎 සාමාජික සොයන්න — නම/NIC/සාමාජික අංකය (උදා: 41/01)\n⛽ ඉන්ධන මිල · 📰 පුවත් · 🖼️ ගැලරිය\n🏢 ව්‍යාපාර, ශාඛා, කළමනාකරුවන් සහ දුරකථන\n📞 නිලධාරියෙකුගේ ඇමතුමක් ඉල්ලන්න"
              : "You can ask me freely — e.g. “What is the society's full name?”, “chairman name” or “How do I become a member?”\nA single division keyword also works — “Maliban”, “fertilizer”, “insurance” or “supermarket”.\n🔎 Find a member — name / NIC / member No. (e.g. 41/01)\n⛽ Fuel prices · 📰 News · 🖼️ Gallery\n🏢 Businesses, branches, managers and phone numbers\n📞 Request a call from an officer",
            chips: [...menuChips, rsi ? "ඇමතුමක් ඉල්ලන්න" : "Request a Call"],
          });
          return;
        case "ok":
          convoRef.current.lastIntent = "greeted";
          push({
            from: "bot",
            text: rsi ? "හරි! 👍 තවත් දෙයක් ඕනෙද?" : "Great! 👍 Anything else you need?",
            chips: menuChips,
          });
          return;
      }
    }

    // ⛽ ඉන්ධන — වර්ගයක් සඳහන් නම් ඒ මිලම, නැත්නම් තෝරන මෙනුව
    const fuelHit = detectFuel(q);
    if (fuelHit) {
      if (fuelHit.type) await showFuelPrice(fuelHit.type);
      else await showFuelPicker();
      return;
    }

    // 📰 පුවත් / නිවේදන (රැකියා / ටෙන්ඩර් filter සමඟ)
    const newsHit = detectNews(q);
    if (newsHit) {
      await showNews(newsHit.category);
      return;
    }

    // 🖼️ ගැලරිය
    if (detectGallery(q)) {
      await showGallery();
      return;
    }

    // පැමිණිල්ලක් → නිලධාරියකුට භාරදීම (වඩාත් වෘත්තීයයි)
    if (detectComplaint(q)) {
      void logEvent("intent_complaint", q, 0, sessionRef.current);
      askOfficer(rsi);
      return;
    }

    // 🧠 Site brain — ඕනෑම නිදහස් ප්‍රශ්නයකට අඩවියේම තහවුරු කළ තොරතුරු වලින් පිළිතුරු දෙයි
    if (await answerFromKnowledge(q, rsi)) return;

    // ණය / ඉතුරුම් / උකස් → ග්‍රාමීය බැංකුව
    if (detectBanking(q)) {
      convoRef.current.lastIntent = "banking";
      push({
        from: "bot",
        bold: rsi ? "🏦 ග්‍රාමීය බැංකුව — ණය සහ ඉතුරුම්" : "🏦 Rural Bank — Loans & Savings",
        text: rsi
          ? "අපේ ග්‍රාමීය බැංකු අංශයෙන් ඉතුරුම් ගිණුම්, සාමාජික ණය සහ රන් උකස් සේවා ලබාගන්න පුළුවන්.\nසේවා විස්තර සහ ශාඛා 22ම පිටුවෙන් බලන්න පුළුවන්."
          : "Our Rural Bank offers savings accounts, member loans and gold pawning services.\nSee the page below for services and all 22 branches.",
        chips: rsi ? ["ව්‍යාපාර කළමනාකරුවන්", "කාර්යාල දුරකථන"] : ["Business Managers", "Office Phones"],
        link: { href: "/businesses/rural-bank", label: rsi ? "ග්‍රාමීය බැංකු පිටුව අරින්න" : "Open the Rural Bank page" },
      });
      void logEvent("intent_banking", q, 0, sessionRef.current);
      return;
    }

    // අධ්‍යක්ෂ මණ්ඩලය / සභාපති → නම අනුව දුරකථන ලැයිස්තුව
    if (/(chairman|board of directors|directors?|සභාපති|අධ්‍යක්ෂ මණ්ඩල|අධ්‍යක්ෂ)/.test(n)) {
      void runAction("office");
      return;
    }

    // ව්‍යාපාර අංශ / සේවා (දුරකථන අසන්නේ නැත්නම්) → අංශ ලැයිස්තුව
    if (/(business|businesses|divisions?|ව්‍යාපාර|අංශ|සේවා|services)/.test(n) && !/(phone|දුරකථන|number|අංක)/.test(n)) {
      void runAction("managers");
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

    // ⛽ fuel / 📰 news / 🖼️ gallery / greeting intents — උඩ Baymax brain එකෙන් හසුරුවනවා

    if (/(phone|call|දුරකථන|අමතන්න|contact|manager|කළමනාකර)/.test(n)) {
      push({
        from: "bot",
        bold: si ? "📞 අප අමතන්න" : "📞 Contact Us",
        text: `${SITE.phones.join("\n")}\n📍 ${si ? SITE.address_si : SITE.address_en}`,
        chips: si ? ["කාර්යාල දුරකථන", "කළමනාකරු දුරකථන"] : ["Office Phones", "Managers Phones"],
      });
      return;
    }

    // ✨ Site brain එකට උත්තර නැති පොදු ප්‍රශ්න — Admin on කරලා ඇත්නම් Gemini AI එකෙන් අහනවා
    if (await answerFromAI(q, rsi)) return;

    // ✅ තේරුණේ නැති පණිවිඩය — bot එක ට්‍රේන් කිරීමට log කර, මෙනුව පෙන්වයි
    void logEvent("unmatched", q, 0, sessionRef.current);
    convoRef.current.lastIntent = "unmatched";
    push({
      from: "bot",
      bold: rsi ? "🙏 සමාවෙන්න, ඒක මට හරියට තේරුණේ නෑ" : "🙏 Sorry, I didn't quite get that",
      text: rsi
        ? "මම අඩවියේ තියෙන තොරතුරුත් පරීක්ෂා කළා, නමුත් මේකට විශ්වාසදායක උත්තරයක් හමු වුණේ නෑ. ඔබේ පණිවිඩය සටහන් කර ගත්තා.\nවචන ටිකක් වෙනස් කරලා ආයෙත් අහන්න, පහත විකල්පයකින් තෝරන්න, නැත්නම් නිලධාරියෙක් සම්බන්ධ කරලා දෙන්නම්."
        : "I checked the information on this website, but I couldn't find a reliable answer to that. I've noted your message.\nTry asking in different words, pick an option below, or let me connect you with an officer.",
      chips: [...menuChips, rsi ? "ඇමතුමක් ඉල්ලන්න" : "Request a Call"],
    });
  }

  function send(text?: string) {
    const v = (text ?? input).trim();
    if (!v) return;
    push({ from: "me", text: v });
    setInput("");
    const myFlow = flowRef.current;
    setTimeout(() => {
      if (flowRef.current === myFlow) void botReply(v);
    }, 350);
  }

  // ── "Message" tab (free text) ──
  // පණිවිඩය (1) Admin → Messages එකේ පෙන්නන්න messages table එකටත්,
  // (2) Admin → Emails හි "වෙබ් පණිවිඩ පෙට්ටිය" ලිපිනවලට email එකක් ලෙසත් යයි.
  // එවන්නා email එකක් දුන්නොත් ඔහුට/ඇයට confirmation email එකකුත් යයි.
  async function submitMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setSentOk(false);
    setSentErr(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const emailRaw = String(fd.get("email") || "").trim();
    const message = String(fd.get("message") || "").trim();
    const visitorEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw) ? emailRaw : "";

    const payload: Record<string, unknown> = {
      _subject: `MPCS website message — ${name || "Guest"}`,
      Source: "Website Message Box (chat widget)",
      Name: name,
      Phone: phone,
      Email: visitorEmail || "—",
      Message: message,
    };
    if (visitorEmail) {
      // FormSubmit: "email" field එකටයි confirmation (autoresponse) එක යන්නේ
      payload.email = visitorEmail;
      payload._replyto = visitorEmail;
      payload._autoresponse = si
        ? `ස්තූතියි ${name}! ඔබේ පණිවිඩය ${SITE.short_si} ට ලැබුණා. අපි ඉක්මනින් ඔබ සම්බන්ධ කර ගන්නෙමු. හදිසි නම් ${SITE.phones[0]} අමතන්න.`
        : `Thank you ${name}! Your message has been received by ${SITE.short_en}. We will get back to you shortly. For anything urgent, call ${SITE.phones[0]}.`;
    }

    // ① site එකේ (Admin → Messages) පෙන්නන්න save කරන්න
    let saved = false;
    try {
      const { createAnonClient } = await import("@/lib/supabase/anon");
      const { error } = await createAnonClient().from("messages").insert({
        name,
        phone,
        email: visitorEmail,
        department: "Live Chat",
        subject: "Website message (Message tab)",
        message,
        status: "unread",
      });
      saved = !error;
    } catch {
      /* best effort */
    }

    // ② කාර්යාල inbox වලට email කරන්න (Admin → Emails → වෙබ් පණිවිඩ පෙට්ටිය)
    let emailed = false;
    try {
      const { sendToRoute } = await import("@/lib/mail-routes");
      emailed = (await sendToRoute("message", payload)) > 0;
    } catch {
      /* offline */
    }

    void logEvent(saved || emailed ? "message" : "message_failed", name, 0, sessionRef.current);
    setSending(false);
    if (saved || emailed) {
      setSentOk(true);
      form.reset();
      setTimeout(() => setSentOk(false), 6000);
    } else {
      // බොරුවට "යැවුණා" කියන්නේ නෑ — නැවත උත්සාහයට පෝරමය එහෙම්ම තියයි
      setSentErr(true);
    }
  }

  // ✅ Clear chat පෙන්වන්නේ clear කරන්න ඇත්ත පණිවිඩ (visitor/agent) තිබුණොත් විතරයි —
  //    හිස් chat එකේවත්, දැනටමත් clear කරපු (system note විතරක් ඇති) chat එකේවත් නෑ.
  //    එකවර පෙන්වන්නේ එක button එකයි: closed banner එක තියෙද්දී පොඩි රතු එක හැංගෙනවා.
  const clearable = hasClearableHistory(liveMsgs);
  const showTypingNow = shouldShowTyping(liveStatus, agentTyping);
  const canChat = canUseLiveChat(liveStatus);   // 🔒 joined විට විතරක් composer unlock
  const liveOfficeClosed = !liveHours.open && !canChat; // 🕘 joined සංවාදයකට බාධා නෑ
  const nextLiveOpenPhrase = nextLiveChatOpenPhrase(si);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* launcher — open වුණාම hide (header එකේ X එකෙන් close) */}
      {!open && (
      <button
        onClick={() => {
          unlockAudio();
          setMinimized(false);
          setOpen((o) => !o);
        }}
        className="fixed bottom-[72px] right-4 sm:bottom-20 sm:right-6 z-[90] h-14 w-14 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white shadow-2xl shadow-indigo-900/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform no-print"
        aria-label="Live chat"
      >
        {officerJoined && !open && (
          <span className="absolute -left-2 -top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8.5px] font-black text-white shadow">
            LIVE
          </span>
        )}
        {open ? (
          <X size={22} />
        ) : botAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={botAvatar} alt={botName} className="h-full w-full rounded-full object-cover" />
        ) : (
          <MessageCircle size={24} />
        )}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">{unread}</span>
        )}
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
      </button>
      )}

      {/* minimized bar */}
      {open && minimized && (
        <button
          onClick={() => setMinimized(false)}
          className="fixed bottom-[72px] right-4 sm:bottom-20 sm:right-6 z-[90] flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white pl-2 pr-3.5 py-2 shadow-[0_18px_50px_-12px_rgba(15,23,42,0.45)] hover:shadow-2xl transition no-print"
        >
          <span className="relative w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white flex items-center justify-center">
            <MessageCircle size={16} />
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${liveStatus === "joined" ? "bg-emerald-400" : "bg-amber-400"}`} />
          </span>
          <span className="text-left max-w-[160px]">
            <span className="block text-[11.5px] font-extrabold text-slate-800 leading-tight">{si ? "සජීවී චැට්" : "Live Chat"}</span>
            <span className="block text-[9.5px] text-slate-500 truncate">
              {showTypingNow
                ? si ? "නිලධාරියා ලියනවා…" : "Officer is typing…"
                : liveMsgs.length
                  ? liveMsgs[liveMsgs.length - 1].body
                  : liveStatus === "joined"
                    ? si ? `${agentName || "නිලධාරියා"} සම්බන්ධයි` : `${agentName || "Officer"} connected`
                    : si ? "කුඩා කර ඇත — විවෘත කරන්න" : "Minimized — tap to open"}
            </span>
          </span>
          {unread > 0 && <span className="rounded-full bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5">{unread}</span>}
        </button>
      )}

      {open && !minimized && (
        <div className="fixed bottom-[140px] right-4 sm:bottom-[150px] sm:right-6 z-[90] w-[calc(100vw-2rem)] sm:w-[400px] max-h-[min(660px,72vh)] rounded-3xl overflow-hidden bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.55)] border border-slate-200 flex flex-col pop-in no-print">
          {/* ── header ── */}
          <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-fuchsia-600 px-4 pt-3.5 pb-3 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30 overflow-hidden">
                {botAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={botAvatar} alt={botName} className="h-full w-full object-cover" />
                ) : (
                  <Bot size={20} />
                )}
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-indigo-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-[14px] leading-tight truncate">{botName}</div>
                <div className="text-[10.5px] text-indigo-100 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> {si ? "සබැඳි · ක්ෂණික පිළිතුරු" : "Online · instant answers"}
                </div>
              </div>
              <a href={`tel:${SITE.phones[0].replace(/\s/g, "")}`} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition" title={si ? "අමතන්න" : "Call us"}>
                <Phone size={14} />
              </a>
              <button
                onClick={() => {
                  setMinimized(true);
                  setOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
                aria-label="Minimize"
                title={si ? "කුඩා කරන්න" : "Minimize"}
              >
                <Minus size={15} />
              </button>
              <button
                onClick={() => {
                  // 🧹 X එකෙන් close කළාම Baymax history එකත් අයින් වේ —
                  //    ආයෙත් අරින විට අලුත් welcome එකකින් පටන් ගනී.
                  //    (Live officer session එක/history එක මෙයින් අයින් වෙන්නේ නෑ)
                  resetBaymaxConversation();
                  setOpen(false);
                  setMinimized(false);
                }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
                aria-label="Close"
                title={si ? "වසන්න — Baymax කතාබහත් අයින් වේ" : "Close — clears the Baymax conversation"}
              >
                <X size={15} />
              </button>
            </div>

            {/* tabs */}
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-white/15 p-1">
              <button onClick={() => setTab("chat")} className={`rounded-lg py-1.5 text-[10.5px] font-bold transition ${tab === "chat" ? "bg-white text-indigo-700 shadow" : "text-white/90 hover:bg-white/10"}`}>
                <Sparkles size={11} className="inline mr-0.5" /> {botName}
              </button>
              <button onClick={() => setTab("live")} className={`relative rounded-lg py-1.5 text-[10.5px] font-bold transition ${tab === "live" ? "bg-white text-indigo-700 shadow" : "text-white/90 hover:bg-white/10"}`}>
                <span className="inline-flex items-center gap-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${liveStatus === "joined" ? "bg-emerald-400" : liveOfficeClosed ? "bg-rose-300" : "bg-amber-300"}`} />
                  {si ? "සජීවී චැට්" : "Live Chat"}
                </span>
              </button>
              <button onClick={() => setTab("form")} className={`rounded-lg py-1.5 text-[10.5px] font-bold transition ${tab === "form" ? "bg-white text-indigo-700 shadow" : "text-white/90 hover:bg-white/10"}`}>
                <Send size={11} className="inline mr-0.5" /> {si ? "පණිවිඩය" : "Message"}
              </button>
            </div>
          </div>

          {/* ✅ admin චැට් එකට join වුණා — Live Chat tab එකට යන්න කැඳවීම */}
          {officerJoined && tab !== "live" && (
            <button
              onClick={() => {
                setTab("live");
                setLiveUsed(true);
                setOfficerJoined(false);
                setUnread(0);
              }}
              className="relative shrink-0 flex w-full items-center gap-2.5 border-b border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-left transition hover:bg-emerald-100"
            >
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                <MessageCircle size={16} />
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-extrabold text-emerald-900">
                  {si
                    ? `🟢 ${agentName || "නිලධාරියෙක්"} සජීවී චැට් එකට සම්බන්ධ වුණා`
                    : `🟢 ${agentName || "An officer"} joined the live chat`}
                </span>
                <span className="block text-[10.5px] font-semibold text-emerald-700">
                  {si ? "කතා කරන්න Live Chat ඔබන්න →" : "Click to open Live Chat and reply →"}
                </span>
              </span>
              <ArrowRight size={15} className="shrink-0 text-emerald-700" />
            </button>
          )}

          {tab === "chat" ? (
            <>
              {/* ── action bar ── */}
              <div className="shrink-0 border-b border-slate-200 bg-white px-2 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => void runAction(a.key)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-bold transition ${
                        a.key === "live"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : a.key === "contact"
                            ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                            : a.key === "fuel"
                              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : a.key === "news"
                                ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                : a.key === "gallery"
                                  ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
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
              <div
                ref={boxRef}
                onScroll={() => {
                  const el = boxRef.current;
                  if (!el) return;
                  setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
                }}
                className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 bg-slate-50 min-h-[180px]"
              >
                {msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] ${m.from === "me" ? "order-1" : ""}`}>
                      <div className="flex items-end gap-1.5">
                        {m.from === "bot" && (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mb-0.5 overflow-hidden">
                            {botAvatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={botAvatar} alt={botName} className="h-full w-full object-cover" />
                            ) : (
                              <Bot size={13} />
                            )}
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-line ${
                            m.from === "me" ? "bg-indigo-600 text-white rounded-br-md" : "bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm"
                          }`}
                        >
                          {m.bold && <div className="font-book font-extrabold mb-1 text-slate-900">{m.bold}</div>}
                          <span className="font-book">{m.text}</span>

                          {/* business / board button panel */}
                          {m.card === "choices" && m.list && (
                            <div className="mt-2 grid grid-cols-1 gap-1.5">
                              {m.list.map((it) => (
                                <button
                                  key={it.value + it.label}
                                  onClick={() => void pickFromList(m.action ?? "biz", it.value, it.label)}
                                  className="w-full rounded-xl border border-indigo-200 bg-white px-2.5 py-2 text-left hover:border-indigo-400 hover:bg-indigo-50 transition"
                                >
                                  <span className="block text-[11.5px] font-extrabold text-slate-800 leading-tight">{it.label}</span>
                                  {it.sub && <span className="block text-[9.5px] text-slate-500 truncate">{it.sub}</span>}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* news cards — published items, click → full story */}
                          {m.card === "news" && m.items && (
                            <div className="mt-2 space-y-1.5">
                              {m.items.map((it) => (
                                <button
                                  key={it.id}
                                  onClick={() => {
                                    push({ from: "me", text: it.title });
                                    push({
                                      from: "bot",
                                      bold: it.title,
                                      text: `${it.sub ?? ""}\n\n${(it.desc ?? "").length > 600 ? `${(it.desc ?? "").slice(0, 600).trim()}…` : it.desc ?? ""}`,
                                      chips: si ? ["නිවේදන හා පුවත්", "ගැලරිය"] : ["News", "Gallery"],
                                      link: { href: "/news", label: si ? "සම්පූර්ණ පුවත පිටුවෙන් කියවන්න" : "Read the full story on the News page" },
                                    });
                                  }}
                                  className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-indigo-300 hover:bg-white"
                                >
                                  <span className="flex gap-2.5 p-2">
                                    {it.image ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={it.image} alt="" className="h-14 w-[4.5rem] shrink-0 rounded-lg object-cover" />
                                    ) : (
                                      <span className="flex h-14 w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                        <Newspaper size={20} />
                                      </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                      {it.badge && (
                                        <span className="mb-0.5 inline-block rounded-md bg-indigo-600 px-1.5 py-px text-[8.5px] font-black uppercase tracking-wide text-white">{it.badge}</span>
                                      )}
                                      <span className="block text-[11.5px] font-extrabold leading-snug text-slate-900 line-clamp-2">{it.title}</span>
                                      {it.sub && <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-500">{it.sub}</span>}
                                      <span className="mt-1 block text-[9.5px] font-bold text-indigo-600">{si ? "සම්පූර්ණ විස්තරය කියවන්න →" : "Read full details →"}</span>
                                    </span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* gallery cards — photo + tagline, click → details */}
                          {m.card === "gallery" && m.items && (
                            <div className="mt-2 space-y-2">
                              {m.items.map((it) => (
                                <button
                                  key={it.id}
                                  onClick={() => {
                                    push({ from: "me", text: it.title });
                                    push({
                                      from: "bot",
                                      bold: `🖼️ ${it.title}`,
                                      text: `${it.desc || (si ? "විස්තරයක් නැත." : "No description.")}${it.sub ? `\n${it.sub}` : ""}`,
                                      chips: si ? ["ගැලරිය", "නිවේදන හා පුවත්"] : ["Gallery", "News"],
                                      link: { href: "/gallery", label: si ? "ගැලරියෙන් ලොකු කර බලන්න" : "View it in the Gallery" },
                                    });
                                  }}
                                  className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-indigo-300 hover:bg-white"
                                >
                                  {it.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={it.image} alt={it.title} className="h-28 w-full object-cover" />
                                  ) : (
                                    <span className="flex h-28 w-full items-center justify-center bg-indigo-100 text-indigo-500">
                                      <Images size={26} />
                                    </span>
                                  )}
                                  <span className="block p-2.5">
                                    <span className="flex items-start justify-between gap-2">
                                      <span className="block text-[12px] font-extrabold leading-tight text-slate-900">{it.title}</span>
                                      {it.sub && <span className="shrink-0 text-[10px] font-bold text-rose-500">{it.sub}</span>}
                                    </span>
                                    {it.desc && <span className="mt-1 block text-[10.5px] leading-relaxed text-slate-500 line-clamp-2">{it.desc}</span>}
                                    <span className="mt-1.5 block text-[9.5px] font-bold text-indigo-600">{si ? "විස්තරය බලන්න →" : "View details →"}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* member result cards — click → full details */}
                          {m.card === "members" && m.rows && (
                            <div className="mt-2 space-y-1.5">
                              {m.rows.map((r, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    push({ from: "me", text: `${r.full_name || ""} (${r.member_no || "—"})` });
                                    push({
                                      from: "bot",
                                      bold: si ? "👤 සම්පූර්ණ විස්තර" : "👤 Full details",
                                      text: si
                                        ? `සාමාජික අංකය: ${r.member_no || "—"}\n👤 නම: ${r.full_name || "—"}\n📇 NIC: ${r.nic || "—"}\n🏠 ලිපිනය: ${r.address || "—"}\n📮 තැපැල් ලිපිනය: ${r.postal_address || "—"}\n⚧ ස්ත්‍රී/පුරුෂ: ${r.gender || "—"}\n📁 ගොනුව: ${r.file_name || "—"}`
                                        : `Member No: ${r.member_no || "—"}\n👤 Name: ${r.full_name || "—"}\n📇 NIC: ${r.nic || "—"}\n🏠 Address: ${r.address || "—"}\n📮 Postal: ${r.postal_address || "—"}\n⚧ Gender: ${r.gender || "—"}\n📁 File: ${r.file_name || "—"}`,
                                      chips: si ? ["සාමාජික සොයන්න", "සජීවී චැට්"] : ["Find Member", "Live Chat"],
                                    });
                                  }}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left hover:border-indigo-300 hover:bg-white transition"
                                >
                                  <span className="flex items-start justify-between gap-2">
                                    <span className="font-book font-extrabold text-[12px] text-slate-900 leading-tight">{r.full_name || "—"}</span>
                                    <span className="shrink-0 rounded-md bg-indigo-600 text-white text-[9.5px] font-black px-1.5 py-0.5">{r.member_no || "—"}</span>
                                  </span>
                                  <span className="font-book mt-1 block text-[10.5px] text-slate-500 leading-relaxed">
                                    <span className="font-semibold text-slate-600">NIC:</span> {r.nic || "—"}
                                    <br />
                                    <span className="font-semibold text-slate-600">{si ? "ලිපිනය" : "Address"}:</span> {r.address || "—"}
                                  </span>
                                  <span className="mt-1 block text-[9.5px] font-bold text-indigo-600">{si ? "සම්පූර්ණ විස්තර බලන්න →" : "View full details →"}</span>
                                </button>
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

                          {/* page link CTA (news / gallery / fuel) */}
                          {m.link && (
                            <a
                              href={m.link.href}
                              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-[11.5px] font-extrabold text-white transition hover:bg-indigo-700"
                            >
                              {m.link.label} <ArrowRight size={13} />
                            </a>
                          )}
                        </div>
                      </div>

                      {m.choices && m.choices.length > 0 && (
                        <div className="mt-2 ml-7 flex gap-2">
                          {m.choices.map((c) => (
                            <button
                              key={c.kind}
                              onClick={() => {
                                setMsgs((xs) => xs.map((x) => (x.id === m.id ? { ...x, choices: undefined, chips: undefined } : x)));
                                if (c.kind === "yes") void runAction("contact", contactReplySi);
                                else declineContact(contactReplySi);
                              }}
                              className={`flex-1 rounded-xl px-3 py-2 text-[11.5px] font-extrabold transition ${
                                c.kind === "yes"
                                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-95 shadow-sm shadow-emerald-600/20"
                                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}

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
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center overflow-hidden">
                      {botAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={botAvatar} alt={botName} className="h-full w-full object-cover" />
                      ) : (
                        <Bot size={13} />
                      )}
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
                    <label className="text-[10px] font-black uppercase tracking-wide text-fuchsia-600">{contactReplySi ? "සජීවී සම්බන්ධතා තොරතුරු" : "Contact details"}</label>
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
                      placeholder={contactReplySi ? "ඔබේ නම *" : "Your Name *"}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-fuchsia-400 focus:bg-white"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        required
                        value={cNic}
                        onChange={(e) => setCNic(e.target.value)}
                        placeholder={contactReplySi ? "NIC අංකය *" : "NIC Number *"}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-fuchsia-400 focus:bg-white"
                      />
                      <input
                        required
                        value={cPhone}
                        onChange={(e) => setCPhone(e.target.value)}
                        inputMode="tel"
                        placeholder={contactReplySi ? "දුරකථන අංකය *" : "Phone Number *"}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-fuchsia-400 focus:bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !cName.trim() || !cNic.trim() || !cPhone.trim()}
                      className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white py-2.5 text-[12px] font-extrabold disabled:opacity-40 hover:opacity-95 transition flex items-center justify-center gap-1.5"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {contactReplySi ? "ඉදිරිපත් කරන්න" : "Submit"}
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
                      placeholder={si ? "සමිතිය ගැන ඕනෑම දෙයක් අහන්න…" : "Ask anything about our society…"}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:bg-white"
                    />
                    <button onClick={() => send()} disabled={!input.trim()} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-indigo-700 transition">
                      <Send size={16} />
                    </button>
                  </div>
                  <div className="mt-1.5 text-center text-[9.5px] text-slate-400">{si ? "අඩවියේ තහවුරු කළ තොරතුරු වලින් උත්තර දෙයි · 24/7" : "Answers from verified website information · 24/7"}</div>
                </div>
              )}
            </>
          ) : tab === "live" ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* connection status */}
              <div
                className={`shrink-0 px-3.5 py-2 text-[10.5px] font-bold flex items-center gap-1.5 border-b ${
                  liveStatus === "joined"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : liveStatus === "closed"
                      ? "bg-slate-100 text-slate-600 border-slate-200"
                      : "bg-amber-50 text-amber-700 border-amber-100"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    liveStatus === "joined" ? "bg-emerald-500" : liveStatus === "closed" ? "bg-slate-400" : "bg-amber-500 animate-pulse"
                  }`}
                />
                <span className="truncate">
                  {liveStatus === "joined"
                    ? si
                      ? `🟢 ${agentName || "නිලධාරියෙක්"} සම්බන්ධ වී ඇත`
                      : `🟢 ${agentName || "An officer"} is connected`
                    : liveStatus === "closed"
                      ? si
                        ? "මේ chat එක අවසන් වී ඇත"
                        : "This chat has ended"
                      : liveOfficeClosed
                        ? si
                          ? `🕘 Live Chat වසා ඇත — ${nextLiveOpenPhrase}`
                          : `🕘 Live Chat closed — ${nextLiveOpenPhrase}`
                      : sessionActive
                        ? si
                          ? "⏳ නිලධාරියෙක් සම්බන්ධ වෙනතුරු රැඳී සිටින්න"
                          : "⏳ Waiting for an officer to join"
                        : si
                          ? "🔒 තවම පටන් අරගෙන නෑ — Baymax එකෙන් ඉල්ලන්න"
                          : "🔒 Not started yet — request via Baymax"}
                </span>
                <button
                  onClick={() => {
                    const next = !soundOn;
                    setSoundOn(next);
                    soundRef.current = next;
                    if (next) {
                      unlockAudio();
                      ping();
                    }
                  }}
                  className="ml-auto shrink-0 rounded-lg px-1.5 py-0.5 hover:bg-black/5"
                  title={soundOn ? (si ? "ශබ්දය on" : "Sound on") : si ? "ශබ්දය off" : "Sound off"}
                >
                  {soundOn ? <Bell size={12} /> : <BellOff size={12} />}
                </button>
              </div>

              <div ref={liveBoxRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2 bg-slate-50 min-h-[160px]">
                {liveMsgs.length === 0 && (
                  <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white border border-slate-200 px-3.5 py-2.5 text-[12px] text-slate-600 shadow-sm">
                    {canChat
                      ? si
                        ? "ආයුබෝවන් 👋 නිලධාරියෙක් සම්බන්ධ වී ඇත — ඔබේ ප්‍රශ්නය පහත ලියන්න, මෙතැනම පිළිතුරු ලැබෙනවා."
                        : "Hello 👋 An officer is connected — type your question below and they'll reply right here."
                      : liveOfficeClosed
                        ? si
                          ? `🕘 මේ වෙලාවේ සජීවී නිලධාරියෙක් සම්බන්ධ කර ගැනීම අපහසුයි. කරුණාකර ${nextLiveOpenPhrase} නැවත සම්බන්ධ වෙන්න. එතෙක් “පණිවිඩය” tab එකෙන් පණිවිඩයක් තියන්න පුළුවන්.`
                          : `🕘 It's difficult to connect you with a live officer at this time. Please reconnect ${nextLiveOpenPhrase}. Until then, you can leave a note via the “Message” tab.`
                      : sessionActive
                        ? si
                          ? "ඔබේ ඉල්ලීම අපේ කාර්යාලයට ලැබී ඇත ✅ නිලධාරියෙක් සම්බන්ධ වුණු ගමන් මෙම chat එක unlock වෙනවා — ඒ මොහොතේ ඔබට දැනුම් දෙනවා."
                          : "Your request has reached our office ✅ This chat will unlock the moment an officer joins — we'll notify you then."
                        : si
                          ? "🔒 මෙතැනින් කෙලින්ම chat කරන්න බෑ. නිලධාරියෙක් සම්බන්ධ කරගන්න පහත බොත්තමෙන් Baymax හරහා ඇමතුමක් ඉල්ලන්න — නිලධාරියා join වුණාම මෙම chat එක unlock වෙනවා."
                          : "🔒 You can't chat from here directly. Use the button below to request a call via Baymax — this chat unlocks when an officer joins."}
                  </div>
                )}
                {showTypingNow && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                    <span className="text-[9.5px] font-semibold text-slate-400">{si ? "නිලධාරියා ලියනවා…" : "Officer is typing…"}</span>
                  </div>
                )}
                {liveMsgs.map((m) =>
                  m.sender === "system" ? (
                    <div key={m.id} className="text-center">
                      <span className="inline-block rounded-full bg-slate-200/70 px-2.5 py-1 text-[9.5px] font-semibold text-slate-500">{m.body}</span>
                    </div>
                  ) : (
                    <div key={m.id} className={`flex ${m.sender === "visitor" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[85%]">
                        <div className={`mb-0.5 px-1 text-[9px] text-slate-400 ${m.sender === "visitor" ? "text-right" : ""}`}>
                          {m.sender === "visitor" ? (si ? "ඔබ" : "You") : m.sender_name || (si ? "නිලධාරියා" : "Officer")}
                        </div>
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-line ${
                            m.sender === "visitor"
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

              {/* ✅ චැට් එක close වුණාම — clear කරන්න ඇත්ත history එකක් තිබුණොත් විතරක් chat clear option එක */}
              {liveStatus === "closed" && clearable && (
                <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5 text-center">
                  <div className="text-[10.5px] font-semibold text-slate-500">
                    {si ? "මේ චැට් එක අවසන් කර ඇත. ඔබේ chat history ඉවත් කරගන්න පුළුවන්." : "This chat has ended. You can clear your chat history."}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(si ? "ඔබේ chat එක සහ history ඉවත් කරන්නද?" : "Clear this chat and your history?")) void endChat();
                    }}
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-1.5 text-[11px] font-extrabold text-white hover:bg-slate-900"
                  >
                    <Trash2 size={12} /> {si ? "Chat clear කරන්න" : "Clear chat"}
                  </button>
                </div>
              )}

              {liveErr && <div className="shrink-0 border-t border-rose-100 bg-rose-50 px-3 py-1.5 text-[10.5px] font-bold text-rose-700">{liveErr}</div>}

              <div className="shrink-0 border-t border-slate-200 bg-white p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] text-slate-400">{si ? "ඔබේ chat history ඔබේ උපාංගයේ පමණයි" : "Your chat history stays on your device"}</span>
                  {clearable && liveStatus !== "closed" && (
                  <button
                    onClick={() => {
                      if (confirm(si ? "chat එක සම්පූර්ණයෙන්ම අවසන් කරන්නද? ඔබේ history ඉවත් වේ." : "End this chat completely? Your history will be cleared.")) void endChat();
                    }}
                    className="flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[9.5px] font-extrabold text-rose-600 hover:bg-rose-100"
                    title={si ? "chat එක අවසන් කරන්න" : "End chat"}
                  >
                    <X size={10} /> {si ? "Chat clear" : "Clear chat"}
                  </button>
                  )}
                </div>
                {canChat ? (
                  <>
                {!visitorName.trim() && (
                  <input
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder={si ? "ඔබේ නම (අවශ්‍ය නම්)" : "Your name (optional)"}
                    className="mb-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] outline-none focus:border-indigo-400 focus:bg-white"
                  />
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={liveText}
                    onChange={(e) => onLiveType(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendLive();
                      }
                    }}
                    placeholder={si ? "ඔබේ පණිවිඩය ලියන්න…" : "Write your message…"}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:bg-white"
                  />
                  <button
                    onClick={() => void sendLive()}
                    disabled={!liveText.trim() || liveBusy}
                    className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-indigo-700 transition"
                  >
                    {liveBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <div className="mt-1 text-center text-[9px] text-slate-400">
                  {si ? "නිලධාරියෙක් සම්බන්ධ වූ පසු පිළිතුරු මෙතනම පේනවා" : "Officer replies appear right here"}
                </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[11.5px] font-extrabold text-amber-800">
                      {liveOfficeClosed || (sessionActive && liveStatus !== "closed") ? <Clock size={13} /> : <Lock size={13} />}
                      {liveStatus === "closed" && !liveOfficeClosed
                        ? si
                          ? "මේ chat එක අවසන් වී ඇත"
                          : "This chat has ended"
                        : liveOfficeClosed
                          ? si
                            ? "Live Chat දැන් වසා ඇත"
                            : "Live Chat is closed now"
                        : sessionActive
                          ? si
                            ? "නිලධාරියෙක් join වෙන තුරු රැඳී සිටින්න"
                            : "Waiting for an officer to join"
                          : si
                            ? "Live Chat එක තවම පටන් අරගෙන නෑ"
                            : "Live chat hasn't started yet"}
                    </div>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-amber-700">
                      {liveOfficeClosed
                        ? si
                          ? `මේ වෙලාවේ සජීවී නිලධාරියෙක් සම්බන්ධ කර ගැනීම අපහසුයි. කරුණාකර ${nextLiveOpenPhrase} නැවත සම්බන්ධ වෙන්න. එතෙක් පහතින් පණිවිඩයක් තියන්න පුළුවන්.`
                          : `It's difficult to connect you with a live officer at this time. Please reconnect ${nextLiveOpenPhrase}. Until then, you can leave a message below.`
                        : sessionActive && liveStatus !== "closed"
                        ? si
                          ? "ඔබේ ඉල්ලීම කාර්යාලයට ලැබී ඇත. නිලධාරියෙක් join වුණු ගමන් මෙතැනින් කෙලින්ම කතා කරන්න පුළුවන් — ඔබට ශබ්ද දැනුම්දීමකුත් එනවා."
                          : "Your request is with our office. The moment an officer joins, you can chat right here — you'll get a sound notification too."
                        : si
                          ? "මෙතැනින් කෙලින්ම පණිවිඩ යැවිය නොහැකියි. නිලධාරියෙක් සම්බන්ධ කරගන්න Baymax හරහා ඇමතුමක් ඉල්ලන්න."
                          : "You can't send messages from here directly. Request a call via Baymax to reach an officer."}
                    </p>
                    {!(sessionActive && liveStatus !== "closed") && !liveOfficeClosed && (
                      <button
                        onClick={() => void runAction("contact")}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 py-2 text-[11.5px] font-extrabold text-white transition hover:opacity-95"
                      >
                        <PhoneCall size={13} /> {si ? "Baymax හරහා ඇමතුමක් ඉල්ලන්න" : "Request a call via Baymax"}
                      </button>
                    )}
                    {liveOfficeClosed && (
                      <button
                        onClick={() => setTab("form")}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 py-2 text-[11.5px] font-extrabold text-white transition hover:opacity-95"
                      >
                        <Send size={13} /> {si ? "පණිවිඩයක් තියන්න" : "Leave a message"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={submitMessage} className="flex-1 overflow-y-auto bg-slate-50 p-3.5 space-y-2.5">
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-[11px] text-indigo-800 font-semibold">
                {si ? "📨 ඔබේ පණිවිඩය අපේ කාර්යාල inbox එකට යැවෙන අතර අපට email එකකුත් ලැබේ." : "📨 Your message goes to our office inbox and is emailed to us right away."}
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
              {sentErr && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-[11.5px] font-bold text-rose-700">
                  ⚠ {si ? `පණිවිඩය යැවීමට බැරි විය. නැවත උත්සාහ කරන්න, නැත්නම් ${SITE.phones[0]} අමතන්න.` : `Couldn't send your message. Please try again, or call ${SITE.phones[0]}.`}
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
