// ============================================================================
//  Baymax bot "brain" — intent detection for the Live Chat widget
//  ----------------------------------------------------------------------------
//  දෙබස් තේරුම් ගැනීමේ logic එක මෙතනයි තියෙන්නේ (React නැතුව pure functions).
//  අලුත් වචන / Singlish spellings bot එකට "ට්‍රේන්" කරන්න ඕන නම්
//  මේ file එකේ patterns වලට එකතු කරන්න විතරයි ඕනේ — UI එකට අත තියන්න එපා.
//  Tests: scripts/test.mts → "11) Baymax chatbot brain"
// ============================================================================

export type SmalltalkIntent =
  | "hi"
  | "hello"
  | "ayubowan"
  | "daypart"
  | "how_are_you"
  | "wellbeing_good"
  | "wellbeing_bad"
  | "thanks"
  | "bye"
  | "who_are_you"
  | "help"
  | "ok";

export type SmalltalkHit = {
  intent: SmalltalkIntent;
  /** daypart intent එකේදී විතරයි */
  part?: "morning" | "afternoon" | "evening" | "night";
};

export type FuelIntent = { type: "petrol92" | "super_diesel" | "kerosene" | null };
export type NewsIntent = { category: "vacancy" | "tender" | null };

/** intent matching සඳහා පණිවිඩය පිරිසිදු කිරීම — lowercase, punctuation නැතුව */
export function cleanText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'()[\]{}|\\@#*_~`^$%+=<>]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SINGLISH_WORDS =
  /\b(kohomada|kohomadha|komada|ayubowan|aayubowan|hodin|hodai|hondin|hondai|sthuthi|stuthi|bohoma|mage|oyage|oyata|mata|mama|udaw|udawwak|puluwanda|puluvanda|kiyada|monawada|hari|ela|machan|samajika|samajikaya|puwath|thethipola|pinthura|thel|mila|ganan|kiyanna|balanna|pennanna)\b/;

/** පණිවිඩය සිංහල/Singlish නම් true — reply සිංහලෙන්ද English වලින්ද තීරණය කරයි */
export function isSiMessage(raw: string): boolean {
  if (/[\u0D80-\u0DFF]/.test(raw)) return true; // සිංහල අකුරු
  return SINGLISH_WORDS.test(cleanText(raw));
}

/** reply භාෂාව — පණිවිඩය අනුව, බැරිනම් site භාෂාව අනුව */
export function replyIsSi(raw: string, siteSi: boolean): boolean {
  return isSiMessage(raw) ? true : siteSi;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Smalltalk (ආචාර විලාස / සුහද කතාබහ)
//  අනුපිළිවෙල වැදගත් — wellbeing_bad ට පෙර wellbeing_good බැලිය යුතු නෑ ("not good")
// ─────────────────────────────────────────────────────────────────────────────
export function detectSmalltalk(raw: string): SmalltalkHit | null {
  const c = cleanText(raw);
  if (!c) return null;
  const words = c.split(" ").length;

  // "නරකයි / හොඳ නෑ / not good" — good ට කලින් පරීක්ෂා කළ යුතුය
  if (
    /(නරකයි|හොඳ නෑ|හොද නෑ|දුකයි|දුකෙන්|අසනීප|narakai|honda na|honda nee|not (good|well|fine|ok)|feeling (bad|sick|low)|\b(bad|sick|sad)\b)/.test(c)
  ) {
    return { intent: "wellbeing_bad" };
  }

  // "මම හොඳින් / hodin / i'm fine"
  if (
    /(හොඳින්|හොදින්|hodin\b|hondin\b|i am (fine|good|well|ok)|im (fine|good|well|ok)|going (good|well))/.test(c) ||
    /^(fine|good|great|well|awesome|hodai|hondai|හොඳයි|හොදයි)( (thanks|thank you|ස්තූතියි))?$/.test(c)
  ) {
    return { intent: "wellbeing_good" };
  }

  // "kohomada / කොහොමද / how are you"
  if (
    /^(kohomada|kohomadha|komada)\b/.test(c) ||
    /(කොහොමද|කෝමද|සැප සනීප|how are you|how are u|how r u|hows it going|how is it going|whats up|how do you do)/.test(c) ||
    /^(kohomada|kohomadha)( oyata| obata)?$/.test(c)
  ) {
    return { intent: "how_are_you" };
  }

  // වේලාව අනුව ආචාරය
  if (/(good morning|සුබ උදෑසනක්|සුබ උදැසනක්|suba udasanak|suba udesanak)/.test(c)) return { intent: "daypart", part: "morning" };
  if (/(good afternoon|සුබ දහවලක්|suba dahavalak)/.test(c)) return { intent: "daypart", part: "afternoon" };
  if (/(good evening|සුබ සැන්දෑවක්|සුබ සවසක්|suba sandevak|suba savasak)/.test(c)) return { intent: "daypart", part: "evening" };
  if (/(good night|සුබ රාත්‍රියක්|suba rathriyak)/.test(c)) return { intent: "daypart", part: "night" };

  // ස්තූතියි
  if (/(thank|thnx|tnx|thanks|sthuthi|stuthi|ස්තූතියි|ස්තුතියි|ස්තූති)/.test(c)) return { intent: "thanks" };

  // ආයුබෝවන් (\b සිංහල අකුරු සමඟ වැඩ නොකරයි — \s|$ යොදා ගැනෙන්නේ එනිසයි)
  if (/^(aayubowan|ayubowan|ayubovan|ආයුබෝවන්|ආයුබෝ)(?:\s|$)/.test(c)) return { intent: "ayubowan" };

  // "ඔයා කවුද / නම මොකක්ද / who are you"
  if (
    /(who are you|your name|what are you|whats your name|ඔබ කවුද|ඔයා කවුද|ඔයාගෙ නම|ඔබේ නම|නම මොකක්ද|ඔයා මොකෙක්ද|oyage nama|nama mokakda|oya kawuda)/.test(c)
  ) {
    return { intent: "who_are_you" };
  }

  // Bye
  if (
    /^(bye+|good ?bye|see you|tata|ටටා|ගිහින් එන්නම්|ගිහින් එන්නං|බුදු ?සරණයි|budu saranai)( .*)?$/.test(c) ||
    /^(ok )?(bye|tata)$/.test(c)
  ) {
    return { intent: "bye" };
  }

  // උදව් / මෙනුව (කෙටි පණිවිඩ සඳහා පමණයි)
  if (
    words <= 5 &&
    (/^(help|menu|options|උදව්|මෙනුව?|විසඳුම්)( me| ඕන| ඕනේ| karanna)?$/.test(c) ||
      /(mata udawwak|udaw karanna|can you help|මට උදව්|උදව් කරන්න|උදව්වක් ඕන)/.test(c))
  ) {
    return { intent: "help" };
  }

  // "hello / hellow / හෙලෝ" — hi ට වඩා නිල වශයෙන් ආචාර කරයි
  if (/^(h[ae]llow?|helo|හෙලෝ|හලෝ|හෙලොව්|හාලෝ)( (there|baymax|bot|everyone|බොට්|ඔයා))?$/.test(c)) return { intent: "hello" };

  // "hi / hii / hai / හයි"
  if (/^(h+i+|hai|hey+|හයි|හායි|හේ)( (there|baymax|bot|machan|බොට්|ඔයා|යාළුවා))?$/.test(c)) return { intent: "hi" };

  // OK / හරි / එල / නියමයි
  if (/^(ok+|okay|kk|ඕකේ|හරි|hari|එල|ela|niyamai|නියමයි|ෂා|sha|patta|පට්ට|aha|අහා|හොඳයි|හොදයි|godak hodai)$/.test(c)) {
    return { intent: "ok" };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  නම අඳුන ගැනීම — "my name is Thushara" / "මගේ නම Thushara" / "mage nama ..."
//  bot එකට අනාගත දැනුම්දීම සඳහා නම මතක තබා ගැනීම (message වලින් ට්‍රේන් වීම)
// ─────────────────────────────────────────────────────────────────────────────
const NAME_STOP = new Set([
  "fine", "good", "well", "ok", "okay", "sorry", "here", "a", "an", "the", "looking",
  "searching", "happy", "sad", "from", "member", "not", "hodin", "hari", "baymax", "bot",
  "regarding", "calling", "writing", "asking", "waiting", "interested", "new", "just",
]);

export function detectNameIntro(raw: string): string | null {
  const hit =
    raw.match(/(?:my name is|i am|i'm|this is|ම\s*(?:ගේ|ගෙ)\s*නම|mage nama|magay nama)\s+([^\n.,;!?]{2,40})/i);
  if (!hit) return null;
  const parts = hit[1].trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (!parts.length) return null;
  if (NAME_STOP.has(parts[0].toLowerCase())) return null;
  const name = parts.join(" ").trim();
  // අකුරු තියෙන නම් විතරක් (අංක තියෙන ඒවා අතහරින්න — NIC වරදවා ගන්න එපා)
  if (!/[\p{L}]/u.test(name) || /\d/.test(name)) return null;
  return name.length >= 2 ? name : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ඉන්ධන — generic "fuel prices" → තෝරන මෙනුව · specific වර්ගය → ඒ මිල හරියටම
// ─────────────────────────────────────────────────────────────────────────────
export function detectFuel(raw: string): FuelIntent | null {
  const c = cleanText(raw);
  const types: FuelIntent["type"][] = [];
  if (/(kerosene|කිරෝසින්|භූමිතෙල්|lamp ?oil)/.test(c)) types.push("kerosene");
  if (/(diesel|ඩීසල්)/.test(c)) types.push("super_diesel");
  if (/(petrol|octane|ඔක්ටේන්|පෙට්‍රල්|\b92\b)/.test(c)) types.push("petrol92");

  const generic = /(fuel|ඉන්ධන|තෙල්|\bthel\b|filling)/.test(c);
  if (!generic && types.length === 0) return null;
  // වර්ග එකක්ම නම් ඒක · ගොඩක් නම් හෝ generic නම් selector එකට
  return { type: types.length === 1 ? types[0] : null };
}

// ─────────────────────────────────────────────────────────────────────────────
//  නිවේදන හා පුවත් — category filter එකත් සමඟ
// ─────────────────────────────────────────────────────────────────────────────
export function detectNews(raw: string): NewsIntent | null {
  const c = cleanText(raw);
  if (/(vacanc|job ?openings?|රැකියා|ඇබෑර්තු|ඇබැර්තු|වැකන්සි|rakiya|abarthu)/.test(c) || /^jobs?$/.test(c)) {
    return { category: "vacancy" };
  }
  if (/(tender|ටෙන්ඩර්|ලන්සු)/.test(c)) return { category: "tender" };
  if (
    /(news|notice|announcement|updates?|පුවත්|නිවේදන|දැන්වීම|විශේෂ දැන්වීම|puwath|nivedana)/.test(c)
  ) {
    return { category: null };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ගැලරිය
// ─────────────────────────────────────────────────────────────────────────────
export function detectGallery(raw: string): boolean {
  const c = cleanText(raw);
  return /(gallery|photos?|pictures?|ගැලරි|ඡායාරූප|චායාරූප|පින්තූර|පිංතූර|pinthura|pinthuru)/.test(c);
}

/** පැමිණිල්ලක් / ගැටලුවක් — නිලධාරියකුට භාර දීම වඩාත් සුදුසුයි */
export function detectComplaint(raw: string): boolean {
  const c = cleanText(raw);
  return /(complaint|complain|problem|issue|පැමිණිලි|පැමිණිල්ල|ප්‍රශ්නයක් තියෙනවා|ගැටලු|ගැටලුව|prashnayak|pamini)/.test(c);
}

/** ණය / ඉතුරුම් / උකස් — ග්‍රාමීය බැංකු සේවා */
export function detectBanking(raw: string): boolean {
  const c = cleanText(raw);
  return /(loan|loans|ණය|savings?|ඉතුරුම්|ඉතිරි කිරීම|pawning|pawn|උකස්|රන් උකස්|gold loan|rural bank|ග්‍රාමීය බැංකු)/.test(c);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Live Chat (officer) UI නීති
// ─────────────────────────────────────────────────────────────────────────────
/**
 * "Clear chat" option එක පෙන්විය යුතුද?
 * නීතිය: clear කරන්න ඇත්තටම පණිවිඩ තිබුණොත් විතරයි — visitor හෝ officer
 * කෙනෙකුගේ ඇත්ත පණිවිඩයක්. හිස් chat එකකවත්, system note ("Chat ended…")
 * විතරක් තියෙන (දැනටමත් clear කරපු) chat එකකවත් clear option එන්නේ නෑ.
 */
export function hasClearableHistory(messages: { sender: string }[]): boolean {
  return messages.some((m) => m.sender === "visitor" || m.sender === "agent");
}

/** "Officer/Visitor is typing…" පෙන්විය යුතුද? — chat එක live (joined) විට විතරයි, close කළාම කවදාවත් නෑ */
export function shouldShowTyping(status: string, typing: boolean): boolean {
  return status === "joined" && typing;
}

/**
 * Live Chat එකේ පණිවිඩ ලියන්න (composer එක unlock වෙන්න) පුළුවන්ද?
 * නීතිය: නිලධාරියෙක් ඇත්තටම join වී ඇති විට (status="joined") විතරයි.
 * ඊට කලින් visitor ට කෙලින්ම live chat පටන් ගන්න බෑ — Baymax හරහා
 * ඇමතුමක් ඉල්ලා, නිලධාරියා join වෙනකම් රැඳී සිටිය යුතුයි.
 */
export function canUseLiveChat(status: string): boolean {
  return status === "joined";
}

/** Baymax කතාබහ අතරේ තබා ගන්නා කෙටි කාලීන මතකය */
export interface BaymaxMemory {
  lastIntent?: string;
  name?: string;
  lastTopic?: string;
}

/**
 * Chat එක close/clear කළාම Baymax ගේ කතාබහ මතකය reset කරයි.
 * අන්තිම intent/topic වගේ follow-up context එක සම්පූර්ණයෙන්ම අයින් වේ;
 * visitor ගේ නම විතරක් තබා ගන්නේ ඒක chat history එකක් නොව device එකේ
 * visitor identity එකක් නිසායි (Live Chat එකෙත් ඒ නමම පාවිච්චි වේ).
 */
export function resetBaymaxMemory(memory: BaymaxMemory): BaymaxMemory {
  return memory.name ? { name: memory.name } : {};
}
