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

/**
 * සිංහල අකුරු ලියන විවිධ ක්‍රම එකම ආකාරයකට හරවයි.
 * උදා: සම්බන්ධ / සම්බඳ / සම්බන්ද → සම්බන්ද.
 * දුරකථන keyboard අනුව එන ZWJ/ZWNJ වෙනස්කම් ද මෙයින් ඉවත් වේ.
 */
export function normalizeSinhalaText(raw: string): string {
  return String(raw ?? "")
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/සම්බන්ධ/g, "සම්බන්ද")
    .replace(/සම්බඳ/g, "සම්බන්ද")
    .replace(/සබඳ/g, "සම්බන්ද");
}

/** intent matching සඳහා පණිවිඩය පිරිසිදු කිරීම — lowercase, punctuation නැතුව */
export function cleanText(raw: string): string {
  return normalizeSinhalaText(raw)
    .toLowerCase()
    .replace(/[.,!?;:"'()[\]{}|\\@#*_~`^$%+=<>]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SINGLISH_WORDS =
  /\b(kohomada|kohomadha|komada|ayubowan|aayubowan|hodin|hodai|hondin|hondai|sthuthi|stuthi|bohoma|mage|oyage|oyata|mata|mama|udaw|udawwak|puluwanda|puluvanda|kiyada|monawada|hari|ela|machan|samajika|samajikaya|puwath|thethipola|pinthura|thel|mila|ganan|kiyanna|balanna|pennanna|ona|onee|oona|oni|awashya|awashyai|kenek|kenekwa|kenekta|kenekuta|sambanda|sambandha|sambadha|karaganna|karagannawa|katha|kathakaranna|niladari|niladhari|karyalaya|karyalaye|karunakarala|karunakara)\b/;

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
  // Sinhala/Singlish "කොහොමද" is also the ordinary "how?" in factual
  // questions (e.g. "සාමාජික වෙන්නේ කොහොමද?"), so treat it as a greeting
  // only when the whole message is greeting-shaped.
  if (
    /^(oyata |obata )?(kohomada|kohomadha|komada)( oyata| obata| baymax| bot)?$/.test(c) ||
    /^(ඔයාට |ඔබට |ඔයා |ඔබ |baymax |බොට් )?(කොහොමද|කෝමද)( ඉන්නේ| ඉන්නවාද| තියෙන්නේ| baymax| බොට්)?$/.test(c) ||
    /(සැප සනීප|how are you|how are u|how r u|hows it going|how is it going|whats up|how do you do)/.test(c)
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

  // "ඔයා කවුද / ඔයාගේ නම මොකක්ද / who are you"
  // A bare "නම මොකක්ද" means the BOT's name, but "සභාපතිගේ නම මොකක්ද" or
  // "සමිතියේ නම මොකක්ද" is a factual site question — those must reach the
  // knowledge brain, so the name-only forms are anchored to the full message.
  if (
    /(who are you|your name|what are you|whats your name|ඔබ කවුද|ඔයා කවුද|ඔයා මොකෙක්ද|ඔයාගෙ නම|ඔයාගේ නම|ඔබේ නම|ඔබගේ නම|oyage nama|oya kawuda|oba kawuda)/.test(c) ||
    /^(ඔයාගේ |ඔයාගෙ |ඔබගේ |ඔබේ |බොට් එකේ |බොට්ගේ )?නම( මොකක්ද| මොකද්ද)?$/.test(c) ||
    /^(oyage |obage |bot |baymax )?(nama|name)( mokakda)?$/.test(c)
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
//  Signed-in greeting නම — guest කෙනෙක්ට හෝ වෙන visitor කෙනෙක් browser එකේ
//  කියපු නමක් කවදාවත් greeting එකට ගන්නේ නෑ. නම එන්නේ sign in වී ඇති
//  profile එකෙන්ම පමණයි: සාමාන්‍ය user නම් ඒ user ගෙ නම, admin නම් ඒ
//  admin ගෙ නම. Profile එකක් නැති (guest) විට නම හිස් — "Hi" පමණයි.
// ─────────────────────────────────────────────────────────────────────────────
export type GreetingProfile = {
  full_name?: string | null;
  auth_email?: string | null;
  nic?: string | null;
  role?: string | null;
} | null | undefined;

/** Baymax සහ මේ website එක නිර්මාණය කර පුහුණු කළ පුද්ගලයා (identity පිළිතුරු සඳහා) */
export const BAYMAX_CREATOR_NAME = "Induwara Thathsara";
export const BAYMAX_CREATOR_PHONE = "0764247716";

const GENERIC_PROFILE_NAMES = new Set([
  "super administrator",
  "super admin",
  "superadmin",
  "administrator",
  "admin",
  "member",
  "user",
  "guest",
]);

function tidyDisplayName(value: string): string {
  const name = value.replace(/\s+/g, " ").trim().slice(0, 60).trim();
  if (!name) return "";
  // සිංහල නම් ඒ විදිහටම — Latin නම් all-lower/all-upper නම් Title Case කරයි
  if (/\p{Script=Sinhala}/u.test(name)) return name.split(" ").slice(0, 4).join(" ");
  if (name === name.toLowerCase() || name === name.toUpperCase()) {
    return name
      .toLowerCase()
      .split(" ")
      .slice(0, 4)
      .map((w) => (w.includes(".") ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ");
  }
  return name.split(" ").slice(0, 4).join(" ");
}

/** NIC එකක් වගේ පෙනෙන අගයන් greeting නමක් ලෙස කවදාවත් පාවිච්චි කරන්නේ නෑ */
function looksLikeNicValue(value: string): boolean {
  const v = value.replace(/[\s-]/g, "");
  return /^\d{12}$/.test(v) || /^\d{9}[vVxX]$/.test(v) || /^\d+$/.test(v);
}

export function greetingDisplayName(profile: GreetingProfile): string {
  if (!profile) return "";
  const full = tidyDisplayName(String(profile.full_name ?? ""));
  if (full && !GENERIC_PROFILE_NAMES.has(full.toLowerCase())) return full;

  const email = String(profile.auth_email ?? "").trim().toLowerCase();
  const nic = String(profile.nic ?? "").trim();
  // මුල සිටම සිටින root superadmin ගිණුම — profile නම සාමාන්‍ය label එකක්
  // ("Super Administrator") වුවත් ඒ ගිණුමේ අයිතිකරුගේ නමින් ආචාර කරයි
  if (nic.toUpperCase() === "SUPERADMIN") {
    return tidyDisplayName(BAYMAX_CREATOR_NAME);
  }
  // custom username එකක් (උදා: ITKWEB) NIC slot එකේ තිබේ නම් එයයි username එක
  if (nic && /[A-Za-z]/.test(nic) && !looksLikeNicValue(nic)) return tidyDisplayName(nic);
  // ඊමේල් එකේ @ ට කලින් කොටස username එකක් ලෙස (අංක/ NIC නම් එපා)
  const emailUser = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  if (emailUser && /[a-z]/i.test(emailUser) && !looksLikeNicValue(emailUser.replace(/\s/g, ""))) {
    return tidyDisplayName(emailUser);
  }
  // අවසානයේ generic profile ලේබලය (උදා: "Super Administrator")
  return full;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bot / website identity ප්‍රශ්න — "ඔයාගේ model එක මොකක්ද?", "ඔයාව හැදුවේ
//  කවුද?", "මේ website එක හැදුවේ කවුද?", "website admin ගේ නම්බර් එක".
//  මේවා AI එකට යන්නේ නැතිව ස්ථිර නිවැරදි පිළිතුරු ලැබිය යුතුයි, ඒ නිසා
//  live-chat එකේ සියල්ලටම කලින් මේ detector එක දුවයි.
// ─────────────────────────────────────────────────────────────────────────────
export type BotIdentityIntent = "model" | "creator" | "website_creator" | "website_admin_contact";

export function detectBotIdentityIntent(raw: string): BotIdentityIntent | null {
  const c = cleanText(raw);
  if (!c) return null;
  const words = c.split(" ").filter(Boolean).length;

  const websiteRef =
    /(website|web ?site|web ?page|webpage|site|වෙබ්|මේ අඩවිය|මෙම අඩවිය|අඩවිය|සයිට්)/.test(c);
  const adminWord =
    /(admin|administrator|webmaster|developer|ඇඩ්මින්|ඇඩ්මිනිස්ට්‍රේටර්|පරිපාලක|ඩිවලපර්)/.test(c);
  const contactAsk =
    /(name|number|phone|contact|telephone|mobile|call|who|නම|අංකය|අංකයක්|නම්බර්|නොම්බර|දුරකථන|දුරකතන|කවුද|කව්ද|සම්බන්ධ|සම්බන්ද)/.test(c);
  const officeContext =
    /(office|society|mpcs|කාර්යාල|සමිතිය|සමූපකාර|ඔෆිස්)/.test(c);

  // 1) Website admin ගේ නම/අංකය — "website admin ge number eka" වගේ ඒවාත්
  if (adminWord && contactAsk && (websiteRef || !officeContext)) {
    return "website_admin_contact";
  }

  // නිර්මාණය සම්බන්ධ වචන (සිංහල/Singlish) — English වල loose "make/train"
  // පාවිච්චි කරන්නේ නෑ: "how do you make tea?" / "train schedule" වගේ
  // සාමාන්‍ය ප්‍රශ්න වරදවා අල්ලන්නේ නැති වෙන්නයි.
  const creationSi =
    /(හැදුව|හැදූ|හදපු|හදාගන|හදාගත්|සාදපු|සෑදුව|නිර්මාණය|නිර්මාණ|සකස් ?කළ|සකස් ?කල|සකසපු|පුහුණු ?කළ|පුහුණු ?කල|haduwa|haduwe|haduwada|hadapu|hadaganna|hadagat|sakas ?kala|nirmanaya|puhunu ?kala|train ?kala)/.test(c);
  const creationEnForWebsite =
    /(made|created|creator|built|developed|developer|designed|designer|author|owner|programmed|coded)/.test(c);

  // 2) මේ website එක හැදුවේ කවුද?
  if (websiteRef && (creationSi || creationEnForWebsite)) return "website_creator";

  // 3) ඔයාව හැදුවේ/පුහුණු කළේ කවුද? · ඔයාව හදාගත්තේ කොහොමද?
  //    Bot එක වස්තුව විදිහට (ඔයාව/ඔබව/…you) තිබිය යුතුයි — නැත්නම්
  //    "ඔයා කේක් හදන්නේ කොහොමද?" වගේ ප්‍රශ්නත් අල්ලනවා.
  const botObject =
    /(ඔයාව|ඔබව|බොට්|බේමැක්ස්|baymax|\b(oyawa|obawa)\b)/.test(c);
  const creationEnForBot =
    /((made|created|built|developed|designed|trained|programmed|coded|invented) you|you were (made|created|built|developed|designed|trained|programmed)|your (creator|developer|maker|trainer|designer|author|owner))/.test(c);
  const yourRef = /(your|ඔයාගේ|ඔයාගෙ|ඔබගේ|ඔබේ|\b(oyage|obage)\b)/.test(c);
  const makerNoun = /(නිර්මාණකරු|හදපු කෙනා|හදපු කෙන|පුහුණු කළ කෙනා|creator|developer|maker|trainer)/.test(c);
  if ((botObject && creationSi) || creationEnForBot || (yourRef && makerNoun)) return "creator";

  // 4) Model / AI ප්‍රශ්න — "ඔයාගේ model එක මොකක්ද", "මොන AI එකද ඔයා",
  //    "are you <provider>?" වගේ ඒවා. (Provider නම් මෙතැන ඇත්තේ හඳුනාගැනීමට
  //    විතරයි — පිළිතුරේ ඒ වචන කවදාවත් එන්නේ නෑ.) "search google for…"
  //    වගේ සෙවුම් ඉල්ලීම් අල්ලන්නේ නැති වෙන්න provider කොටස කෙටි
  //    ප්‍රශ්නවලට විතරක් සීමා කර ඇත.
  const botRef =
    /(you|your|baymax|bot|chatbot|assistant|ඔයා|ඔයාව|ඔයාගේ|ඔයාගෙ|ඔබ|ඔබව|ඔබගේ|ඔබේ|බොට්|බේමැක්ස්|\b(oya|oyawa|oyage|oba|obawa|obage)\b)/.test(c);
  if (yourRef && /(model|මොඩල්|version|\bai\b|තාක්ෂණ)/.test(c)) return "model";
  if (/(you|baymax|bot|ඔයා|ඔබ|බොට්|\b(oya|oba)\b).{0,25}(model|මොඩල්)/.test(c)) return "model";
  if (/(model|මොඩල්).{0,25}(you|baymax|bot|ඔයා|ඔබ|බොට්|\b(oya|oba)\b)/.test(c)) return "model";
  if (botRef && /(what ai|which ai|මොන ai|මොකක්ද ai)/.test(c)) return "model";
  if (
    words <= 6 &&
    /(are you|you are|ඔයා|ඔබ|\b(oya|oba)\b).{0,30}(google|gemini|flash|gpt|chatgpt|openai|claude|llama)/.test(c)
  ) {
    return "model";
  }

  return null;
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

const SINHALA_INTENT_FOLD: Record<string, string> = {
  ඛ: "ක",
  ඝ: "ග",
  ඡ: "ච",
  ඣ: "ජ",
  ඨ: "ට",
  ඪ: "ඩ",
  ථ: "ත",
  ධ: "ද",
  ඵ: "ප",
  භ: "බ",
  ශ: "ස",
  ෂ: "ස",
  ණ: "න",
  ළ: "ල",
};

/**
 * Officer intent එකට විතරක් පාවිච්චි කරන පුළුල් සිංහල අකුරු සමාන කිරීම.
 * උදා: නිලධාරි→නිලදාරි, සම්බඳ→සම්බන්ද. මෙය පොදු පිරිසිදු කිරීමට දාන්නේ
 * නැත්තේ වෙනත් සුහද වචනවල තේරුම වෙනස් නොවීමටයි.
 */
function foldSinhalaForIntent(cleaned: string): string {
  return cleaned
    .replace(/ඳ/g, "න්ද")
    .replace(/ඟ/g, "න්ග")
    .replace(/ඦ/g, "න්ජ")
    .replace(/ඬ/g, "න්ඩ")
    .replace(/ඹ/g, "ම්බ")
    .replace(/න්ධ/g, "න්ද")
    .replace(/[ඛඝඡඣඨඪථධඵභශෂණළ]/g, (ch) => SINHALA_INTENT_FOLD[ch] ?? ch);
}

/**
 * visitor ඇත්තටම කාර්යාලයේ කෙනෙකු/නිලධාරියෙකු සම්බන්ද කරගන්න කියනවද?
 *
 * කාර්යාල අංකය, නිලධාරියාගේ නම, ලිපිනය හෝ වේලාවන් අහන factual
 * ප්‍රශ්න මෙයට වැටෙන්නේ නෑ — ඒවා site brain එකෙන්ම උත්තර ලැබිය යුතුයි.
 * කෙලින්ම තර්කය: සම්බන්ද වීම/කතා කිරීම + (කෙනෙක්, නිලධාරියෙක් හෝ
 * කාර්යාලය) · නැත්නම් කෙනෙක් + "ඕන/අවශ්‍යයි".
 */
export function detectOfficerRequest(raw: string): boolean {
  const c = foldSinhalaForIntent(cleanText(raw));
  if (!c) return false;
  const compact = c.replace(/\s+/g, "");

  const asksHow =
    /(කොහොමද|කෙසේද|ආකාරය|විදිහ|ක්‍රමය|පියවර|හැටි|how (to|do|can)|process|procedure|steps?)/.test(c);
  const explicitWant =
    /(ඕන|ඕනා|ඕනෙ|ඕනේ|ඕනෑ|අවශ්‍ය|අවශය|අවස්‍ය|වුවමනා|කරලා දෙන්න|කරල දෙන්න|දෙන්න පුලුවන්ද|දෙන්න පුළුවන්ද|පුලුවන්ද|පුළුවන්ද|want|need|please connect|connect me|call me|\b(ona|onee|oona|oni|awashya|awashyai)\b)/.test(c);
  // "සම්බන්ද කරගන්නෙ කොහොමද" වගේ ක්‍රමය විතරක් අහන විට දැනුම් පිළිතුරට ඉඩ දෙමු.
  // "මට ... ඕන" වගේ සෘජු ඉල්ලීමක් නම් කෙලින්ම නිලධාරි flow එකට යමු.
  if (asksHow && !explicitWant) return false;

  if (/(live\s*chat|live agent|සජීවී|සජීවි|ලයිව්)/.test(c) || compact === "livechat") return true;

  const explicitConnect =
    /(සම්බන්ද\s*කර|සම්බන්ද\s*වෙන්න|ඇමතුමක්\s*(ඉල්ල|ගන්න|දෙන්න)|අමතන්න ඕන|අමතන්න අවස්‍ය|යොමු\s*කරන්න|call\s*back|callback|connect me|contact me|call me|talk to (a |an )?(human|person|officer|agent)|speak to (a |an )?(human|person|officer|agent)|sambanda\s*kara|sambandha\s*kara|sambada\s*kara)/.test(c) ||
    compact.includes("සම්බන්දකර") ||
    compact.includes("sambandakara") ||
    compact.includes("සම්බන්දවෙන්න") ||
    compact.includes("ඇමතුමක්ඉල්ල") ||
    /(මට|මාව)\s+.*(අමතන්න|ඇමතුමක් දෙන්න|කෝල් එකක් දෙන්න)/.test(c);
  if (explicitConnect) return true;

  // සාමාජිකයෙකු සෙවීම නිලධාරි ඉල්ලීමක් නෙමෙයි.
  if (/(සාමාජික|member|nic|හැඳුනුම්පත්|හැදුනුම්පත්|සොයන්න|හොයන්න|සොයා|search|find a member)/.test(c)) {
    return false;
  }

  // දුරකතන අංකය/නම/ලිපිනය/වේලාව වගේ තොරතුරු විතරක් අහන විට site brain එකට ඉඩ දෙමු.
  const asksForInfo =
    /(දුරකතන\s*අංක|දුරකතන\s*අංකය|දුරකතන\s*අංකයක්|නොම්බර|නොම්මර|අංකය (මොකක්ද|මොකද|දෙන්න|ඕන)|ඊමේල්|email|ලිපිනය|ලිපින|කොහෙද|කොහේද|කොතනද|වේලාව|වෙලාව|විවෘත\s*වේලා|කවුද|කව්ද|නම (මොකක්ද|මොකද|දෙන්න|ඕන)|phone number|telephone number|contact number|who is|what is (the )?(phone|number|name|address)|where is|opening hours|office hours|number eka|phone eka|nama mokadda)/.test(c);
  if (asksForInfo) return false;

  const personTarget =
    /(නිලදාරි|නිලධාරි|ඔෆිසර්|සේවකයෙක්|සේවක මහත්ම|කාර්ය\s*මණ්ඩල|කාර්ය\s*මන්ඩල|නියෝජිත|උපකාරකයෙක්|සහායකයෙක්|මනුස්සයෙක්|පුද්ගලයෙක්|කෙනෙක්|කෙනෙකු|කෙනෙක්ට|කෙනෙක්ව|කාටහරි|කවුරුහරි|කාහරි|කවුරුන්හරි|මහත්මයෙක්|මහත්මියක්|සර් කෙනෙක්|මැඩම් කෙනෙක්|\b(officer|agent|human|representative|staff member|someone|somebody|real person|niladari|niladhari|kenek|kenekwa|kenekta|kenekuta|kawruhari|katahari)\b)/.test(c);
  const officeTarget =
    /(කාර්යාල|කාරියාල|ඔෆිස්|ඔෆීස්|ඕෆිස්|ඔබිස්|ඔපිස්|ආයතනය|office|offis|opis|ofis|karyalaya|karyalaye|kariyalaya)/.test(c);
  const genericPersonOnlyTarget =
    /(කෙනෙක්|කෙනෙකු|කාටහරි|කවුරුහරි|කාහරි|කවුරුන්හරි|\b(kenek|kenekwa|kenekta|kenekuta|kawruhari|katahari|someone|somebody)\b)/.test(c);
  const connectAction =
    /(සම්බන්ද|කතා|අමත|ඇමතුම|කෝල්|හමුවෙන්න|හම්බවෙන්න|හමුවීමට|යොමු\s*කර|\b(connect|contact|talk|speak|call|chat|sambanda|sambandha|sambada|katha|kathakaranna|amathanna)\b)/.test(c);
  const desire =
    /(ඕන|ඕනා|ඕනෙ|ඕනේ|ඕනෑ|අවශ්‍ය|අවශය|අවස්‍ය|වුවමනා|කරගන්න|කරලා දෙන්න|දෙන්න පුලුවන්ද|දෙන්න පුළුවන්ද|පුලුවන්ද|පුළුවන්ද|\b(want|need|please|ona|onee|oona|oni|awashya|awashyai|karaganna)\b)/.test(c);

  if (connectAction && (personTarget || officeTarget)) return true;
  // "ඔෆිස් එකේ කෙනෙක්ව ඕන" — කෙනෙක් + අවශ්‍යතාවක් ඇත්නම් නිලධාරි flow එකයි.
  if (desire && personTarget && (!genericPersonOnlyTarget || officeTarget || connectAction)) return true;

  // කෙටිම "නිලධාරියා / officer / human" වගේ වචන වලින් ඇසුවත් කළ යුතු දෙය පැහැදිලියි.
  if (
    /^(නිලදාරියා|නිලදාරියෙක්|නිලධාරියා|නිලධාරියෙක්|officer|agent|human|real person|niladari|niladhari)$/.test(c) ||
    /(නිලදාරියෙක්|නිලධාරියෙක්|live agent|human agent|real person|support (team|agent)|customer (care|service))/.test(c)
  ) {
    return true;
  }

  return false;
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

// ─────────────────────────────────────────────────────────────────────────────
//  Live Chat කාර්යාල වේලාවන් (Asia/Colombo)
//  සඳුදා–සිකුරාදා 08:30–17:30 · සෙනසුරාදා 08:30–13:30 · ඉරිදා වසා ඇත
//  මේ සීමාව අදාළ වන්නේ සජීවී නිලධාරියෙක් සම්බන්ධ කර ගැනීමට විතරයි —
//  Baymax සහ Message පෙට්ටිය 24/7 වැඩ කරයි. දැනටමත් join වී ඇති
//  සංවාදයක් වේලාව ඉක්මවා ගියාට මැදින් නවත්වන්නේ නැත.
// ─────────────────────────────────────────────────────────────────────────────
export type LiveChatHoursStatus = {
  open: boolean;
  /** Sri Lanka වේලාවෙන් දවස — 0=ඉරිදා … 6=සෙනසුරාදා */
  weekday: number;
  /** Sri Lanka වේලාවෙන් මධ්‍යම රාත්‍රියේ සිට විනාඩි */
  minutes: number;
  /** ඊළඟට විවෘත වන දිනයට තව දින කීයක්ද (0=අද, 1=හෙට) */
  nextOpenInDays: number;
  nextOpenWeekday: number;
};

const LC_OPEN_MIN = 8 * 60 + 30; // 08:30
const LC_CLOSE_WEEKDAY = 17 * 60 + 30; // 17:30
const LC_CLOSE_SATURDAY = 13 * 60 + 30; // 13:30
const WEEKDAY_SI = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** visitor ලෝකේ කොහේ හිටියත් ගණනය වන්නේ ශ්‍රී ලංකා වේලාවෙන් (UTC+5:30) */
export function getLiveChatHoursStatus(now: Date = new Date()): LiveChatHoursStatus {
  const lk = new Date(now.getTime() + 330 * 60_000);
  const weekday = lk.getUTCDay();
  const minutes = lk.getUTCHours() * 60 + lk.getUTCMinutes();

  let open = false;
  if (weekday >= 1 && weekday <= 5) open = minutes >= LC_OPEN_MIN && minutes < LC_CLOSE_WEEKDAY;
  else if (weekday === 6) open = minutes >= LC_OPEN_MIN && minutes < LC_CLOSE_SATURDAY;

  let nextOpenInDays = 0;
  if (!open) {
    if (weekday === 0) nextOpenInDays = 1; // ඉරිදා → සඳුදා
    else if (weekday === 6) nextOpenInDays = minutes < LC_OPEN_MIN ? 0 : 2; // සෙනසුරාදා හවස → සඳුදා
    else nextOpenInDays = minutes < LC_OPEN_MIN ? 0 : 1; // සතියේ දින: උදේ නම් අද, හවස නම් හෙට
  }

  return { open, weekday, minutes, nextOpenInDays, nextOpenWeekday: (weekday + nextOpenInDays) % 7 };
}

export function isLiveChatOpen(now: Date = new Date()): boolean {
  return getLiveChatHoursStatus(now).open;
}

/** "අද පෙ.ව. 8.30න් පසුව" / "after 8:30 AM on Monday" වැනි ඊළඟ විවෘත වන වේලාව */
export function nextLiveChatOpenPhrase(si: boolean, now: Date = new Date()): string {
  const s = getLiveChatHoursStatus(now);
  if (si) {
    if (s.nextOpenInDays === 0) return "අද පෙ.ව. 8.30න් පසුව";
    if (s.nextOpenInDays === 1) return `හෙට (${WEEKDAY_SI[s.nextOpenWeekday]}) පෙ.ව. 8.30න් පසුව`;
    return `${WEEKDAY_SI[s.nextOpenWeekday]} පෙ.ව. 8.30න් පසුව`;
  }
  if (s.nextOpenInDays === 0) return "after 8:30 AM today";
  if (s.nextOpenInDays === 1) return `after 8:30 AM tomorrow (${WEEKDAY_EN[s.nextOpenWeekday]})`;
  return `after 8:30 AM on ${WEEKDAY_EN[s.nextOpenWeekday]}`;
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
