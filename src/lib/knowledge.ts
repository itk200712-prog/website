// ============================================================================
// Baymax site brain — grounded answers from the society's own public content
// ----------------------------------------------------------------------------
// This module is deliberately NOT an external generative-AI call.  It builds
// a searchable knowledge index from public website data (business divisions,
// services, contacts, branches, board, news, gallery and the static guidance
// below) and finds the most relevant verified answer.  If nothing on the site
// supports an answer, it returns null so Baymax can admit that and offer an
// officer instead of inventing facts.
//
// Matching supports Sinhala script, English and common romanised Sinhala
// (Singlish) through phrase/keyword scoring, light stemming, substring matches
// for inflected words and small spelling mistakes.
// ============================================================================

import { cleanText } from "./chatbot";
import { SITE } from "./seed";
import type {
  BoardMember,
  BusinessUnit,
  GalleryItem,
  NewsItem,
  SiteSettings,
} from "./types";

export type KnowledgeKind =
  | "static"
  | "business"
  | "business-services"
  | "service"
  | "business-contact"
  | "branch"
  | "board"
  | "person"
  | "news"
  | "gallery";

export interface RuralBranchInfo {
  no?: string;
  name: string;
  name_si: string;
  manager: string;
  phone: string;
}

export interface KnowledgeSourceData {
  businesses: BusinessUnit[];
  board: BoardMember[];
  ruralBranches: RuralBranchInfo[];
  news: NewsItem[];
  gallery: GalleryItem[];
  settings: SiteSettings;
}

export interface KnowledgeEntry {
  id: string;
  kind: KnowledgeKind;
  title_si: string;
  title_en: string;
  body_si: string;
  body_en: string;
  keywords: string[];
  href?: string;
  linkLabel_si?: string;
  linkLabel_en?: string;
  chips_si?: string[];
  chips_en?: string[];
  topic?: string;
  emoji?: string;
}

export interface IndexedKnowledgeEntry extends KnowledgeEntry {
  titlePhrases: string[];
  keywordPhrases: string[];
  titleTokens: string[];
  keywordTokens: string[];
  bodyTokens: string[];
  searchBody: string;
}

export interface KnowledgeResult {
  entry: IndexedKnowledgeEntry;
  score: number;
  matched: number;
  ambiguous: boolean;
  alternatives: IndexedKnowledgeEntry[];
}

// ---------------------------------------------------------------------------
// Normalisation, synonyms and fuzzy matching
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  // English question/function words
  "what", "which", "who", "where", "when", "why", "how", "can", "could", "would",
  "tell", "give", "show", "please", "plz", "about", "the", "a", "an", "is", "are",
  "was", "were", "do", "does", "did", "have", "has", "had", "in", "on", "at", "for",
  "of", "to", "and", "or", "with", "from", "this", "that", "it", "its", "i", "me",
  "my", "we", "you", "your", "there", "here", "any", "all", "more", "need", "want",
  "know", "find", "get", "make", "into", "our", "us", "be", "am", "one",
  // Sinhala-script function words / question endings
  "මොකක්ද", "මොනවාද", "මොනවද", "කොහොමද", "කවුද", "කව්ද", "කොහෙද", "කවදාද", "ඇයි", "කීයද",
  "මට", "මම", "ඔබ", "ඔයා", "ඔයාලා", "ඔයාලගේ", "ඔයාලාගේ", "අපි", "දෙන්න", "දෙනවද", "කියන්න", "ගැන", "එක", "එකේ", "එකක්",
  "සහ", "හෝ", "හි", "හිද", "තියෙනවද", "තියෙනවාද", "පුළුවන්ද", "පුලුවන්ද", "කරන්නේ", "කරන්න",
  "ගන්නේ", "ගන්න", "වෙන්නේ", "වේද", "ද", "දැයි", "අද", "තව", "විස්තර", "ටිකක්", "ලැබෙන්නේ",
  // Romanised Sinhala function words
  "mokakda", "monawada", "monawada", "kohomada", "kawuda", "kauda", "koheda", "kawadada",
  "ai", "mata", "mama", "oyata", "oya", "oyala", "oyalage", "oyaalage", "api", "dena", "denawada", "kiyanna", "gena",
  "eka", "eke", "ekak", "saha", "ho", "thiyenawada", "thiyenawada", "puluwanda",
  "karanna", "karanne", "ganna", "ganne", "wenne", "weda", "da", "thawa", "visthara",
  "tikak", "ona", "one", "labenne", "kiyada", "keeyada",
]);

// Frequent romanised Sinhala / alternate spellings are folded onto the word
// used in the site's English copy, so one index can answer in all three forms.
const SYNONYMS: Record<string, string> = {
  // Romanised Sinhala → the English word used in the site copy
  samajika: "member",
  samajikathwaya: "membership",
  samajikatwaya: "membership",
  samajikatvaya: "membership",
  samithi: "society",
  samithiya: "society",
  samithiye: "society",
  samitiye: "society",
  samithiyage: "society",
  samitiyage: "society",
  nama: "name",
  nameka: "name",
  sampurna: "full",
  sampoorna: "full",
  liyapadinchi: "register",
  lipadinchi: "register",
  ayadumpatha: "application",
  ayadum: "apply",
  bankuwa: "bank",
  banku: "bank",
  gramiya: "rural",
  graamiya: "rural",
  ithurum: "savings",
  ithuru: "savings",
  thanpathu: "deposit",
  thanpatu: "deposit",
  naya: "loan",
  ukas: "pawning",
  ukasa: "pawning",
  ran: "gold",
  rathran: "gold",
  raththaran: "gold",
  pohora: "fertilizer",
  kiri: "milk",
  thel: "fuel",
  indhana: "fuel",
  sabhapathi: "chairman",
  sabapati: "chairman",
  sabapathi: "chairman",
  sabapathige: "chairman",
  sabhapatige: "chairman",
  chaiman: "chairman",
  charman: "chairman",
  chairmans: "chairman",
  lekam: "secretary",
  adyaksha: "director",
  adyakshaka: "director",
  kalamanakarua: "manager",
  kalamanakaru: "manager",
  kalamanakaruge: "manager",
  manajar: "manager",
  manejer: "manager",
  jeneral: "general",
  chanda: "voter",
  chandaya: "voter",
  puwath: "news",
  niwedana: "notice",
  niwedhana: "notice",
  rakiya: "vacancy",
  rakia: "vacancy",
  galariya: "gallery",
  galary: "gallery",
  pinthura: "photo",
  pinthuru: "photo",
  sewa: "service",
  sewawa: "service",
  sewawan: "service",
  shakha: "branch",
  shaka: "branch",
  shakawa: "branch",
  lipinaya: "address",
  durakathana: "phone",
  ankaya: "number",
  nomberaya: "number",
  nombare: "number",
  ganana: "count",
  keeyak: "count",
  kiyak: "count",
  wastawa: "about",
  unilever: "uniliver",
  restbury: "ristbury",
  restberry: "ristbury",
  risbury: "ristbury",
  malibun: "maliban",
  malibon: "maliban",
  meliban: "maliban",
  baliban: "maliban",
  bisket: "biscuit",
  biscket: "biscuit",
  biscuts: "biscuit",
  suparmarket: "supermarket",
  suppermarket: "supermarket",
  insuarance: "insurance",
  insurence: "insurance",

  // Common Sinhala-script spelling/inflection variants → canonical site word
  "සබාපති": "සභාපති",
  "සබාපතිගේ": "සභාපති",
  "සභාපතිගේ": "සභාපති",
  "සබාපතිවරයා": "සභාපති",
  "සභාපතිවරයා": "සභාපති",
  "සබාපතිතුමා": "සභාපති",
  "සභාපතිතුමා": "සභාපති",
  "උපසබාපති": "උප සභාපති",
  "උපසභාපති": "උප සභාපති",
  "සමිතියේ": "සමිතිය",
  "සමිතියෙ": "සමිතිය",
  "සමිතියගේ": "සමිතිය",
  "කළමනාකරුගේ": "කළමනාකරු",
  "කළමනාකරුවා": "කළමනාකරු",
  "අධ්‍යක්ෂවරයා": "අධ්‍යක්ෂ",
  "අධ්‍යක්ෂවරුන්": "අධ්‍යක්ෂ",
  "මැලිබන්": "මාලිබන්",
  "බැලිබන්": "මාලිබන්",
  "මාලිබ්න්": "මාලිබන්",
  "සූපර්": "සුපර්",
  "මාකට්": "මාර්කට්",
};

function stemLatin(token: string): string {
  let t = SYNONYMS[token] ?? token;
  if (!/^[a-z0-9]+$/.test(t) || t.length < 5) return t;
  if (t.endsWith("ies") && t.length > 5) t = `${t.slice(0, -3)}y`;
  else if (t.endsWith("ing") && t.length > 6) t = t.slice(0, -3);
  else if (t.endsWith("ed") && t.length > 5) t = t.slice(0, -2);
  else if (t.endsWith("es") && t.length > 5) t = t.slice(0, -2);
  else if (t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  return SYNONYMS[t] ?? t;
}

export function normalizeKnowledgeText(raw: string): string {
  return cleanText(String(raw ?? ""))
    .replace(/[’]/g, "'")
    .replace(/'/g, "")
    .replace(/&/g, " and ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function knowledgeTokens(raw: string, includeStopwords = false): string[] {
  return normalizeKnowledgeText(raw)
    .split(" ")
    .map((token) => stemLatin(token))
    .filter((token) => token.length >= 2 && (includeStopwords || !STOPWORDS.has(token)));
}

function tokenPhrase(raw: string): string {
  return knowledgeTokens(raw).join(" ");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return prev[b.length];
}

function fuzzyTokenMatch(token: string, candidates: string[]): boolean {
  if (!/^[a-z0-9]+$/.test(token) || token.length < 5) return false;
  const allowed = token.length >= 8 ? 2 : 1;
  return candidates.some(
    (candidate) =>
      /^[a-z0-9]+$/.test(candidate) &&
      Math.abs(candidate.length - token.length) <= allowed &&
      levenshtein(token, candidate) <= allowed,
  );
}

// ---------------------------------------------------------------------------
// Answer text helpers
// ---------------------------------------------------------------------------

function compact(text: string, max = 900): string {
  const v = String(text ?? "").replace(/\s+/g, " ").trim();
  if (v.length <= max) return v;
  const cut = v.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" — "));
  return `${cut.slice(0, sentence > 180 ? sentence + 1 : max).trim()}…`;
}

function sentenceList(values: string[]): string {
  return unique(values.map((v) => String(v ?? "").trim())).filter(Boolean).join(" ");
}

function isGenericServiceCopy(text: string): boolean {
  return /premier service offered|ප්‍රමුඛ සේවාවකි/i.test(String(text ?? ""));
}

function serviceNames(biz: BusinessUnit, si: boolean): string[] {
  return biz.services
    .filter((s) => s.active !== false)
    .sort((a, b) => a.order - b.order)
    .map((s) => (si ? s.title_si || s.title_en : s.title_en || s.title_si))
    .filter(Boolean);
}

function businessChips(si: boolean): string[] {
  return si ? ["ව්‍යාපාර කළමනාකරුවන්", "කළමනාකරු දුරකථන"] : ["Business Managers", "Managers Phones"];
}

const BUSINESS_ALIASES: Record<string, string[]> = {
  "ristbury-tiara": [
    "ristbury", "restbury", "risbury", "tiara", "tiyara", "ristbury tiara", "confectionery", "confectionery agency",
    "chocolate", "chocolate agency", "sweets", "sweets agency", "රිස්බරි", "රෙස්බරි", "ටියාරා", "රිස්බරි ටියාරා",
    "රසකැවිලි", "රසකැවිලි නියෝජිතායතනය", "චොකලට්", "චොකලට් නියෝජිතායතනය",
  ],
  "coop-city": [
    "co-op city", "coop city", "co op city", "coopcity", "supermarket", "super market", "grocery", "groceries", "grocery store",
    "කෝ ඔප් සිටි", "කෝප් සිටි", "කෝ-ඔප් සිටි", "සුපිරි වෙළඳසැල", "සුපිරි වෙළදසැල", "සුපර් මාර්කට්", "සූපර් මාර්කට්",
    "සුපර් මාකට්", "සිල්ලර බඩු", "සිල්ලර කඩේ", "බඩු කඩේ", "වෙළඳසැල",
  ],
  transport: [
    "transport", "transport division", "distribution", "distribution division", "delivery", "goods transport", "vehicle hire",
    "lorry", "lorry hire", "vehicle", "wahana", "wahana hire", "ප්‍රවාහනය", "ප්‍රවාහන අංශය", "බෙදාහැරීම", "බෙදාහැරීම් අංශය",
    "භාණ්ඩ ප්‍රවාහනය", "වාහන", "වාහන කුලියට", "වාහනයක් කුලියට", "ලොරි", "ලොරි කුලියට",
  ],
  fertilizer: [
    "fertilizer", "fertiliser", "fertilizer depot", "agricultural fertilizer", "agricultural fertilizer depot", "pohora", "pohora depot",
    "පොහොර", "පොහොර ගබඩාව", "කෘෂි පොහොර", "කෘෂිකාර්මික පොහොර",
  ],
  insurance: [
    "insurance", "insuarance", "insurence", "co-op insurance", "coop insurance", "insurance agency",
    "රක්ෂණය", "රක්ෂණ", "රක්ෂණ නියෝජිතායතනය", "සමූපකාර රක්ෂණය", "ඉන්ෂුවරන්ස්", "ඉන්ෂුරන්ස්", "ඉන්ෂුවරන්ස් නියෝජිතායතනය",
  ],
  "rural-bank": [
    "rural bank", "ruralbank", "bank", "bankuwa", "banku", "gramiya bankuwa", "gramiya bank", "village bank",
    "ග්‍රාමීය බැංකුව", "ග්‍රාමීය බැංකු", "බැංකුව", "බැංකු", "savings", "savings account", "ඉතුරුම්", "ඉතුරුම් ගිණුම", "ණය", "naya",
  ],
  consumer: [
    "consumer", "consumer section", "consumer division", "wholesale", "wholesale goods", "retail", "village shops", "village cooperative shops",
    "paribhogika", "paribogika", "පාරිභෝගික", "පාරිභෝගික අංශය", "තොග", "තොග බඩු", "තොග අලෙවිය", "ග්‍රාමීය වෙළඳසැල්", "සමූපකාර කඩ",
  ],
  "maliban-biscuits": [
    "maliban", "malibun", "malibon", "meliban", "baliban", "maliban biscuits", "maliban biscuit", "biscuits", "biscuit", "biscuit agency",
    "මාලිබන්", "මැලිබන්", "බැලිබන්", "බිස්කට්", "බිස්කට් නියෝජිතායතනය", "මාලිබන් බිස්කට්", "මාලිබන් බිස්කට් නියෝජිතායතනය",
  ],
  "maliban-kiri": [
    "maliban milk", "maliban kiri", "milk", "milk agency", "kiri", "මාලිබන් කිරි", "මැලිබන් කිරි", "කිරි", "කිරි නියෝජිතායතනය", "මාලිබන් කිරි නියෝජිතායතනය",
  ],
  "natures-secrets": [
    "nature's secrets", "natures secrets", "nature secrets", "nature's secret", "natures secret", "nature secret", "cosmetics", "beauty products",
    "නේචර්ස් සීක්රට්ස්", "නේචර්ස් සීක්‍රට්ස්", "නේචර් සීක්රට්", "රූපලාවණ්‍ය", "රූපලාවණ්‍ය නිෂ්පාදන",
  ],
  hemas: ["hemas", "hemaas", "hemas agency", "හෙමාස්", "හේමාස්", "හෙමාස් නියෝජිතායතනය"],
  "fuel-station": [
    "fuel station", "filling station", "fuel shed", "petrol shed", "diesel shed", "fuel pump", "petrol pump",
    "ඉන්ධන පිරවුම්හල", "ඉන්ධන හල", "ඉන්ධනහල", "පිරවුම්හල", "තෙල්", "තෙල් ෂෙඩ්", "ඉන්ධන ෂෙඩ්", "පෙට්‍රල් ෂෙඩ්",
  ],
  funeral: [
    "funeral", "funeral services", "funeral service", "funeral section", "anthima katayuthu", "awamangala",
    "අන්තිම කටයුතු", "අන්තිම කටයුතු සේවා", "මළ ගෙදර", "මල ගෙදර", "මළගෙදර සේවා", "අවමංගල්‍ය", "අවමංගල්‍ය සේවා",
  ],
  "gold-loan-service": [
    "gold loan", "gold loan service", "gold pawning", "pawning", "jewellery loan", "jewelry loan", "ran naya", "ran ukas", "rathran naya",
    "රත්‍රන් ණය", "රන් ණය", "රන් උකස්", "රත්‍රන් උකස්", "රත්රන් උකස්", "උකස්", "ආභරණ උකස්", "රත්‍රන් ණය සේවාව",
  ],
};

// ---------------------------------------------------------------------------
// Static, hand-written guidance grounded in the site's own pages
// ---------------------------------------------------------------------------

function staticEntries(data: KnowledgeSourceData): KnowledgeEntry[] {
  const activeBusinesses = data.businesses.filter((b) => b.active !== false);
  const fmt = (n: number) => Number(n || 0).toLocaleString("en-US");

  return [
    {
      id: "society-name",
      kind: "static",
      emoji: "🏛️",
      title_si: "සමිතියේ නම",
      title_en: "Society name",
      body_si:
        `අපේ සමිතියේ සම්පූර්ණ නම: ${SITE.name_si}.\nEnglish: ${SITE.name_en}.\nකෙටි නම: ${SITE.short_en}.`,
      body_en:
        `Our society's full name is ${SITE.name_en}.\nSinhala: ${SITE.name_si}.\nShort name: ${SITE.short_en}.`,
      keywords: [
        "society name", "full society name", "full name of the society", "official society name", "name of the society",
        "what is the society name", "what is your society called", "society full name", "mpcs full form", "panduwasnuwara mpcs full name",
        "සමිතියේ නම", "සමිතියේ සම්පූර්ණ නම", "සම්පූර්ණ නම", "නිල නම", "සමිතියට කියන නම", "ඔයාලගේ සමිතියේ නම",
        "samithiye nama", "samitiye nama", "samithiya nama", "samithiyage nama", "sampurna nama", "samithiye sampurna nama",
      ],
      href: "/#about",
      linkLabel_si: "සමිතිය ගැන තව බලන්න",
      linkLabel_en: "More about the society",
      chips_si: ["සභාපති කවුද?", "ව්‍යාපාර අංශ මොනවාද?"],
      chips_en: ["Who is the chairman?", "What are the business divisions?"],
      topic: "society-name",
    },
    {
      id: "society-about",
      kind: "static",
      emoji: "🏛️",
      title_si: "සමිතිය ගැන",
      title_en: "About the society",
      body_si:
        `${SITE.name_si} (${SITE.short_si}) 1976 ඔක්තෝබර් 6 වන දින සමූපකාර දෙපාර්තමේන්තුව යටතේ ලියාපදිංචි කරන ලදී. නිල ලියාපදිංචි අංකය ${SITE.reg_no} වේ. අපගේ සමූපකාරය ග්‍රාමීය බැංකුව, පාරිභෝගික භාණ්ඩ අලෙවිසැල, නිෂ්පාදන නියෝජිතායතන සහ ඉන්ධන පිරවුම්හල එකම වහලක් යටට ගෙන එයි. සාමාජිකයින්ගේ ඉතුරුම් සුරැකීම, ප්‍රදේශයේ වෙළෙඳුන්ට සහාය වීම සහ ශක්තිමත් ප්‍රජාවක් ගොඩනැගීම අපගේ අරමුණයි. අඩ සියවසකට ආසන්න කාලයක් පුරා මෙය ක්‍රියාත්මක වන්නේ සාමාජිකයින් විසින් තෝරා පත් කරගත් අධ්‍යක්ෂ මණ්ඩලයක් මඟිනි.` ,
      body_en:
        `${SITE.name_en} (${SITE.short_en}) was registered on 6 October 1976 under the Department of Co-operatives. Its official registration number is ${SITE.reg_no}. Our co-operative brings the Rural Bank, consumer goods store, product agencies and Fuel Station together under one roof. Protecting members' savings, supporting local traders and building a stronger community are at its heart. For around five decades it has been run by a board elected by members, for members.`,
      keywords: ["about society", "about mpcs", "society history", "history", "founded", "established", "registered", "registration number", "when started", "1976", "panduwasnuwara mpcs", "සමිතිය ගැන", "ඉතිහාසය", "ආරම්භ කළේ", "ලියාපදිංචි කළේ", "ලියාපදිංචි අංකය", "ස්ථාපිත", "සමිතිය මොකක්ද", "samithiya gena", "ithihasaya"],
      href: "/#about",
      linkLabel_si: "අප ගැන පිටුව බලන්න",
      linkLabel_en: "View About Us",
      topic: "society-about",
    },
    {
      id: "vision-mission",
      kind: "static",
      emoji: "🎯",
      title_si: "දැක්ම සහ මෙහෙවර",
      title_en: "Vision & mission",
      body_si:
        "අපගේ දැක්ම: බල ප්‍රදේශය තුළ උසස් මට්ටමේ ව්‍යාපාරික සේවාවන් සපයන ප්‍රමුඛ වෙළඳ ආයතනය බවට පත්වීම.\nඅපගේ මෙහෙවර: විශ්වාසදායක බැංකු සේවා, සාධාරණ වෙළෙඳාම සහ ප්‍රජා-කේන්ද්‍රීය සේවා මගින් සාමාජික ආර්ථිකය වර්ධනය කිරීමේ සමාජ මෙහෙවර ඉටු කරමින්, සමූපකාරය ගුණාත්මක, ඵලදායී හා කාර්යක්ෂම ව්‍යාපාරයක් බවට නංවාලීම.\nසමූපකාර මූලධර්ම: ස්වාධීනත්වය · ප්‍රජාතන්ත්‍රවාදී පාලනය · සාමාජික ආර්ථික සහභාගීත්වය · ප්‍රජා සුබසාධනය.",
      body_en:
        "Vision: To become the leading trading institution providing high-standard business services within our area.\nMission: To develop this co-operative into a quality-driven, productive and efficient business by fulfilling the social commitment of enhancing member economic growth — through reliable banking, fair trade and community-centred service.\nCo-operative principles: autonomy, democratic control, member economic participation and concern for community.",
      keywords: ["vision", "mission", "aim", "objective", "principles", "purpose", "දැක්ම", "මෙහෙවර", "අරමුණ", "මූලධර්ම", "dekwma", "mehewara"],
      href: "/#about",
      topic: "vision-mission",
    },
    {
      id: "society-counts",
      kind: "static",
      emoji: "📊",
      title_si: "සාමාජික, ඡන්ද දායක සහ අංශ සංඛ්‍යාලේඛන",
      title_en: "Members, voters & divisions",
      body_si:
        `දැනට අඩවියේ දැක්වෙන සංඛ්‍යා:\n👥 සාමාජිකයින්: ${fmt(data.settings.members_total)}\n🗳️ සුදුසුකම් ලත් ඡන්ද දායකයින්: ${fmt(data.settings.voters_total)}\n🏢 සක්‍රීය ව්‍යාපාර අංශ: ${activeBusinesses.length}\n⭐ සේවා වසර: ${data.settings.years_of_service}+ (1976 සිට)\nසාමාජික ලේඛන ගොනු ${data.settings.members_files_count} ක් සහ ඡන්ද දායක ලේඛන ගොනු ${data.settings.voters_files_count} ක් අඩවියේ ඇත.`,
      body_en:
        `The figures currently shown on the site are:\n👥 Members: ${fmt(data.settings.members_total)}\n🗳️ Eligible voters: ${fmt(data.settings.voters_total)}\n🏢 Active business divisions: ${activeBusinesses.length}\n⭐ Years of service: ${data.settings.years_of_service}+ (since 1976)\nThe site holds ${data.settings.members_files_count} member-list files and ${data.settings.voters_files_count} voter-list files.`,
      keywords: ["how many members", "members total", "member count", "how many voters", "voters total", "voter count", "how many businesses", "how many divisions", "business divisions count", "years of service", "statistics", "සාමාජිකයින් කීයක්ද", "සාමාජික ගණන", "ඡන්ද දායකයින් කීයක්ද", "ඡන්ද දායක ගණන", "ව්‍යාපාර අංශ කීයක්ද", "අංශ ගණන", "සේවා වසර", "සංඛ්‍යාලේඛන", "samajikayin kiyakda", "chanda dayakayin kiyakda"],
      href: "/membership/members",
      linkLabel_si: "සාමාජික ලේඛනය බලන්න",
      linkLabel_en: "View member list",
      chips_si: ["සාමාජික සොයන්න"],
      chips_en: ["Find Member"],
      topic: "society-counts",
    },
    {
      id: "contact-hours",
      kind: "static",
      emoji: "📞",
      title_si: "සම්බන්ධතා, ලිපිනය සහ වැඩ කරන වේලාවන්",
      title_en: "Contact, address & hours",
      body_si:
        `📍 ලිපිනය: ${SITE.address_si}\n📞 දුරකථන: ${SITE.phones.join(" · ")}\n✉️ විද්‍යුත් තැපෑල: ${SITE.email}\n🕘 වේලාවන්:\n${SITE.hours_si.join("\n")}`,
      body_en:
        `📍 Address: ${SITE.address_en}\n📞 Phone: ${SITE.phones.join(" · ")}\n✉️ Email: ${SITE.email}\n🕘 Office hours:\n${SITE.hours_en.join("\n")}`,
      keywords: ["office phone", "head office phone", "contact details", "email address", "office email", "address", "location", "where is the office", "opening hours", "office hours", "working hours", "when open", "when close", "map", "කාර්යාල දුරකථන අංකය", "ඊමේල්", "විද්‍යුත් තැපෑල", "ලිපිනය", "කාර්යාලය කොහෙද", "විවෘත වේලාව", "වැඩ කරන වේලාවන්", "සිතියම", "karyala ankaya", "lipinaya", "welawan"],
      href: "/contact",
      linkLabel_si: "සම්බන්ධතා පිටුව",
      linkLabel_en: "Contact page",
      chips_si: ["කාර්යාල දුරකථන", "කළමනාකරු දුරකථන"],
      chips_en: ["Office Phones", "Managers Phones"],
      topic: "contact-hours",
    },
    {
      id: "membership-apply",
      kind: "static",
      emoji: "📝",
      title_si: "සාමාජිකත්වයට අයදුම් කරන ආකාරය",
      title_en: "How to apply for membership",
      body_si:
        "සාමාජිකත්වයට අයදුම් කිරීමට:\n1️⃣ ලඟම ඇති ග්‍රාමීය සමූපකාර ශාඛාවෙන් භෞතික සාමාජිකත්ව අයදුම්පත ලබා ගන්න.\n2️⃣ අයදුම්පත සම්පූර්ණ කර අනිවාර්ය සාමාජික කොටස් ගාස්තුව සමඟ ශාඛාවට භාර දෙන්න.\n3️⃣ ශාඛාවෙන් නිල රබර් මුද්‍රාව සහ අත්සන තබා සහතික කරවා ගන්න.\n4️⃣ එම සහතික කළ අයදුම්පතේ පැහැදිලි ඡායාරූපයක් සමඟ වෙබ් අඩවියේ අයදුම්පත පුරවන්න. විස්තර ඔබේ නීත්‍යානුකූල හැඳුනුම්පත් ලේඛනවලට ගැළපිය යුතුය.\n5️⃣ අයදුම්පත උඩුගත කර දින කිහිපයක් ඇතුළත භෞතික පිටපත සමඟ ප්‍රධාන කාර්යාලයට පැමිණෙන්න.\n📌 ගාස්තුවේ නිශ්චිත මුදල අඩවියේ සඳහන් වන්නේ නැත — එය ඔබේ ශාඛාවෙන් තහවුරු කර ගන්න.",
      body_en:
        "To apply for membership:\n1️⃣ Get the physical membership application form from your nearest village co-operative branch.\n2️⃣ Complete it and submit it to the branch with the mandatory membership share fee.\n3️⃣ Make sure the branch certifies it with the official rubber stamp and signature.\n4️⃣ Complete the website application and upload a clear photo of that certified form. Your details must match your legal identification documents.\n5️⃣ Within a few days of uploading, visit the head office with the physical copy.\n📌 The exact fee amount is not stated on the website, so please confirm it with your branch.",
      keywords: ["how to become a member", "become member", "join membership", "apply membership", "membership application", "membership form", "membership fee", "share fee", "rubber stamp", "certified form", "documents needed membership", "සාමාජික වෙන්නේ කොහොමද", "සාමාජිකත්වයට අයදුම්", "අයදුම්පත", "සාමාජික ගාස්තුව", "කොටස් ගාස්තුව", "රබර් මුද්‍රාව", "සහතික කළ පෝරමය", "අවශ්‍ය ලේඛන", "samajika wenne kohomada", "samajikathwaya ganna", "ayadumpatha"],
      href: "/membership/apply",
      linkLabel_si: "අයදුම්පත විවෘත කරන්න",
      linkLabel_en: "Open application form",
      chips_si: ["සාමාජික සොයන්න"],
      chips_en: ["Find Member"],
      topic: "membership-apply",
    },
    {
      id: "membership-benefits",
      kind: "static",
      emoji: "🎁",
      title_si: "සාමාජිකත්වයෙන් ලැබෙන ප්‍රතිලාභ",
      title_en: "Membership benefits",
      body_si:
        "සාමාජිකයෙකු වීමෙන් සමිතියේ සේවා සියල්ලෙන්ම ප්‍රයෝජන ගත හැක — ග්‍රාමීය බැංකු සේවා, ණය පහසුකම්, සාමාජික වට්ටම් සහ අංශවල විශේෂ දීමනා ඇතුළත්ව. සමහර සේවා සහ දීමනා අදාළ අංශයේ කොන්දේසිවලට යටත් විය හැකි බැවින්, නිශ්චිත ප්‍රතිලාභය ගැන අදාළ අංශයෙන් තහවුරු කර ගැනීම වඩා හොඳයි.",
      body_en:
        "Membership lets you benefit from the society's services — including rural banking, loan facilities, member discounts and division offers. Some benefits depend on the terms of the relevant division, so confirm a specific benefit with that division before relying on it.",
      keywords: ["membership benefits", "member benefits", "why join", "advantages membership", "member discounts", "සාමාජික ප්‍රතිලාභ", "සාමාජික වීමෙන් ලැබෙන වාසි", "සාමාජික වට්ටම්", "ඇයි සාමාජික වෙන්නේ", "samajika wasi", "prathilaba"],
      href: "/membership/apply",
      topic: "membership-benefits",
    },
    {
      id: "member-voter-lists",
      kind: "static",
      emoji: "🔎",
      title_si: "සාමාජික සහ ඡන්ද දායක ලේඛන සෙවීම",
      title_en: "Finding the member & voter lists",
      body_si:
        `සාමාජික ලේඛනයේ සාමාජිකයින් ${fmt(data.settings.members_total)} ක් සහ ඡන්ද දායක ලේඛනයේ ඡන්ද දායකයින් ${fmt(data.settings.voters_total)} ක් දැක්වේ. මෙහි "සාමාජික සොයන්න" බොත්තමෙන් සාමාජික අංකය, නම හෝ හැඳුනුම්පත් අංකය භාවිතා කර සෙවිය හැක. සම්පූර්ණ ලේඛන සහ ගොනු ඡන්ද දායක පිටුවෙන් ද බැලිය හැක. ඔබේම විස්තර වැරදි නම් නිලධාරියෙකු සම්බන්ධ කර නිවැරදි කරවා ගන්න.`,
      body_en:
        `The member list shows ${fmt(data.settings.members_total)} members and the voter list shows ${fmt(data.settings.voters_total)} eligible voters. Use “Find Member” here to search by member number, name or NIC. You can also browse the full lists and files on the voter-list page. If your own details are wrong, contact an officer to correct them.`,
      keywords: ["member list", "member register", "voter list", "voter register", "find member", "search member", "member number search", "nic member search", "සාමාජික ලේඛනය", "සාමාජික ලැයිස්තුව", "ඡන්ද දායක ලේඛනය", "ඡන්ද හිමි ලැයිස්තුව", "සාමාජිකයා හොයනවා", "මගේ සාමාජික අංකය", "samajika lekanaya", "chanda lekhanaya"],
      href: "/membership/voters",
      linkLabel_si: "ලේඛන පිටුව බලන්න",
      linkLabel_en: "View the lists",
      chips_si: ["සාමාජික සොයන්න"],
      chips_en: ["Find Member"],
      topic: "member-voter-lists",
    },
    {
      id: "account-help",
      kind: "static",
      emoji: "🔐",
      title_si: "වෙබ් ගිණුම, Sign In සහ මුරපද උපකාර",
      title_en: "Website account, sign-in & password help",
      body_si:
        "වෙබ් අඩවියේ සාමාජික ගිණුමක් හැදීමට Register පිටුවේ සම්පූර්ණ නම, NIC අංකය, දුරකථන අංකය සහ මුරපදයක් ඇතුළත් කරන්න. NIC එක ඉලක්කම් 12ක් හෝ ඉලක්කම් 9ක් + V විය යුතුය. මුරපදය අවම අකුරු 6ක් විය යුතු අතර ඉතා පොදු/දුර්වල මුරපද තෝරා නොගන්න.\nSign In වීමට NIC අංකය සහ මුරපදය භාවිතා කරන්න. මුරපදය අමතක නම් Sign In පිටුවේ Forgot Password තෝරා නම, NIC සහ දුරකථන අංකය යවා WhatsApp මගින් reset ඉල්ලීමක් යවන්න. Sign in වූ පසු Dashboard එකෙන් profile එක බලා මුරපදය වෙනස් කළ හැක.",
      body_en:
        "To create a website member account, use the Register page with your full name, NIC, phone number and a password. The NIC must be 12 digits or 9 digits + V. Passwords need at least 6 characters and should not be common or weak.\nSign in with your NIC and password. If you forget the password, choose Forgot Password on the Sign In page and send your name, NIC and phone number through the WhatsApp reset request. After signing in, you can view your profile and change the password from the Dashboard.",
      keywords: ["register account", "create account", "sign up", "sign in", "login", "log in", "forgot password", "reset password", "change password", "nic format", "password requirements", "dashboard", "member account", "ගිණුමක් හදන්නේ කොහොමද", "ලියාපදිංචි වීම", "ඇතුළු වීම", "ලොගින්", "මුරපදය අමතකයි", "මුරපදය වෙනස් කරන්න", "මුරපදය reset", "hEndunumpath", "murapadaya amathakai", "login wenna", "account hadanna"],
      href: "/signin",
      linkLabel_si: "Sign In පිටුව",
      linkLabel_en: "Go to Sign In",
      topic: "account-help",
    },
    {
      id: "f28-help",
      kind: "static",
      emoji: "📑",
      title_si: "F28 — සමිතියේ ගිනුම්",
      title_en: "F28 — society accounts",
      body_si:
        "F28 යනු සමිතියේ ගිනුම් තොරතුරු බලන අංශයයි. එය ප්‍රවේශය ලබා දී ඇති, sign in වූ සාමාජිකයින්ට පමණක් Dashboard එක තුළ දිස් වේ. ප්‍රවේශය නැති අයට F28 බොත්තම නොපෙනෙන අතර එම පිටුවට යාමට උත්සාහ කළහොත් Dashboard එකටම යොමු වේ. ප්‍රවේශය අවශ්‍ය නම් කාර්යාලයෙන් විමසන්න.",
      body_en:
        "F28 is the section for viewing society account information. It appears inside the Dashboard only for signed-in members who have been granted access. Members without access do not see the F28 button and are returned to the Dashboard if they open its page. Ask the office if you need access.",
      keywords: ["f28", "f 28", "society accounts", "f28 access", "F28 මොකක්ද", "සමිතියේ ගිනුම්", "f28 balanne kohomada"],
      href: "/dashboard",
      linkLabel_si: "Dashboard එකට",
      linkLabel_en: "Go to Dashboard",
      topic: "f28-help",
    },
    {
      id: "officer-contact-process",
      kind: "static",
      emoji: "🧑‍💼",
      title_si: "නිලධාරියෙකු සම්බන්ධ කර ගන්නා ආකාරය",
      title_en: "How officer contact works",
      body_si:
        "නිලධාරියෙකු සමඟ කතා කිරීමට මෙහි \"ඇමතුමක් ඉල්ලන්න\" තෝරා ඔබේ නම සහ දුරකථන අංකය දෙන්න. ඔබේ ඉල්ලීම නිලධාරීන්ට දැනුම් දෙන අතර කෙනෙකු සූදානම් වූ විට ඇමතුමක් ලැබේ. Live Chat පණිවිඩ ලිවිය හැක්කේ නිලධාරියෙක් ඔබේ ඉල්ලීම පිළිගෙන chat එකට සම්බන්ධ වූ පසුව පමණි — ඊට පෙර Live Chat එක අගුලු දමා ඇත. සාමාන්‍ය විමසුමක් සඳහා Contact පිටුවේ පණිවිඩ පෝරමයද භාවිතා කළ හැක.",
      body_en:
        "To speak with an officer, choose “Request a Call” here and leave your name and phone number. Officers are notified and will call when someone is available. You can type in Live Chat only after an officer accepts your request and joins — before that, Live Chat is locked. For a general written inquiry, you can also use the message form on the Contact page.",
      keywords: ["officer contact process", "request callback process", "live chat locked", "why live chat locked", "how to talk officer", "contact form", "නිලධාරියෙක් සම්බන්ධ කරන්නේ කොහොමද", "ඇමතුමක් ඉල්ලන ආකාරය", "live chat අගුලු දලා ඇයි", "ලයිව් චැට් locked", "විමසුමක් යවන්න", "niladari samabanda", "callback illanna"],
      href: "/contact",
      chips_si: ["ඇමතුමක් ඉල්ලන්න"],
      chips_en: ["Request a Call"],
      topic: "officer-contact-process",
    },
    {
      id: "privacy-summary",
      kind: "static",
      emoji: "🛡️",
      title_si: "පෞද්ගලිකත්වය සහ දත්ත ආරක්ෂාව",
      title_en: "Privacy & data protection",
      body_si:
        "අපි සාමාජිකත්ව අයදුම්පත් සැකසීමට, නිල විමසුම්වලට පිළිතුරු දීමට, සමූපකාර සේවා සැපයීමට සහ නීත්‍යානුකූල සාමාජික වාර්තා තබා ගැනීමට ඔබ දෙන නම, NIC, දුරකථන, ඊමේල් සහ ලිපිනය වැනි තොරතුරු භාවිතා කරමු. දත්ත ආරක්ෂිත පද්ධතිවල තබා ප්‍රවේශය බලයලත් නිලධාරීන්ට සීමා කරන අතර අලෙවිකරණ අරමුණු සඳහා පෞද්ගලික තොරතුරු තෙවන පාර්ශවයන්ට විකුණන්නේ හෝ බෙදා දෙන්නේ නැත. අඩවිය භාෂා මනාපය සහ sign-in සැසිය සඳහා අත්‍යවශ්‍ය cookies පමණක් භාවිතා කරන බව ප්‍රතිපත්තියේ සඳහන් වේ.",
      body_en:
        "We use details such as your name, NIC, phone, email and address to process membership applications, answer official inquiries, provide co-operative services and maintain legally required member records. Data is held in protected systems with access limited to authorised officials, and personal information is not sold or shared with third parties for marketing. The site uses essential cookies for language preference and the signed-in session.",
      keywords: ["privacy policy", "privacy", "data protection", "personal data", "cookies", "data use", "delete my data", "correct my data", "පෞද්ගලිකත්ව ප්‍රතිපත්තිය", "දත්ත ආරක්ෂාව", "පෞද්ගලික දත්ත", "කුකීස්", "මගේ දත්ත මකන්න", "දත්ත නිවැරදි කරන්න"],
      href: "/privacy",
      linkLabel_si: "Privacy Policy එක බලන්න",
      linkLabel_en: "Read Privacy Policy",
      topic: "privacy-summary",
    },
    {
      id: "website-navigation",
      kind: "static",
      emoji: "🧭",
      title_si: "වෙබ් අඩවියේ පිටු සහ සේවා",
      title_en: "Website pages & where things are",
      body_si:
        "අඩවියේ ප්‍රධාන කොටස්: මුල් පිටුවේ සමිතිය ගැන, අධ්‍යක්ෂ මණ්ඩලය, ව්‍යාපාර අංශ, ඉන්ධන මිල, පුවත් සහ ගැලරිය; Businesses පිටුවේ සියලු ව්‍යාපාර අංශ; Membership යටතේ අයදුම්පත සහ සාමාජික/ඡන්ද ලේඛන; News පිටුවේ නිවේදන, රැකියා සහ ටෙන්ඩර්; Gallery පිටුවේ ඡායාරූප; Contact පිටුවේ ලිපිනය, වේලාවන් සහ විමසුම් පෝරමය. ඔබට ඕනෑම දෙයක් මෙහි සිංහලෙන්, English වලින් හෝ Singlish වලින් අසා මට අදාළ පිටුවට යොමු කරවිය හැක.",
      body_en:
        "Main parts of the site: the home page has About, Board, business divisions, fuel prices, News and Gallery; Businesses lists every division; Membership has the application and member/voter lists; News has notices, vacancies and tenders; Gallery has photos; and Contact has the address, hours and inquiry form. You can also ask me here in Sinhala, English or Singlish and I'll point you to the right page.",
      keywords: ["website pages", "site navigation", "where is page", "website sections", "what is on website", "වෙබ් අඩවියේ පිටු", "අඩවියේ තියෙන දේවල්", "පිටුව කොහෙද", "sections", "site eke monawada thiyenne"],
      href: "/businesses",
      linkLabel_si: "ව්‍යාපාර අංශ බලන්න",
      linkLabel_en: "Explore businesses",
      topic: "website-navigation",
    },
    {
      id: "baymax-capabilities",
      kind: "static",
      emoji: "🤖",
      title_si: "Baymax ට කළ හැකි දේවල්",
      title_en: "What Baymax can do",
      body_si:
        "මට සමිතිය සහ මේ වෙබ් අඩවිය ගැන ඔබ අසන බොහෝ දේට උත්තර දිය හැක — ව්‍යාපාර අංශ සහ සේවා, ග්‍රාමීය බැංකු ශාඛා, කළමනාකරු සහ කාර්යාල අංක, අධ්‍යක්ෂ මණ්ඩලය, සාමාජිකත්වයට අයදුම් කිරීම, සාමාජික ලේඛන, ඉන්ධන මිල, පුවත්, රැකියා/ටෙන්ඩර් සහ ගැලරිය වැනි දේ. උදාහරණ: \"වාහන කුලියට දීම ගැන කියන්න\", \"සභාපති කවුද?\", \"Mandapola ශාඛාවේ කළමනාකරු කවුද?\", \"How do I reset my password?\" අඩවියේ නැති දෙයක් නම් මම ඒ බව කියා නිලධාරියෙකු සම්බන්ධ කර දෙන්නම් — උත්තර හදලා කියන්නේ නැහැ.",
      body_en:
        "I can answer most questions about the society and this website — business divisions and services, Rural Bank branches, manager and office numbers, the Board, applying for membership, member lists, fuel prices, News, vacancies/tenders and the Gallery. Try: “What services does the Rural Bank offer?”, “Who is the chairman?”, “Mandapola ශාඛාවේ අංකය මොකක්ද?” or “How do I reset my password?” If the site doesn't contain the answer, I'll say so and connect you with an officer rather than making something up.",
      keywords: ["what can you do", "baymax capabilities", "ask anything", "help options", "ඔයාට මොනවාද කරන්න පුළුවන්", "මොනවාද අහන්න පුළුවන්", "උදව් වර්ග", "oyata monawada puluwan"],
      topic: "baymax-capabilities",
    },
  ];
}

// ---------------------------------------------------------------------------
// Dynamic entries from public database/seed data
// ---------------------------------------------------------------------------

function businessEntries(data: KnowledgeSourceData): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  const businesses = [...data.businesses].sort((a, b) => a.order - b.order);

  // One concise list answer for "what businesses/divisions do you have?"
  entries.push({
    id: "business-list",
    kind: "static",
    emoji: "🏢",
    title_si: "අපගේ ව්‍යාපාර අංශ",
    title_en: "Our business divisions",
    body_si: `දැනට ක්‍රියාත්මක ව්‍යාපාර හා සේවා අංශ ${businesses.filter((b) => b.active !== false).length} කි:\n${businesses.filter((b) => b.active !== false).map((b) => `• ${b.name_si || b.name_en}`).join("\n")}\nඔබට ඕනෑම අංශයක නම එවුවහොත් එහි සේවා, කළමනාකරු සහ දුරකථන විස්තර දෙන්නම්.`,
    body_en: `We currently have ${businesses.filter((b) => b.active !== false).length} active business and service divisions:\n${businesses.filter((b) => b.active !== false).map((b) => `• ${b.name_en || b.name_si}`).join("\n")}\nSend me any division name and I'll give its services, manager and phone details.`,
    keywords: ["business divisions list", "all businesses", "our businesses", "business units", "divisions list", "what businesses", "ව්‍යාපාර අංශ මොනවාද", "ව්‍යාපාර ලැයිස්තුව", "අංශ මොනවාද", "සියලු ව්‍යාපාර", "wyapara ansha monawada", "business list"],
    href: "/businesses",
    linkLabel_si: "සියලු ව්‍යාපාර බලන්න",
    linkLabel_en: "View all businesses",
    chips_si: businessChips(true),
    chips_en: businessChips(false),
    topic: "business-list",
  });

  const hasMalibanBiscuits = businesses.some((b) => b.slug === "maliban-biscuits" && b.active !== false);
  const hasMalibanMilk = businesses.some((b) => b.slug === "maliban-kiri" && b.active !== false);

  for (const biz of businesses) {
    const aliases = BUSINESS_ALIASES[biz.slug] ?? [];
    const keywordsBase = unique([
      biz.slug,
      biz.name_en,
      biz.name_si,
      biz.category_en,
      biz.category_si,
      biz.tagline_en,
      biz.tagline_si,
      ...aliases,
      // Manager/contact and branch names are keywords too, so a question
      // mentioning a person or place can still find the right division.
      ...(biz.contacts ?? []).flatMap((c) => [c.name, c.role_en, c.role_si, c.location]),
      ...(biz.branches ?? []).flatMap((b) => [b.name, b.manager, b.location]),
    ]);
    const svcSi = serviceNames(biz, true);
    const svcEn = serviceNames(biz, false);
    const firstContact = biz.contacts?.[0];
    const href = `/businesses/${biz.slug}`;
    const statusSi = biz.active === false ? "මෙම අංශය අඩවියේ දැනට අක්‍රීය ලෙස සලකුණු කර ඇත." : "";
    const statusEn = biz.active === false ? "This division is currently marked inactive on the website." : "";

    const fallbackDescSi = svcSi.length
      ? `${biz.name_si || biz.name_en} යනු ${biz.category_si || "ව්‍යාපාර"} අංශයකි. එහි ප්‍රධාන සේවා: ${svcSi.slice(0, 6).join(" · ")}.`
      : `${biz.name_si || biz.name_en} අපගේ ${biz.category_si || "ව්‍යාපාර"} අංශයකි.`;
    const fallbackDescEn = svcEn.length
      ? `${biz.name_en || biz.name_si} is our ${biz.category_en || "business"} division. Its main services include ${svcEn.slice(0, 6).join(", ")}.`
      : `${biz.name_en || biz.name_si} is one of our ${biz.category_en || "business"} divisions.`;

    entries.push({
      id: `biz:${biz.slug}`,
      kind: "business",
      emoji: "🏢",
      title_si: biz.name_si || biz.name_en,
      title_en: biz.name_en || biz.name_si,
      body_si: compact(sentenceList([
        biz.tagline_si,
        biz.desc_si || fallbackDescSi,
        svcSi.length ? `ප්‍රධාන සේවා: ${svcSi.slice(0, 6).join(" · ")}.` : "",
        firstContact ? `සම්බන්ධතා: ${firstContact.name} (${firstContact.role_si || firstContact.role_en}) — ${firstContact.phone}` : "",
        biz.slug === "maliban-biscuits" && hasMalibanMilk ? "ඊට අමතරව මාලිබන් කිරි නිෂ්පාදන සඳහා වෙනම මාලිබන් කිරි නියෝජිතායතනයක්ද අප සතුව ඇත." : "",
        biz.slug === "maliban-kiri" && hasMalibanBiscuits ? "බිස්කට් නිෂ්පාදන සඳහා වෙනම මාලිබන් බිස්කට් නියෝජිතායතනයක්ද අප සතුව ඇත." : "",
        statusSi,
      ])),
      body_en: compact(sentenceList([
        biz.tagline_en,
        biz.desc_en || fallbackDescEn,
        svcEn.length ? `Main services: ${svcEn.slice(0, 6).join(" · ")}.` : "",
        firstContact ? `Contact: ${firstContact.name} (${firstContact.role_en || firstContact.role_si}) — ${firstContact.phone}` : "",
        biz.slug === "maliban-biscuits" && hasMalibanMilk ? "We also have a separate Maliban Milk Agency for milk products." : "",
        biz.slug === "maliban-kiri" && hasMalibanBiscuits ? "We also have a separate Maliban Biscuits Agency for biscuit products." : "",
        statusEn,
      ])),
      keywords: [...keywordsBase, ...svcSi, ...svcEn],
      href,
      linkLabel_si: "අංශයේ පිටුව බලන්න",
      linkLabel_en: "View division page",
      chips_si: biz.slug === "maliban-biscuits" && hasMalibanMilk
        ? [...businessChips(true), "මාලිබන් කිරි"]
        : biz.slug === "maliban-kiri" && hasMalibanBiscuits
          ? [...businessChips(true), "මාලිබන් බිස්කට්"]
          : businessChips(true),
      chips_en: biz.slug === "maliban-biscuits" && hasMalibanMilk
        ? [...businessChips(false), "Maliban Milk"]
        : biz.slug === "maliban-kiri" && hasMalibanBiscuits
          ? [...businessChips(false), "Maliban Biscuits"]
          : businessChips(false),
      topic: `biz:${biz.slug}`,
    });

    if (svcSi.length || svcEn.length) {
      const serviceLinesSi = biz.services
        .filter((s) => s.active !== false)
        .sort((a, b) => a.order - b.order)
        .map((s, i) => `${i + 1}. ${s.title_si || s.title_en}${s.desc_si && !isGenericServiceCopy(s.desc_si) ? ` — ${compact(s.desc_si, 180)}` : ""}`)
        .join("\n");
      const serviceLinesEn = biz.services
        .filter((s) => s.active !== false)
        .sort((a, b) => a.order - b.order)
        .map((s, i) => `${i + 1}. ${s.title_en || s.title_si}${s.desc_en && !isGenericServiceCopy(s.desc_en) ? ` — ${compact(s.desc_en, 180)}` : ""}`)
        .join("\n");

      entries.push({
        id: `biz-services:${biz.slug}`,
        kind: "business-services",
        emoji: "✨",
        title_si: `${biz.name_si || biz.name_en} — සේවා`,
        title_en: `${biz.name_en || biz.name_si} — services`,
        body_si: compact(`${biz.name_si || biz.name_en} හි සේවා:\n${serviceLinesSi}`, 1200),
        body_en: compact(`Services at ${biz.name_en || biz.name_si}:\n${serviceLinesEn}`, 1200),
        keywords: [...keywordsBase, "services", "සේවා", "facilities", "පහසුකම්", ...svcSi, ...svcEn],
        href,
        linkLabel_si: "සේවා විස්තර බලන්න",
        linkLabel_en: "View service details",
        chips_si: businessChips(true),
        chips_en: businessChips(false),
        topic: `biz:${biz.slug}`,
      });

      // Individual service answers make questions such as "children's savings
      // details" precise instead of returning a long whole-division list.
      for (const svc of biz.services.filter((s) => s.active !== false)) {
        const genericSi = !svc.desc_si || isGenericServiceCopy(svc.desc_si);
        const genericEn = !svc.desc_en || isGenericServiceCopy(svc.desc_en);
        const serviceAliases = /children/i.test(svc.title_en) && /saving/i.test(svc.title_en)
          ? ["children savings account", "child savings account", "kids savings", "ළමා ඉතුරුම් ගිණුම", "lama ithurum ginuma"]
          : [];
        entries.push({
          id: `service:${biz.slug}:${svc.order}`,
          kind: "service",
          emoji: "✨",
          title_si: svc.title_si || svc.title_en,
          title_en: svc.title_en || svc.title_si,
          body_si: compact(sentenceList([
            genericSi
              ? `${svc.title_si || svc.title_en} යනු ${biz.name_si || biz.name_en} හරහා ලබා දෙන සේවාවකි. දැනට අදාළ කොන්දේසි/තොරතුරු සඳහා අංශයේ පිටුව බලන්න හෝ එම අංශය අමතන්න.`
              : svc.desc_si,
            !genericSi && svc.features_si?.length ? `විශේෂාංග: ${svc.features_si.join(" · ")}` : "",
          ]), 850),
          body_en: compact(sentenceList([
            genericEn
              ? `${svc.title_en || svc.title_si} is offered through ${biz.name_en || biz.name_si}. See the division page or contact the division for current terms and details.`
              : svc.desc_en,
            !genericEn && svc.features_en?.length ? `Features: ${svc.features_en.join(" · ")}` : "",
          ]), 850),
          keywords: unique([
            svc.title_si,
            svc.title_en,
            svc.desc_si && !isGenericServiceCopy(svc.desc_si) ? svc.desc_si : "",
            svc.desc_en && !isGenericServiceCopy(svc.desc_en) ? svc.desc_en : "",
            ...(svc.features_si ?? []),
            ...(svc.features_en ?? []),
            biz.name_si,
            biz.name_en,
            ...aliases,
            ...serviceAliases,
          ]),
          href,
          linkLabel_si: `${biz.name_si || biz.name_en} පිටුව`,
          linkLabel_en: `${biz.name_en || biz.name_si} page`,
          chips_si: businessChips(true),
          chips_en: businessChips(false),
          topic: `biz:${biz.slug}`,
        });
      }
    }

    if (biz.contacts?.length) {
      entries.push({
        id: `biz-contact:${biz.slug}`,
        kind: "business-contact",
        emoji: "📞",
        title_si: `${biz.name_si || biz.name_en} — සම්බන්ධතා`,
        title_en: `${biz.name_en || biz.name_si} — contacts`,
        body_si: biz.contacts
          .map((c) => `👤 ${c.name}\n${c.role_si || c.role_en}${c.location ? ` · ${c.location}` : ""}\n📞 ${c.phone}${c.note_si ? `\n${c.note_si}` : ""}`)
          .join("\n\n"),
        body_en: biz.contacts
          .map((c) => `👤 ${c.name}\n${c.role_en || c.role_si}${c.location ? ` · ${c.location}` : ""}\n📞 ${c.phone}${c.note_en ? `\n${c.note_en}` : ""}`)
          .join("\n\n"),
        keywords: [
          ...keywordsBase,
          "phone", "contact", "manager", "manager name", "number", "phone number", "call",
          "දුරකථන", "දුරකථන අංකය", "කළමනාකරු", "කළමනාකරුගේ නම", "අංකය", "අමතන්න",
          `${biz.name_en} manager`, `${biz.name_en} manager name`, `${biz.name_en} phone number`,
          `${biz.name_si} කළමනාකරු`, `${biz.name_si} කළමනාකරුගේ නම`, `${biz.name_si} දුරකථන අංකය`,
          ...biz.contacts.map((c) => c.name),
          ...biz.contacts.flatMap((c) => [c.role_en, c.role_si]),
        ],
        href,
        linkLabel_si: "අංශයේ පිටුව බලන්න",
        linkLabel_en: "View division page",
        chips_si: businessChips(true),
        chips_en: businessChips(false),
        topic: `biz:${biz.slug}`,
      });
    }

    if (biz.branches?.length) {
      entries.push({
        id: `biz-branches:${biz.slug}`,
        kind: "branch",
        emoji: "📍",
        title_si: `${biz.name_si || biz.name_en} — ශාඛා`,
        title_en: `${biz.name_en || biz.name_si} — branches`,
        body_si: biz.branches
          .map((b) => `📍 ${b.name}${b.location ? ` — ${b.location}` : ""}\n👤 ${b.manager}\n📞 ${b.phone}`)
          .join("\n\n"),
        body_en: biz.branches
          .map((b) => `📍 ${b.name}${b.location ? ` — ${b.location}` : ""}\n👤 ${b.manager}\n📞 ${b.phone}`)
          .join("\n\n"),
        keywords: [...keywordsBase, "branch", "branches", "location", "ශාඛා", "ස්ථානය", ...biz.branches.map((b) => b.name), ...biz.branches.map((b) => b.manager)],
        href,
        topic: `biz:${biz.slug}`,
      });
    }
  }

  // Rural Bank village branches are displayed from their own site section.
  if (data.ruralBranches.length) {
    entries.push({
      id: "rural-bank-branches",
      kind: "branch",
      emoji: "🏦",
      title_si: "ග්‍රාමීය බැංකු ශාඛා",
      title_en: "Rural Bank branches",
      body_si: `ග්‍රාමීය බැංකුවේ ශාඛා ${data.ruralBranches.length} කි:\n${data.ruralBranches.map((b) => b.name_si || b.name).join(" · ")}\nශාඛාවක නම එවුවහොත් එහි කළමනාකරු සහ දුරකථන අංකය දෙන්නම්.`,
      body_en: `The Rural Bank has ${data.ruralBranches.length} branches:\n${data.ruralBranches.map((b) => b.name || b.name_si).join(" · ")}\nSend me a branch name for its manager and phone number.`,
      keywords: ["rural bank branches", "bank branches", "village bank branches", "how many rural bank branches", "ග්‍රාමීය බැංකු ශාඛා", "බැංකු ශාඛා කීයක්ද", "ශාඛා ලැයිස්තුව", ...data.ruralBranches.map((b) => b.name), ...data.ruralBranches.map((b) => b.name_si)],
      href: "/businesses/rural-bank",
      linkLabel_si: "ග්‍රාමීය බැංකු පිටුව",
      linkLabel_en: "Rural Bank page",
      topic: "biz:rural-bank",
    });

    data.ruralBranches.forEach((branch, i) => {
      entries.push({
        id: `rural-branch:${i + 1}`,
        kind: "branch",
        emoji: "🏦",
        title_si: `${branch.name_si || branch.name} — ග්‍රාමීය බැංකුව`,
        title_en: `${branch.name || branch.name_si} — Rural Bank`,
        body_si: `👤 කළමනාකරු: ${branch.manager || "—"}\n📞 දුරකථන: ${branch.phone || "—"}`,
        body_en: `👤 Manager: ${branch.manager || "—"}\n📞 Phone: ${branch.phone || "—"}`,
        keywords: [
          branch.name, branch.name_si, branch.manager, branch.phone, branch.no ?? "",
          "rural bank branch", "ග්‍රාමීය බැංකු ශාඛාව", "branch manager", "branch manager name", "branch phone", "branch phone number",
          `${branch.name} manager`, `${branch.name} manager name`, `${branch.name} phone`, `${branch.name} phone number`,
          `${branch.name_si} කළමනාකරු`, `${branch.name_si} කළමනාකරුගේ නම`, `${branch.name_si} දුරකථන අංකය`,
          branch.no ? `branch ${branch.no}` : "", branch.no ? `ශාඛා අංක ${branch.no}` : "",
        ],
        href: "/businesses/rural-bank",
        topic: `branch:${branch.name || branch.name_si}`,
      });
    });
  }

  return entries;
}

function boardEntries(data: KnowledgeSourceData): KnowledgeEntry[] {
  const board = [...data.board].sort((a, b) => a.order - b.order);
  if (!board.length) return [];
  const entries: KnowledgeEntry[] = [{
    id: "board-list",
    kind: "board",
    emoji: "👔",
    title_si: "අධ්‍යක්ෂ මණ්ඩලය",
    title_en: "Board of Directors",
    body_si: board.map((p) => `• ${p.position_si || p.position_en}: ${p.name_si || p.name_en}`).join("\n"),
    body_en: board.map((p) => `• ${p.position_en || p.position_si}: ${p.name_en || p.name_si}`).join("\n"),
    keywords: [
      "board of directors", "board members", "board member names", "directors list", "director names", "who are directors", "who are the board members",
      "අධ්‍යක්ෂ මණ්ඩලය", "අධ්‍යක්ෂ මණ්ඩලයේ නම්", "අධ්‍යක්ෂවරු", "අධ්‍යක්ෂවරුන්ගේ නම්", "බෝඩ් එක", "බෝඩ් එකේ ඉන්නේ කවුද", "board list",
      "board eke inne kawuda", "directors la kawuda", "adyaksha mandalaya",
      ...board.map((p) => p.position_en), ...board.map((p) => p.position_si),
      ...board.map((p) => p.name_en), ...board.map((p) => p.name_si),
    ],
    href: "/#board",
    linkLabel_si: "අධ්‍යක්ෂ මණ්ඩලය බලන්න",
    linkLabel_en: "View the Board",
    chips_si: ["කාර්යාල දුරකථන"],
    chips_en: ["Office Phones"],
    topic: "board",
  }];

  for (const person of board) {
    const roleAliases = [
      `${person.position_en} name`,
      `name of the ${person.position_en}`,
      `who is the ${person.position_en}`,
      `${person.position_si}ගේ නම`,
      `${person.position_si} ගේ නම`,
      `${person.position_si}වරයාගේ නම`,
      `${person.position_si} කවුද`,
      `${person.position_si} කව්ද`,
    ];
    if (person.category === "chairman") {
      roleAliases.push(
        "chairman", "chaiman", "chairman name", "chaiman name", "name of chairman", "who is chairman",
        "sabhapathi", "sabapathi", "saba pathi", "sabapathige nama", "sabhapathige nama", "sabapathi kawuda",
        "සභාපති", "සභාපතිගේ නම", "සභාපති කවුද", "සභාපතිවරයාගේ නම", "සබාපති", "සබාපතිගේ නම", "සබාපති කවුද", "සබාපතිවරයාගේ නම",
      );
    }
    if (person.category === "vice-chairman") {
      roleAliases.push(
        "vice chairman", "vice-chairman", "vice chairman name", "upa sabhapathi", "upa sabapathi", "upa sabapathige nama",
        "උප සභාපති", "උප සභාපතිගේ නම", "උප සභාපති කවුද", "උප සබාපති", "උප සබාපතිගේ නම", "උප සබාපති කවුද",
      );
    }
    if (person.category === "director") {
      roleAliases.push("director", "board director", "අධ්‍යක්ෂ", "අධ්‍යක්ෂවරයා", "adyaksha");
    }
    if (/general manager/i.test(person.position_en)) {
      roleAliases.push(
        "general manager", "general manager name", "gm", "gm name", "jeneral manager",
        "සාමාන්‍ය කළමනාකරු", "සාමාන්ය කළමනාකරු", "සාමාන්‍ය කළමනාකරුගේ නම", "ජෙනරල් මැනේජර්", "ප්‍රධාන කළමනාකරු",
      );
    }
    if (/regional/i.test(person.position_en)) {
      roleAliases.push(
        "regional coop officer", "regional co-op officer", "regional cooperative officer", "regional officer",
        "කලාපීය සමූපකාර නිලධාරී", "කලාපීය නිලධාරියා", "කලාපීය සමූපකාර නිලධාරියාගේ නම",
      );
    }

    entries.push({
      id: `person:${person.order}:${person.name_en}`,
      kind: "person",
      emoji: "👤",
      title_si: `${person.name_si || person.name_en} — ${person.position_si || person.position_en}`,
      title_en: `${person.name_en || person.name_si} — ${person.position_en || person.position_si}`,
      body_si: sentenceList([
        `${person.name_si || person.name_en} අපගේ ${person.position_si || person.position_en} ලෙස කටයුතු කරයි.`,
        person.qualification ? `සුදුසුකම්: ${person.qualification}.` : "",
        person.phone ? `📞 ${person.phone}` : "",
        person.email ? `✉️ ${person.email}` : "",
        person.address ? `📍 ${person.address}` : "",
      ]),
      body_en: sentenceList([
        `${person.name_en || person.name_si} serves as our ${person.position_en || person.position_si}.`,
        person.qualification ? `Qualification: ${person.qualification}.` : "",
        person.phone ? `📞 ${person.phone}` : "",
        person.email ? `✉️ ${person.email}` : "",
        person.address ? `📍 ${person.address}` : "",
      ]),
      keywords: unique([
        person.name_en,
        person.name_si,
        person.position_en,
        person.position_si,
        person.qualification,
        person.category,
        person.phone,
        person.email,
        `who is the ${person.position_en}`,
        `${person.position_en} phone`,
        `${person.position_en} phone number`,
        `${person.position_si} කවුද`,
        `${person.position_si}ගේ දුරකථන අංකය`,
        ...roleAliases,
      ]),
      href: "/#board",
      chips_si: ["කාර්යාල දුරකථන"],
      chips_en: ["Office Phones"],
      topic: `person:${person.name_en || person.name_si}`,
    });
  }
  return entries;
}

function contentEntries(data: KnowledgeSourceData): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  for (const item of data.news.filter((n) => n.published !== false)) {
    entries.push({
      id: `news:${item.id}`,
      kind: "news",
      emoji: item.category === "vacancy" ? "💼" : item.category === "tender" ? "📑" : "📰",
      title_si: item.title_si || item.title_en,
      title_en: item.title_en || item.title_si,
      body_si: compact(`${item.date ? `📅 ${item.date}\n` : ""}${item.desc_si || item.desc_en || ""}`, 800),
      body_en: compact(`${item.date ? `📅 ${item.date}\n` : ""}${item.desc_en || item.desc_si || ""}`, 800),
      keywords: [item.title_si, item.title_en, item.desc_si, item.desc_en, item.category, item.badge_text ?? ""],
      href: "/news",
      linkLabel_si: "පුවත් පිටුවේ බලන්න",
      linkLabel_en: "View on News page",
      topic: `news:${item.id}`,
    });
  }
  data.gallery.forEach((item, i) => {
    entries.push({
      id: `gallery:${item.id || i}`,
      kind: "gallery",
      emoji: "🖼️",
      title_si: item.title,
      title_en: item.title,
      body_si: compact(item.description || "මෙම ඡායාරූපය අපගේ ගැලරියේ ඇත. ගැලරි පිටුවෙන් එය විශාලව බැලිය හැක.", 700),
      body_en: compact(item.description || "This photo is in our gallery. Open the Gallery page to view it in full.", 700),
      keywords: [item.title, item.description, "gallery", "photo", "ඡායාරූපය"],
      href: "/gallery",
      linkLabel_si: "ගැලරියේ බලන්න",
      linkLabel_en: "View in Gallery",
      topic: `gallery:${item.id || i}`,
    });
  });
  return entries;
}

export function buildKnowledgeIndex(data: KnowledgeSourceData): IndexedKnowledgeEntry[] {
  const entries = [
    ...staticEntries(data),
    ...businessEntries(data),
    ...boardEntries(data),
    ...contentEntries(data),
  ];

  return entries.map((entry) => {
    const titleTokens = unique(knowledgeTokens(`${entry.title_si} ${entry.title_en}`));
    const keywordTokens = unique(entry.keywords.flatMap((keyword) => knowledgeTokens(keyword)));
    const bodyTokens = unique(knowledgeTokens(`${entry.body_si} ${entry.body_en}`));
    return {
      ...entry,
      titlePhrases: unique([tokenPhrase(entry.title_si), tokenPhrase(entry.title_en)]).filter((p) => p.length >= 3),
      keywordPhrases: unique(entry.keywords.map(tokenPhrase)).filter((p) => p.length >= 3),
      titleTokens,
      keywordTokens,
      bodyTokens,
      searchBody: bodyTokens.join(" "),
    };
  });
}

// ---------------------------------------------------------------------------
// Search & scoring
// ---------------------------------------------------------------------------

function intentBoost(entry: IndexedKnowledgeEntry, queryNorm: string, tokens: Set<string>): number {
  let boost = 0;
  const has = (pattern: RegExp) => pattern.test(queryNorm);

  const phoneIntent = has(/phone|telephone|number|contact|call|manager|දුරකථන|අංකය|අංකයක්|නොම්බරය|අමතන්න|සම්බන්ධ|කළමනාකරු|nombare|ankaya|durakathana/);
  const serviceIntent = has(/service|services|offer|offers|available|product|products|facility|facilities|සේවා|පහසුකම්|නිෂ්පාදන|sewa|sewawan/);
  const branchIntent = has(/branch|branches|located|location|where|ශාඛා|ශාඛාව|කොහෙද|ස්ථානය|shakha|shakawa/);
  const countIntent = has(/how many|number of|count|total|කීයක්|කියක්|ගණන|සංඛ්‍යාව|ganana|kiyada|keeyada/) || tokens.has("count");
  const whoIntent = has(/who|chairman|chaiman|vice|secretary|treasurer|director|manager|කවුද|කව්ද|සභාපති|සබාපති|උප සභාපති|උප සබාපති|ලේකම්|භාණ්ඩාගාරික|අධ්‍යක්ෂ|kawuda|kauda|sabhapathi|sabapathi/);
  const nameIntent = tokens.has("name") || has(/නම|නාමය|nama\b/);
  const bareQuery = queryNorm.trim();

  if (phoneIntent) {
    if (entry.kind === "business-contact") boost += 24;
    if (entry.kind === "person") boost += 15;
    if (entry.kind === "branch") boost += 12;
    if (entry.id === "contact-hours") boost += 12;
  }
  if (serviceIntent) {
    if (entry.kind === "business-services") boost += 24;
    if (entry.kind === "service") boost += 18;
    if (entry.kind === "business") boost += 5;
  }
  if (branchIntent) {
    if (entry.kind === "branch") boost += 22;
    if (entry.id === "contact-hours") boost += 8;
  }
  if (countIntent && (entry.id === "society-counts" || entry.id === "rural-bank-branches")) boost += 24;
  if (whoIntent) {
    if (entry.kind === "person") boost += 22;
    if (entry.kind === "branch") boost += 12;
    if (entry.kind === "business-contact") boost += 10;
    if (entry.id === "board-list") boost += 8;
  }
  if (nameIntent) {
    if (entry.kind === "person") boost += 14;
    if (entry.kind === "branch") boost += 10;
    if (entry.kind === "business-contact") boost += 12;
    if (entry.id === "board-list") boost += 5;
  }

  // A named Rural Bank branch plus a manager/phone question should beat
  // unrelated division contacts that merely share the location name.
  if (entry.kind === "branch") {
    const genericBranchTokens = new Set(["branch", "branches", "rural", "bank", "ශාඛාව", "ශාඛා", "ග්‍රාමීය", "බැංකු", "බැංකුව"]);
    const branchNameHit = entry.titleTokens.some((token) => !genericBranchTokens.has(token) && tokens.has(token));
    if (branchNameHit && (whoIntent || nameIntent || phoneIntent)) boost += 26;
  }

  // A bare division/brand keyword should open that division directly.
  // This prevents near-ties such as "Maliban" (Biscuits vs Milk) or
  // "consumer" (Consumer Section vs another retail category).
  if (entry.kind === "business" && entry.id.startsWith("biz:")) {
    const slugPhrase = entry.id.slice(4).replace(/-/g, " ");
    if (bareQuery === slugPhrase) boost += 18;
  }
  if (entry.id === "biz:maliban-biscuits" && /^(maliban|මාලිබන්)$/.test(bareQuery)) boost += 22;
  if (
    entry.id === "biz:gold-loan-service" &&
    has(/gold loan|gold pawning|ran ukas|රන් උකස්|රත්‍රන් ණය|රන් ණය/) &&
    !has(/rural|bank|බැංකු|ග්‍රාමීය/)
  ) {
    boost += 18;
  }

  // A few exact, high-value question shapes from the site's guidance pages.
  if (entry.id === "membership-apply" && has(/how.*(join|member|apply)|documents|rubber stamp|certified|fee|සාමාජික.*(වෙන්න|අයදුම්)|අයදුම්.*කරන|රබර් මුද්‍රාව|ලේඛන|ගාස්තු/)) boost += 25;
  if (entry.id === "account-help" && has(/forgot|reset|login|sign in|sign up|register|password|මුරපද|ලොගින්|ඇතුළු|ලියාපදිංචි/)) boost += 24;
  if (
    entry.id === "society-name" &&
    ((tokens.has("society") || tokens.has("mpcs") || tokens.has("සමිතිය")) &&
      (nameIntent || tokens.has("full") || has(/සම්පූර්ණ|නිල නම|official|called/)))
  ) {
    boost += 38;
  }
  if (entry.id === "society-about" && has(/founded|established|history|registration|registered|ඉතිහාස|ආරම්භ|ලියාපදිංචි.*අංක|ස්ථාපිත/)) boost += 22;
  if (entry.id === "vision-mission" && has(/vision|mission|දැක්ම|මෙහෙවර|අරමුණ|මූලධර්ම/)) boost += 24;
  if (entry.id === "f28-help" && /\bf28\b/.test(queryNorm)) boost += 30;

  return boost;
}

function scoreEntry(
  entry: IndexedKnowledgeEntry,
  queryTokens: string[],
  queryNorm: string,
): { score: number; matched: number } {
  const querySet = new Set(queryTokens);
  const titleSet = new Set(entry.titleTokens);
  const keywordSet = new Set(entry.keywordTokens);
  const bodySet = new Set(entry.bodyTokens);
  const fuzzyCandidates = unique([...entry.titleTokens, ...entry.keywordTokens]);

  let score = 0;
  let matched = 0;

  // Exact phrase matches are strong, but count only the single best phrase.
  // Otherwise the same entity phrase repeated in titles/keywords (and
  // one-word titles such as "society") can overwhelm a more specific answer.
  let phraseBonus = 0;
  for (const phrase of entry.titlePhrases) {
    const parts = phrase.split(" ").filter(Boolean);
    if ((parts.length >= 2 && queryNorm.includes(phrase)) || queryNorm === phrase) {
      phraseBonus = Math.max(phraseBonus, 26);
    }
  }
  for (const phrase of entry.keywordPhrases) {
    const parts = phrase.split(" ").filter(Boolean);
    if (parts.length >= 2 && queryNorm.includes(phrase)) {
      phraseBonus = Math.max(phraseBonus, 12 + Math.min(10, parts.length * 3));
    }
  }
  score += phraseBonus;

  for (const token of querySet) {
    let best = 0;
    if (titleSet.has(token)) best = 12;
    else if (keywordSet.has(token)) best = 9;
    else if (bodySet.has(token)) best = 3;
    else if (token.length >= 4 && fuzzyCandidates.some((candidate) => candidate.length >= 4 && (candidate.includes(token) || token.includes(candidate)))) best = 6;
    else if (fuzzyTokenMatch(token, fuzzyCandidates)) best = 6;
    else if (token.length >= 4 && entry.searchBody.includes(token)) best = 1.5;

    if (best > 0) {
      score += best;
      matched++;
    }
  }

  if (querySet.size) score += (matched / querySet.size) * 8;

  // A single exact entity/division keyword is a meaningful question by
  // itself (e.g. "Hemas", "supermarket", "රක්ෂණය"), so let it clear the
  // answer threshold instead of falling through as a weak match.
  if (querySet.size === 1) {
    const onlyToken = [...querySet][0];
    if (titleSet.has(onlyToken) || keywordSet.has(onlyToken)) score += 8;
  }

  score += intentBoost(entry, queryNorm, querySet);
  return { score, matched };
}

export function searchKnowledge(
  query: string,
  index: IndexedKnowledgeEntry[],
): KnowledgeResult | null {
  const queryTokens = unique(knowledgeTokens(query));
  if (!queryTokens.length) return null;
  const queryNorm = ` ${queryTokens.join(" ")} `;

  const scored = index
    .map((entry) => ({ entry, ...scoreEntry(entry, queryTokens, queryNorm.trim()) }))
    .sort((a, b) => b.score - a.score || b.matched - a.matched);

  const top = scored[0];
  if (!top) return null;

  const threshold = queryTokens.length === 1 ? 12 : queryTokens.length === 2 ? 16 : 20;
  if (top.score < threshold || top.matched < 1) return null;
  if (queryTokens.length >= 3 && top.matched < 2) return null;

  const second = scored.find((candidate) => candidate.entry.topic !== top.entry.topic);
  const close = second
    ? second.score >= threshold && top.score - second.score <= Math.max(4, Math.min(9, top.score * 0.12))
    : false;

  const alternatives: IndexedKnowledgeEntry[] = [];
  const seenTopics = new Set<string>();
  for (const candidate of scored) {
    if (candidate.score < Math.max(threshold, top.score * 0.62)) break;
    const topic = candidate.entry.topic ?? candidate.entry.id;
    if (seenTopics.has(topic)) continue;
    seenTopics.add(topic);
    alternatives.push(candidate.entry);
    if (alternatives.length >= 4) break;
  }

  return {
    entry: top.entry,
    score: top.score,
    matched: top.matched,
    ambiguous: close && alternatives.length > 1,
    alternatives,
  };
}

// Convenience wrapper used by tests and possible other callers.
export function answerSiteQuestion(
  query: string,
  data: KnowledgeSourceData,
): KnowledgeResult | null {
  return searchKnowledge(query, buildKnowledgeIndex(data));
}
