// ============================================================================
// Panduwasnuwara New MPCS — shared types
// ============================================================================

export type Lang = "si" | "en";

export interface BusinessContact {
  role_en: string;
  role_si: string;
  name: string;
  location: string;
  phone: string;
  note_en?: string;
  note_si?: string;
}

export interface BusinessBranch {
  name: string;
  /** Rural Bank branch Sinhala name (stored via branch settings) */
  name_si?: string;
  manager: string;
  location: string;
  phone: string;
  /** Branch card photo URL/path (Admin branch settings) */
  photo?: string;
}

export interface BusinessService {
  /** DB row id (seed data වල නෑ) — Admin edit/delete වලදී හරියටම row එක අඳුරගන්න */
  id?: string;
  order: number;
  title_en: string;
  title_si: string;
  desc_en: string;
  desc_si: string;
  features_en: string[];
  features_si: string[];
  active: boolean;
}

/** Admin → Animation settings (system_settings එකේ save වේ; DB column එකක් නෑ) */
export interface BusinessAnimation {
  /** මුළු පිටුවේම පසුබිමට වැටෙන watermark image එක (logo එක පිටිපස්සේ නෙවෙයි) */
  bgImage: string;
  /** watermark එක පේන තද බව % (10–120) */
  brightness: number;
  /** උඩින් animate වෙලා පේන product images */
  products: string[];
}

export interface BusinessUnit {
  slug: string;
  order: number;
  name_en: string;
  name_si: string;
  category_en: string;
  category_si: string;
  tagline_en: string;
  tagline_si: string;
  desc_en: string;
  desc_si: string;
  logo: string;
  cover: string | null;
  is_new: boolean;
  active: boolean;
  special: "default" | "rural-bank" | "consumer" | "fuel-station";
  contacts: BusinessContact[];
  branches: BusinessBranch[];
  services: BusinessService[];
  /** Admin → Animation එකෙන් දාපු background/watermark + animated products (තියේ නම් විතරයි) */
  animation?: BusinessAnimation;
}

export interface BoardMember {
  /** DB primary key — duplicate order values තිබුණත් React key එක unique කරයි */
  id?: string;
  order: number;
  category: "chairman" | "vice-chairman" | "director" | "officer";
  name_en: string;
  name_si: string;
  position_en: string;
  position_si: string;
  qualification: string;
  phone: string;
  email: string;
  address: string;
  photo: string | null;
}

export type NewsCategory = "vacancy" | "notice" | "tender" | "general";

export interface NewsItem {
  id: string;
  category: NewsCategory;
  badge_text: string | null;
  title_en: string;
  title_si: string;
  desc_en: string;
  desc_si: string;
  date: string;
  image: string;
  pinned: boolean;
  published: boolean;
}

export interface GalleryComment {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  aspect: "4:3" | "16:9" | "1:1" | "3:2";
  image: string;
  likes: number;
  comments: GalleryComment[];
}

export interface InquiryMessage {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  department: string; // business slug or "general"
  subject: string | null;
  message: string;
  status: "unread" | "read" | "replied";
  reply: string | null;
  created_at: string;
}

export interface MembershipApplication {
  id: string;
  app_no: string;
  name_si: string;
  name_en: string;
  address: string;
  postal_address: string;
  nic: string;
  phone: string;
  email: string | null;
  certified_form_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface MemberRow {
  member_no: string;
  nic: string;
  full_name: string;
  address: string;
  postal_address: string;
  gender: string;
  file_name: string;
}

export interface VoterRow {
  voter_no: string;
  nic: string;
  full_name: string;
  address: string;
  postal_address: string;
  gender: string;
  file_name: string;
}

export interface DataFile {
  file_name: string;
  rows: number;
  kind: "member" | "voter";
}

export interface FuelPrice {
  type: "petrol92" | "super_diesel" | "kerosene";
  name_en: string;
  name_si: string;
  tag: string;
  price: number;
  color: string;
}

export interface RegisteredUser {
  id: string;
  full_name: string;
  nic: string;
  phone: string;
  role: "superadmin" | "admin" | "member";
  joined_date: string;
  password_display: string; // base64 (admin view requirement)
  auth_email: string;
  is_root_admin?: boolean; // මුල සිටම සිටි original superadmin (protected)
}

export interface SiteSettings {
  whatsapp_number: string;
  years_of_service: number;
  contact_email_1: string;
  contact_email_2: string;
  members_total: number;
  voters_total: number;
  members_files_count: number;
  voters_files_count: number;
  /** hero background slideshow images (5ක්+ auto-change, admin settings වලින්) */
  hero_images: string[];
  /** ✅ board section background image (admin settings වලින් set කරනවා) */
  board_bg?: string;
}

export interface HeroStat {
  label_si: string;
  label_en: string;
  value: string;
}
