-- ============================================================================
--  සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය (Panduwasnuwara New MPCS)
--  එකම SQL file එක — Schema + Data + Image Storage ඔක්කොම මෙතන ඇතුළත්.
--
--  භාවිතය: Supabase Dashboard > SQL Editor > New query > මේ file එකේ මුළු
--  අන්තර්ගතයම copy කර paste කර "Run" කරන්න. නැවත run කිරීම ආරක්ෂිතයි.
--  (පැරණි site එකේ දත්ත මෙතන නැත — Panduwasnuwara දත්ත පමණයි.)
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;

do $$ begin
  create type user_role as enum ('member', 'admin', 'superadmin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type msg_status as enum ('unread', 'read', 'replied');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. profiles — website accounts (NIC-based login)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  nic text unique not null,
  phone text default '',
  auth_email text default '',
  password_display text default '',     -- admin view එකේ "current password" පෙන්වීමට (base64)
  role user_role not null default 'member',
  status text not null default 'active',
  joined_date timestamptz not null default now()
);

-- ✅ user requirement: NIC වලින් login — anon ලඟට nic→email lookup පමණයි (password නෑ)
create or replace view public.login_lookup with (security_invoker = off) as
  select nic, auth_email from public.profiles;

grant select on public.login_lookup to anon, authenticated;

-- role/status protection
create or replace function public.protect_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status) then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')
    ) then
      raise exception 'Only administrators can change role or status';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_role on public.profiles;
create trigger trg_protect_role before update on public.profiles
  for each row execute function public.protect_role_change();

-- ---------------------------------------------------------------------------
-- 2. business_units + children
-- ---------------------------------------------------------------------------
create table if not exists public.business_units (
  slug text primary key,
  "order" int not null default 0,
  name_en text not null,
  name_si text default '',
  category_en text default '',
  category_si text default '',
  tagline_en text default '',
  tagline_si text default '',
  desc_en text default '',
  desc_si text default '',
  logo text default '',
  cover text,
  is_new boolean default false,
  active boolean default true,
  special text default 'default'       -- default | rural-bank | consumer | fuel-station
);

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_slug text not null references public.business_units (slug) on delete cascade,
  "order" int not null default 0,
  title_en text not null,
  title_si text default '',
  desc_en text default '',
  desc_si text default '',
  features_en text[] default '{}',
  features_si text[] default '{}',
  active boolean default true
);

create table if not exists public.business_contacts (
  id uuid primary key default gen_random_uuid(),
  business_slug text not null references public.business_units (slug) on delete cascade,
  role_en text default '',
  role_si text default '',
  name text default '',
  location text default '',
  phone text default '',
  note_en text default '',
  note_si text default ''
);

create table if not exists public.business_branches (
  id uuid primary key default gen_random_uuid(),
  business_slug text not null references public.business_units (slug) on delete cascade,
  name text default '',
  manager text default '',
  location text default '',
  phone text default ''
);

-- ---------------------------------------------------------------------------
-- 3. board_members
-- ---------------------------------------------------------------------------
create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  "order" int not null default 0,
  category text not null default 'director',   -- chairman | vice-chairman | director | officer
  name_en text not null,
  name_si text default '',
  position_en text default '',
  position_si text default '',
  qualification text default '',
  phone text default '',
  email text default '',
  address text default '',
  photo text
);

-- ---------------------------------------------------------------------------
-- 4. news
-- ---------------------------------------------------------------------------
create table if not exists public.news (
  id text primary key,
  category text not null default 'notice',      -- vacancy | notice | tender | general
  badge_text text,
  title_en text default '',
  title_si text default '',
  desc_en text default '',
  desc_si text default '',
  date date default current_date,
  image text default '',
  pinned boolean default false,
  published boolean default true
);

-- ---------------------------------------------------------------------------
-- 5. gallery
-- ---------------------------------------------------------------------------
create table if not exists public.gallery_items (
  id text primary key,
  title text default '',
  description text default '',
  aspect text default '4:3',
  image text default '',
  likes int default 0
);

create table if not exists public.gallery_comments (
  id uuid primary key default gen_random_uuid(),
  item_id text references public.gallery_items (id) on delete cascade,
  author text default '',
  text text default '',
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 6. messages (business send-inquiry + contact form) — Reply පහසුකම එක්ක
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text default '',
  phone text default '',
  email text default '',
  department text default 'General Society Inquiries',
  subject text,
  message text default '',
  status msg_status default 'unread',
  reply text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 7. membership_applications (rubber-stamp form upload)
-- ---------------------------------------------------------------------------
create table if not exists public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  app_no text unique default ('APP-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random()*9999))::text, 4, '0')),
  name_si text default '',
  name_en text default '',
  address text default '',
  postal_address text default '',
  nic text default '',
  phone text default '',
  email text,
  certified_form_url text,
  status app_status default 'pending',
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 8. member_rows / voter_rows / data_files (Excel/CSV import)
--    Columns: Member Number, NIC, FULL NAME, ADDRESS, POSTAL ADDRESS, GENDER
-- ---------------------------------------------------------------------------
create table if not exists public.member_rows (
  id uuid primary key default gen_random_uuid(),
  member_no text default '',
  nic text default '',
  full_name text default '',
  address text default '',
  postal_address text default '',
  gender text default '',
  file_name text default ''
);

create table if not exists public.voter_rows (
  id uuid primary key default gen_random_uuid(),
  voter_no text default '',
  nic text default '',
  full_name text default '',
  address text default '',
  postal_address text default '',
  gender text default '',
  file_name text default ''
);

create table if not exists public.data_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  rows bigint default 0,
  kind text not null default 'member'      -- member | voter
);

create table if not exists public.data_imports (
  id uuid primary key default gen_random_uuid(),
  kind text default 'member',
  mode text default 'append',
  files text default '',
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 9. fuel_prices (admin එකෙන් හැමදාම update)
-- ---------------------------------------------------------------------------
create table if not exists public.fuel_prices (
  type text primary key,                   -- petrol92 | super_diesel | kerosene
  price numeric not null default 0,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 10. system_settings (WhatsApp number / emails / years / counters)
-- ---------------------------------------------------------------------------
create table if not exists public.system_settings (
  key text primary key,
  value text not null default ''
);

-- ---------------------------------------------------------------------------
-- 11. RLS
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists sections text default '';

alter table public.profiles enable row level security;
alter table public.business_units enable row level security;
alter table public.business_services enable row level security;
alter table public.business_contacts enable row level security;
alter table public.business_branches enable row level security;
alter table public.board_members enable row level security;
alter table public.news enable row level security;
alter table public.gallery_items enable row level security;
alter table public.gallery_comments enable row level security;
alter table public.messages enable row level security;
alter table public.membership_applications enable row level security;
alter table public.member_rows enable row level security;
alter table public.voter_rows enable row level security;
alter table public.data_files enable row level security;
alter table public.data_imports enable row level security;
alter table public.fuel_prices enable row level security;
alter table public.system_settings enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

-- profiles: own + admins
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (auth.uid() = id or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (auth.uid() = id or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- public read (active businesses etc.), admin write
do $$
declare t text;
begin
  foreach t in array array['business_units','business_services','business_contacts','business_branches',
                          'board_members','news','gallery_items','gallery_comments',
                          'member_rows','voter_rows','data_files','fuel_prices','system_settings'] loop
    execute format('drop policy if exists %I_pub_read on public.%I', t, t);
    execute format('create policy %I_pub_read on public.%I for select using (true)', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format('create policy %I_admin_write on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- messages: ඕන කෙනෙකුට යවන්න පුළුවන්; බලන්න/reply කරන්න admin පමණයි
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (true);
drop policy if exists messages_admin on public.messages;
create policy messages_admin on public.messages for all using (public.is_admin()) with check (public.is_admin());

-- applications: ඕන කෙනෙකුට අයදුම් කරන්න පුළුවන්; admin approve/reject
drop policy if exists apps_insert on public.membership_applications;
create policy apps_insert on public.membership_applications for insert with check (true);
drop policy if exists apps_admin on public.membership_applications;
create policy apps_admin on public.membership_applications for all using (public.is_admin()) with check (public.is_admin());

-- data_imports: admin පමණයි
drop policy if exists imports_admin on public.data_imports;
create policy imports_admin on public.data_imports for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 12. homepage live counters (optional refresh trigger placeholder)
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_fuel_touch on public.fuel_prices;
create trigger trg_fuel_touch before update on public.fuel_prices
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 13. Image storage (hero backgrounds සහ site images upload කිරීමට)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

drop policy if exists "public read site-images" on storage.objects;
create policy "public read site-images" on storage.objects
  for select using (bucket_id = 'site-images');

drop policy if exists "admin upload site-images" on storage.objects;
create policy "admin upload site-images" on storage.objects
  for insert with check (bucket_id = 'site-images' and public.is_admin());

drop policy if exists "admin update site-images" on storage.objects;
create policy "admin update site-images" on storage.objects
  for update using (bucket_id = 'site-images' and public.is_admin());

drop policy if exists "admin delete site-images" on storage.objects;
create policy "admin delete site-images" on storage.objects
  for delete using (bucket_id = 'site-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- system settings
-- ---------------------------------------------------------------------------
insert into public.system_settings (key, value) values
  ('whatsapp_number', '94742352670'),
  ('years_of_service', '50'),
  ('contact_email_1', 'itk200712@gmail.com'),
  ('contact_email_2', ''),
  ('members_total', '52964'),
  ('voters_total', '2359'),
  ('members_files_count', '52'),
  ('voters_files_count', '1'),
  ('org_name_si', 'සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය'),
  ('org_name_en', 'Panduwasnuwara New Multi Purpose Co-Operative Society LTD'),
  ('hero_images', '["/images/hero/hero-1.jpg","/images/hero/hero-2.jpg","/images/hero/hero-3.jpg","/images/hero/hero-4.jpg","/images/hero/hero-5.jpg"]')
on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------------
-- fuel prices
-- ---------------------------------------------------------------------------
insert into public.fuel_prices (type, price) values
  ('petrol92', 414),
  ('super_diesel', 528),
  ('kerosene', 285)
on conflict (type) do update set price = excluded.price;

-- ---------------------------------------------------------------------------
-- business units (14)
-- ---------------------------------------------------------------------------
insert into public.business_units (slug, "order", name_en, name_si, category_en, category_si, tagline_en, tagline_si, desc_en, desc_si, logo, cover, is_new, active, special) values
('ristbury-tiara', 1, 'Ristbury Tiara Agency', 'රිස්බරි ටියාරා නියෝජිතායතනය', 'Commercial Distribution', 'වාණිජ බෙදාහැරීම්', 'Official Ristbury Tiara distribution', 'රිස්බරි ටියාරා නිල බෙදාහැරීම් සේවාව', 'Official agency for Ristbury and Tiara confectionery products — fresh stock supply for retail shops and special events.', 'රිස්බරි සහ ටියාරා රසකැවිලි නිෂ්පාදන සඳහා නිල නියෝජිතායතනය — සිල්ලර කඩ සහ විශේෂ අවස්ථා සඳහා නැවුම් තොග සැපයුමක් සපයයි.', '/images/sections/ristbury-tiara.png', null, true, true, 'default'),
('coop-city', 2, 'Co-op City Supermarket', 'කෝ-ඔප් සිටි සුපිරි වෙළඳසැල', 'Retail & Consumer', 'සිල්ලර හා පාරිභෝගික', '', '', '', '', '/images/sections/coop-city.png', null, false, true, 'default'),
('transport', 3, 'Transport & Distribution Division', 'ප්‍රවාහන හා බෙදාහැරීම් අංශය', 'Community Welfare', 'ප්‍රජා සුභසාධන', '', '', '', '', '/images/sections/transport.png', null, false, true, 'default'),
('fertilizer', 4, 'Agricultural Fertilizer Depot', 'කෘෂි පොහොර ගබඩාව', 'Business Division', 'ව්‍යාපාර අංශය', '', '', '', '', '/images/sections/fertilizer.png', null, true, false, 'default'),
('insurance', 5, 'Co-op Insurance Agency', 'සමූපකාර රක්ෂණ නියෝජිතායතනය', 'Business Division', 'ව්‍යාපාර අංශය', '', '', '', '', '/images/sections/insurance.png', null, true, true, 'default'),
('rural-bank', 6, 'Rural Bank', 'ග්‍රාමීය බැංකුව', 'Banking & Finance', 'බැංකු කටයුතු හා මූල්‍ය', 'Trusted savings & fast loans for our community', 'අපේ ප්‍රජාවට විශ්වාසනීය ඉතුරුම් සහ වේගවත් ණය', 'The Rural Bank is the heart of our society — safe, member-focused banking right in your village. Deposit with confidence and grow with us.', 'අපේ සමිතියේ හදවත වන්නේ ග්‍රාමීය බැංකුවයි — ඔබේ ගමේදීම ආරක්ෂිත, සාමාජික කේන්ද්‍රීය බැංකු සේවාවක්.', '/images/sections/rural-bank.png', null, false, true, 'rural-bank'),
('consumer', 7, 'Consumer Section', 'පාරිභෝගික අංශය', 'Retail & Consumer', 'සිල්ලර හා පාරිභෝගික', 'Quality goods at fair prices for members', 'සාමාජිකයින් සඳහා සාධාරණ මිල ගණන්වලට ගුණාත්මක භාණ්ඩ', 'From rice and dhal to soaps and stationery — the Consumer Section supplies quality essential goods at fair prices.', 'බත් සහ පරිප්පු සිට සබන් සහ ලිපි ද්‍රව්‍ය දක්වා — පාරිභෝගික අංශය සාධාරණ මිල ගණන්වලට ගුණාත්මක අත්‍යවශ්‍ය භාණ්ඩ සපයයි.', '/images/sections/consumer.png', null, false, true, 'consumer'),
('maliban-biscuits', 8, 'Maliban Biscuits Agency', 'මාලිබන් බිස්කට් නියෝජිතායතනය', 'Commercial Distribution', 'වාණිජ බෙදාහැරීම්', 'Authorized Maliban biscuits distribution', 'බලයලත් මාලිබන් බිස්කට් බෙදාහැරීම', 'Official agency for Maliban biscuits — supplying shops, retailers, and wholesalers at competitive agency rates.', 'මාලිබන් බිස්කට් සඳහා නිල නියෝජිතායතනය — කඩ, සිල්ලර වෙළෙන්දන් සහ තොග වෙළෙන්දන් තරඟකාරී නියෝජිත ගාස්තුවලට සපයයි.', '/images/sections/maliban-biscuits.png', null, false, true, 'default'),
('maliban-kiri', 9, 'Maliban Milk Agency', 'මාලිබන් කිරි නියෝජිතායතනය', 'Commercial Distribution', 'වාණිජ බෙදාහැරීම්', 'Trusted Maliban milk powder distribution', 'විශ්වාසනීය මාලිබන් කිරි පිටි බෙදාහැරීම', 'Official distributor for Maliban milk powder products — from daily milk powder to infant milk formulas.', 'මාලිබන් කිරි පිටි නිෂ්පාදන සඳහා නිල බෙදාහරින්නා — දෛනික කිරි පිටි සිට ළදරු කිරි මිශ්‍රණ දක්වා.', '/images/sections/maliban-kiri.png', null, false, true, 'default'),
('natures-secrets', 10, 'Nature''s Secrets Agency', 'නේචර්ස් සීක්‍රට්ස් නියෝජිතායතනය', 'Commercial Distribution', 'වාණිජ බෙදාහැරීම්', 'Herbal beauty products agency', 'ශාකසාර සුන්දරත්ව නිෂ්පාදන නියෝජිතායතනය', 'Official agency for Nature''s Secrets herbal beauty products — supplying Aloe Vera, White Sandalwood, and herbal care ranges.', 'නේචර්ස් සීක්‍රට්ස් ශාකසාර සුන්දරත්ව නිෂ්පාදන සඳහා නිල නියෝජිතායතනය.', '/images/sections/natures-secrets.png', null, false, true, 'default'),
('hemas', 11, 'Hemas Agency', 'හෙමාස් නියෝජිතායතනය', 'Commercial Distribution', 'වාණිජ බෙදාහැරීම්', 'Trusted Hemas brands distribution', 'විශ්වාසනීය හෙමාස් වෙළඳ නාම බෙදාහැරීම', 'Hemas products agency — supplying Baby Cheramy baby care, Kumarika hair care, personal care, and household items.', 'හෙමාස් නිෂ්පාදන නියෝජිතායතනය — බේබි චෙරමි ළදරු රැකවරණ, කුමාරිකා කෙස් රැකවරණ සහ නිවාස භාණ්ඩ සපයයි.', '/images/sections/hemas.png', null, false, true, 'default'),
('fuel-station', 12, 'Fuel Station', 'ඉන්ධන පිරවුම්හල', 'Energy & Fuel', 'බලශක්ති හා ඉන්ධන', 'Our newest venture — open daily from 6.00 AM', 'අපේ නවතම ව්‍යාපාරය — හැමදාම පෙ.ව 6.00 සිට විවෘතයි', 'Full service fuel filling station providing petrol and diesel; priority lines and fuel pass facilities for society members. Includes air, water, and convenience shop.', 'පෙට්‍රල් සහ ඩීසල් සපයන සම්පූර්ණ සේවා ඉන්ධන පිරවුම්හලක්.', '/images/sections/fuel-station.png', null, true, true, 'fuel-station'),
('funeral', 13, 'Funeral Services Section', 'අන්තිම කටයුතු සේවා අංශය', 'Community Welfare', 'ප්‍රජා සුභසාධන', 'Compassionate & affordable funeral care services', 'කරුණාවන්ත හා දැරිය හැකි අන්තිම කටයුතු රැකවරණ සේවා', 'Co-operative funeral care section providing financial assistance and compassionate funeral services for member families.', 'සමූපකාර අන්තිම කටයුතු රැකවරණ අංශයකි.', '/images/sections/funeral.png', null, false, true, 'default'),
('gold-loan-service', 14, 'Gold Loan Service', 'රත්‍රන් ණය සේවාව', 'Finance & Loan', 'මූල්‍ය හා ණය', 'Reliable gold loan service for members', 'සාමාජිකයින් සඳහා විශ්වාසනීය රත්‍රන් ණය සේවාව', 'Affordable and reliable gold loan service with transparent valuations and flexible repayment options.', 'විනිවිද පෙනෙන ඇගයීම් සහ නම්‍යශීලී ගෙවීම් විකල්ප සහිත දැරිය හැකි හා විශ්වාසනීය රත්‍රන් ණය සේවාවකි.', '/images/sections/gold-loan.png', null, false, true, 'default')
on conflict (slug) do nothing;

-- business contacts
insert into public.business_contacts (business_slug, role_en, role_si, name, location, phone, note_en, note_si) values
('ristbury-tiara', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ඩී. ඇම්. රණසිංහ (Manager)', 'ජයන්තිපුර මාවත, බණ්ඩාරගම පාර, හෙට්ටිපොල', '037 229 1018', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('coop-city', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ආර්. ජී. ද සිල්වා (Manager)', 'කුරුණෑගල පාර, හෙට්ටිපොල', '037 229 1017', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('transport', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'එම්. ජී. සෙනවිරත්න (Manager)', 'සමූපකාර මාවත, පඬුවස්නුවර', '037 229 1018', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('fertilizer', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ඇම්. ඩී. බණ්ඩාරසිංහ (Manager)', 'හෙට්ටිපොල', '037 229 1019', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('insurance', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'එම්. ජී. පෙරේරා (Manager)', 'සමූපකාර මාවත, පඬුවස්නුවර', '037 229 1021', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('rural-bank', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ආර්. එම්. පෙරේරා (Manager)', 'සමූපකාර මාවත, හෙට්ටිපොල, පඬුවස්නුවර', '037 229 1012', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('consumer', 'Sales Development Manager', 'විකුණුම් සංවර්ධන කළමනාකරු', 'එච්. බී. රණසිංහ (Manager)', 'කුරුණෑගල පාර, හෙට්ටිපොල', '037 229 1013', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('consumer', 'Store Manager', 'ගබඩා කළමනාකරු', 'ජේ. අමිල ද සිල්වා (Manager)', 'කුරුණෑගල පාර, හෙට්ටිපොල', '070 526 8848', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('maliban-biscuits', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ආර්. ජී. ප්‍රේමරත්න (Manager)', 'බුලත්කුඹුර මංසන්ධිය, හෙට්ටිපොල', '037 229 1014', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('maliban-kiri', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'එම්. ජී. ජයසිංහ (Manager)', 'බුලත්කුඹුර මංසන්ධිය, හෙට්ටිපොල', '037 229 1015', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('natures-secrets', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ආර්. ජී. ප්‍රේමරත්න (Manager)', 'බුලත්කුඹුර මංසන්ධිය, හෙට්ටිපොල', '037 229 1016', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('hemas', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ඩී. ජී. කුමාර (Manager)', 'බුලත්කුඹුර මංසන්ධිය, හෙට්ටිපොල', '037 229 1017', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('fuel-station', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ඩී. ජී. කුමාර (Manager)', 'කුරුණෑගල පාර, හෙට්ටිපොල', '037 229 1019', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('funeral', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'ආර්. ජී. සිසිර කුමාර (Manager)', 'සමූපකාර මාවත, පඬුවස්නුවර', '037 229 1020', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු'),
('gold-loan-service', 'Contact Manager', 'සම්බන්ධතා කළමනාකරු', 'කළමනාකරු (Manager)', 'සමූපකාර මාවත, පඬුවස්නුවර', '037 229 1012', 'Department Operations', 'දෙපාර්තමේන්තු කටයුතු');

-- consumer regional branch
insert into public.business_branches (business_slug, name, manager, location, phone) values
('consumer', 'Mandapola', 'Wasantha Kumara', 'Mandapola', '037 229 2045');

-- ---------------------------------------------------------------------------
-- business services (50) — key units full detail, others default template
-- ---------------------------------------------------------------------------
insert into public.business_services (business_slug, "order", title_en, title_si, desc_en, desc_si, features_en, features_si, active) values
('ristbury-tiara', 1, 'Wholesale Supply', 'තොග සැපයුම', 'Premier service offered by Ristbury Tiara Agency.', 'රිස්බරි ටියාරා නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('ristbury-tiara', 2, 'Retail Distribution', 'සිල්ලර බෙදාහැරීම', 'Premier service offered by Ristbury Tiara Agency.', 'රිස්බරි ටියාරා නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('ristbury-tiara', 3, 'Bulk Event Orders', 'විශාල උත්සව ඇණවුම්', 'Premier service offered by Ristbury Tiara Agency.', 'රිස්බරි ටියාරා නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('ristbury-tiara', 4, 'Credit Facilities', 'ණය පහසුකම්', 'Premier service offered by Ristbury Tiara Agency.', 'රිස්බරි ටියාරා නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('ristbury-tiara', 5, 'Timely Delivery', 'නියමිත වේලාවට බෙදාහැරීම', 'Premier service offered by Ristbury Tiara Agency.', 'රිස්බරි ටියාරා නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('rural-bank', 1, 'Savings Accounts', 'ඉතුරුම් ගිණුම්', 'Flexible regular savings accounts with competitive interest rates and seamless withdrawals for daily needs.', 'තරඟකාරී පොලි අනුපාත සහ දෛනික අවශ්‍යතා සඳහා පහසු මුදල් ගැනීම් සහිත නම්‍යශීලී ඉතුරුම් ගිණුම්.', array['Instant account opening','High annual interest','Passbook facilities'], array['ක්ෂණික ගිණුම් විවෘත කිරීම','ඉහළ වාර්ෂික පොලිය','පාස්බුක් පහසුකම්'], true),
('rural-bank', 2, 'Fixed Deposits', 'ස්ථිර තැන්පතු (නියමිත තැන්පතු)', 'Guaranteed high-yield investment options with flexible tenure terms ranging from 3 months to 5 years.', 'මාස 3 සිට අවුරුදු 5 දක්වා නම්‍යශීලී කාල සීමා සහිත සහතික කළ ඉහළ ආදායම් ආයෝජන විකල්ප.', array['Higher interest for seniors','Monthly/maturity payout','100% security guarantee'], array['වැඩිහිටියන්ට ඉහළ පොලිය','මාසික/කල්පිරීම් ගෙවීම්','100% ආරක්ෂක සහතිකය'], true),
('rural-bank', 3, 'Daily Loan Schemes', 'දෛනික ණය යෝජනා', 'Accessible working capital loans for self-employed individuals, retail vendors, and small agricultural enterprises.', 'ස්වයං රැකියාකරුවන්, සිල්ලර වෙළෙන්දන් සහ කුඩා කෘෂි ව්‍යාපාර සඳහා ප්‍රවේශ විය හැකි ක්‍රියාකාරී ප්‍රාග්ධන ණය.', array['Fast approval within 24h','Minimal documentation','Flexible daily repayments'], array['පැය 24ක් ඇතුළත වේගවත් අනුමැතිය','අවම ලේඛන','නම්‍යශීලී දෛනික ගෙවීම්'], true),
('rural-bank', 4, 'Gold Pawning & Jewellery Loans', 'රන් උකස් සහ ආභරණ ණය', 'Confidential and highly secure gold pawning facilities with maximum valuation and lowest approved interest rates.', 'උපරිම ඇගයීම් සහ අඩුම අනුමත පොලි අනුපාත සහිත රහස්‍ය හා අතිශය ආරක්ෂිත රන් උකස් පහසුකම්.', array['Highest advance per sovereign','Vault security guarantee','Part payment options'], array['සොවරින් එකකට උපරිම අත්තිකාරම','තැන්පතු ආරක්ෂක සහතිකය','කොටස් ගෙවීම් විකල්ප'], true),
('rural-bank', 5, 'Children''s Savings Schemes', 'ළමා ඉතුරුම් යෝජනා', 'Dedicated savings plans to build a bright future for children with bonus interest and educational rewards.', 'බෝනස් පොලිය සහ අධ්‍යාපන ත්‍යාග සහිතව ළමයින් සඳහා දීප්තිමත් අනාගතයක් ගොඩනැගීමට කැපවූ ඉතුරුම් සැලසුම්.', array['Attractive annual gifts','Educational grant bonuses','Parental standing orders'], array['ආකර්ෂණීය වාර්ෂික තෑගි','අධ්‍යාපන අනුදැනුම් බෝනස්','දෙමාපිය ස්ථිර නියෝග'], true),
('rural-bank', 6, 'Loan Repayment Orders & Transfers', 'ණය ගෙවීම් නියෝග හා මාරු', 'Automated inter-branch transfers, standing orders, and institutional payroll deductions for smooth loan servicing.', 'සුමට ණය සේවාකරණය සඳහා ස්වයංක්‍රීය අතරමැදි ශාඛා මාරු, ස්ථිර නියෝග සහ ආයතනික වැටුප් කප්පාදු.', array['Network-wide inter-branch access','Zero hidden service fees','SMS payment updates'], array['ජාලය පුරා අතරමැදි ශාඛා ප්‍රවේශය','සැඟවුණු සේවා ගාස්තු නැත','SMS ගෙවීම් යාවත්කාලීන'], true),
('consumer', 1, 'Wholesale & Retail Sales', 'තොග හා සිල්ලර විකුණුම්', 'Premier service offered by Consumer Section.', 'පාරිභෝගික අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('consumer', 2, 'Member Discount Schemes', 'සාමාජික වට්ටම් යෝජනා', 'Premier service offered by Consumer Section.', 'පාරිභෝගික අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('consumer', 3, 'Festive Season Promotions', 'මංගල්‍ය කාල ප්‍රවර්ධන', 'Premier service offered by Consumer Section.', 'පාරිභෝගික අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('consumer', 4, 'Bulk Orders for Events', 'උත්සව සඳහා තොග ඇණවුම්', 'Premier service offered by Consumer Section.', 'පාරිභෝගික අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('consumer', 5, 'Home Delivery Service', 'නිවසට බෙදාහැරීම් සේවාව', 'Premier service offered by Consumer Section.', 'පාරිභෝගික අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('consumer', 6, 'Fair-priced Essential Goods', 'සාධාරණ මිලෙන් අත්‍යවශ්‍ය භාණ්ඩ', 'Premier service offered by Consumer Section.', 'පාරිභෝගික අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('fuel-station', 1, 'Petrol 92 / 95', 'පෙට්‍රල් 92 / 95', 'Premier service offered by Fuel Station.', 'ඉන්ධන පිරවුම්හල විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('fuel-station', 2, 'Auto Diesel & Super Diesel', 'ඔටෝ ඩීසල් සහ සුපර් ඩීසල්', 'Premier service offered by Fuel Station.', 'ඉන්ධන පිරවුම්හල විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('fuel-station', 3, 'Fuel Pass Scheme for Members', 'සාමාජිකයින් සඳහා ඉන්ධන පාස් යෝජනා', 'Premier service offered by Fuel Station.', 'ඉන්ධන පිරවුම්හල විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('fuel-station', 4, 'Priority Queue for Members', 'සාමාජිකයින් සඳහා ප්‍රමුඛතා පෝලිම', 'Premier service offered by Fuel Station.', 'ඉන්ධන පිරවුම්හල විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('fuel-station', 5, 'Air & Water Services', 'වාතය සහ ජල සේවා', 'Premier service offered by Fuel Station.', 'ඉන්ධන පිරවුම්හල විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('hemas', 1, 'Baby Care Products (Baby Cheramy)', 'ළදරු රැකවරණ නිෂ්පාදන (බේබි චෙරමි)', 'Premier service offered by Hemas Agency.', 'හෙමාස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('hemas', 2, 'Personal Care', 'පුද්ගලික රැකවරණ', 'Premier service offered by Hemas Agency.', 'හෙමාස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('hemas', 3, 'Hair Care (Kumarika)', 'කෙස් රැකවරණ (කුමාරිකා)', 'Premier service offered by Hemas Agency.', 'හෙමාස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('hemas', 4, 'Household Items', 'නිවාස භාණ්ඩ', 'Premier service offered by Hemas Agency.', 'හෙමාස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('hemas', 5, 'Wholesale Supply', 'තොග සැපයුම', 'Premier service offered by Hemas Agency.', 'හෙමාස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('hemas', 6, 'Member Special Offers', 'සාමාජික විශේෂ දීමනා', 'Premier service offered by Hemas Agency.', 'හෙමාස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-biscuits', 1, 'Wholesale Supply', 'තොග සැපයුම', 'Premier service offered by Maliban Biscuits Agency.', 'මාලිබන් බිස්කට් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-biscuits', 2, 'Retail Distribution', 'සිල්ලර බෙදාහැරීම', 'Premier service offered by Maliban Biscuits Agency.', 'මාලිබන් බිස්කට් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-biscuits', 3, 'Fresh Stock Delivery', 'නැවුම් තොග බෙදාහැරීම', 'Premier service offered by Maliban Biscuits Agency.', 'මාලිබන් බිස්කට් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-biscuits', 4, 'Bulk Event Orders', 'විශාල උත්සව ඇණවුම්', 'Premier service offered by Maliban Biscuits Agency.', 'මාලිබන් බිස්කට් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-biscuits', 5, 'Credit Facilities', 'ණය පහසුකම්', 'Premier service offered by Maliban Biscuits Agency.', 'මාලිබන් බිස්කට් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-biscuits', 6, 'Promotional Schemes', 'ප්‍රවර්ධන යෝජනා', 'Premier service offered by Maliban Biscuits Agency.', 'මාලිබන් බිස්කට් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-kiri', 1, 'Wholesale Supply', 'තොග සැපයුම', 'Premier service offered by Maliban Milk Agency.', 'මාලිබන් කිරි නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-kiri', 2, 'Retail Distribution', 'සිල්ලර බෙදාහැරීම', 'Premier service offered by Maliban Milk Agency.', 'මාලිබන් කිරි නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-kiri', 3, 'Infant Formula Supply', 'ළදරු කිරි මිශ්‍රණ සැපයුම', 'Premier service offered by Maliban Milk Agency.', 'මාලිබන් කිරි නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-kiri', 4, 'Bulk Event Orders', 'විශාල උත්සව ඇණවුම්', 'Premier service offered by Maliban Milk Agency.', 'මාලිබන් කිරි නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-kiri', 5, 'Credit Facilities', 'ණය පහසුකම්', 'Premier service offered by Maliban Milk Agency.', 'මාලිබන් කිරි නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('maliban-kiri', 6, 'Regular Delivery Schedules', 'නිතිපතා බෙදාහැරීම් කාලසටහන්', 'Premier service offered by Maliban Milk Agency.', 'මාලිබන් කිරි නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('natures-secrets', 1, 'Wholesale Supply', 'තොග සැපයුම', 'Premier service offered by Nature''s Secrets Agency.', 'නේචර්ස් සීක්‍රට්ස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('natures-secrets', 2, 'Retail Distribution', 'සිල්ලර බෙදාහැරීම', 'Premier service offered by Nature''s Secrets Agency.', 'නේචර්ස් සීක්‍රට්ස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('natures-secrets', 3, 'Aloe Vera Range', 'ඇලෝවෙරා පෙළ', 'Premier service offered by Nature''s Secrets Agency.', 'නේචර්ස් සීක්‍රට්ස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('natures-secrets', 4, 'White Sandalwood Range', 'සුදු හඳුන් පෙළ', 'Premier service offered by Nature''s Secrets Agency.', 'නේචර්ස් සීක්‍රට්ස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('natures-secrets', 5, 'Herbal Care Products', 'ශාකසාර රැකවරණ නිෂ්පාදන', 'Premier service offered by Nature''s Secrets Agency.', 'නේචර්ස් සීක්‍රට්ස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('natures-secrets', 6, 'Member Special Offers', 'සාමාජික විශේෂ දීමනා', 'Premier service offered by Nature''s Secrets Agency.', 'නේචර්ස් සීක්‍රට්ස් නියෝජිතායතනය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('funeral', 1, 'Funeral Financial Assistance', 'අන්තිම කටයුතු මූල්‍ය සහාය', 'Premier service offered by Funeral Services Section.', 'අන්තිම කටයුතු සේවා අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('funeral', 2, 'Coffin & Logistics Support', 'දේහ පෙට්ටි හා ලොජිස්ටික් සහාය', 'Premier service offered by Funeral Services Section.', 'අන්තිම කටයුතු සේවා අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('funeral', 3, 'Member Family Guidance', 'සාමාජික පවුල් මඟපෙන්වීම', 'Premier service offered by Funeral Services Section.', 'අන්තිම කටයුතු සේවා අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('funeral', 4, 'Compassionate Home Visits', 'කරුණාවන්ත නිවාස සංචාර', 'Premier service offered by Funeral Services Section.', 'අන්තිම කටයුතු සේවා අංශය විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('gold-loan-service', 1, 'Gold Valuation', 'රත්‍රන් ඇගයීම', 'Premier service offered by Gold Loan Service.', 'රත්‍රන් ණය සේවාව විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('gold-loan-service', 2, 'Instant Loan Approval', 'ක්ෂණික ණය අනුමැතිය', 'Premier service offered by Gold Loan Service.', 'රත්‍රන් ණය සේවාව විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('gold-loan-service', 3, 'Flexible Repayment Plans', 'නම්‍යශීලී ගෙවීම් සැලසුම්', 'Premier service offered by Gold Loan Service.', 'රත්‍රන් ණය සේවාව විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true),
('gold-loan-service', 4, 'Secure Jewellery Storage', 'ආරක්ෂිත ආභරණ ගබඩා කිරීම', 'Premier service offered by Gold Loan Service.', 'රත්‍රන් ණය සේවාව විසින් සපයනු ලබන ප්‍රමුඛ සේවාවකි.', array['Trusted quality','Member privileges','Certified standard'], array['විශ්වාසනීය ගුණාත්මකභාවය','සාමාජික වරප්‍රසාද','සහතික කළ ප්‍රමිතිය'], true);

-- ---------------------------------------------------------------------------
-- board members (9)
-- ---------------------------------------------------------------------------
insert into public.board_members ("order", category, name_en, name_si, position_en, position_si, qualification, phone, email, address, photo) values
(1, 'chairman', 'Emal Priyantha Herath', 'එමාල් ප්‍රියන්ත හේරත්', 'Chairman', 'සභාපති', 'B.Com. (Hons) — University of Kelaniya', '071 229 1011', 'member1@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null),
(2, 'vice-chairman', 'Malith Priyankara Edirisinghe', 'මලිත් ප්‍රියංකාර එදිරිසිංහ', 'Vice Chairman', 'උප සභාපති', 'B.Sc. Business Administration — USJP', '072 229 1012', 'member2@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null),
(3, 'director', 'Palitha Priyadarshana Perera', 'පලිත ප්‍රියදර්ශන පෙරේරා', 'Director', 'අධ්‍යක්ෂ', 'Dip. in Co-operative Management', '073 229 1013', 'member3@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null),
(4, 'director', 'Lakmal Sanjeewa Premathilake', 'ලක්මාල් සංජීව ප්‍රේමතිලක', 'Director', 'අධ්‍යක්ෂ', 'B.A. (Hons) Economics — University of Peradeniya', '074 229 1014', 'member4@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null),
(5, 'director', 'S.H.M. Bandarasekera', 'එස්.එච්.එම්. බණ්ඩාරසේකර', 'Director', 'අධ්‍යක්ෂ', 'MBA — PIM, USJP', '075 229 1015', 'member5@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null),
(6, 'director', 'S. Ranjith Dharmasiri', 'එස්. රංජිත් ධර්මසිරි', 'Director', 'අධ්‍යක්ෂ', 'Higher Dip. in Accountancy (AAT)', '076 229 1016', 'member6@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null),
(7, 'director', 'R.M. Chaminda Sandaruwan Rathnayake', 'ආර්.එම්. චමින්ද සන්දරුවන් රත්නායක', 'Director', 'අධ්‍යක්ෂ', 'B.Sc. Agriculture — Wayamba University', '077 229 1017', 'member7@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null),
(8, 'officer', 'M.P.N.I. Gunathilake', 'එම්.පී.එන්.අයි. ගුණතිලක', 'Regional Co-op Officer', 'කලාපීය සමූපකාර නිලධාරී', 'Dip. in Public Administration', '078 229 1018', 'member8@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null),
(9, 'officer', 'D.K.P.P.D. Dikwella', 'ඩී.කේ.පී.පී.ඩී. දික්වැල්ල', 'General Manager', 'සාමාන්‍ය කළමනාකරු', 'M.Sc. Management — University of Colombo', '079 229 1019', 'member9@mpcs.lk', 'කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා', null);

-- ---------------------------------------------------------------------------
-- news (3)
-- ---------------------------------------------------------------------------
insert into public.news (id, category, badge_text, title_en, title_si, desc_en, desc_si, date, image, pinned, published) values
('news-driver-vacancies', 'vacancy', 'Job Vacancy', 'Call for Applications: Heavy Vehicle & Logistics Driver Vacancies', 'බර වාහන හා ලොජිස්ටික් රියදුරන් බඳවා ගැනීම පිළිබඳ අයදුම්පත් කැඳවීම', 'Panduwasnuwara Multi-Purpose Co-operative Society (MPCS) invites applications from energetic, experienced, and qualified Sri Lankan citizens for the post of Heavy Vehicle & Distribution Drivers. Key Requirements: • Valid Sri Lankan Heavy Vehicle Driving License • Minimum 2 years experience • Clean driving record.', 'සී/ස පඬුවස්නුවර විවිධ සේවා සමූපකාර සමිතිය (MPCS) විසින් බර වාහන හා බෙදාහැරීම් රියදුරන් ධූරය සඳහා සුදුසුකම් ලත් ශ්‍රී ලාංකික පුරවැසියන්ගෙන් අයදුම්පත් කැඳවයි.', '2026-09-15', '/images/news/driver-vacancy.jpg', true, true),
('news-paddy-procurement', 'notice', 'Special Notice', 'Procurement of 2026 Yala Season Paddy & Agricultural Crops at Guaranteed Prices', '2026 යල කන්නයේ වී සහ කෘෂි බෝග සහතික මිලට මිලදී ගැනීම', 'Panduwasnuwara MPCS has officially commenced direct procurement of Yala season paddy harvest and agricultural produce through designated cooperative storage centres to protect farming families against middlemen exploitation.', 'පඬුවස්නුවර MPCS සමිතිය විසින් ගොවි පවුල් ආරක්ෂා කිරීම සඳහා යල කන්නයේ වී අස්වැන්න සෘජුව මිලදී ගැනීම ආරම්භ කර ඇත.', '2026-09-15', '/images/news/paddy-procurement.jpg', false, true),
('news-agm-48', 'notice', 'Special Notice', 'Notice of 48th Annual General Meeting & Member Dividend Distribution', '48 වන වාර්ෂික මහා සභා රැස්වීම සහ සාමාජික ලාභාංශ බෙදාහැරීම පිළිබඳ නිවේදනය', 'The 48th Annual General Meeting of the Panduwasnuwara Multi-Purpose Co-operative Society will be held at the MPCS Main Auditorium, Hettipola. Key Agenda: • Presentation of Audited Annual Financial Accounts • Member dividend distribution • Election of office bearers.', 'සී/ස පඬුවස්නුවර විවිධ සේවා සමූපකාර සමිතියේ 48 වන වාර්ෂික මහා සභා රැස්වීම MPCS ප්‍රධාන ශ්‍රවණාගාරය, හෙට්ටිපොල දී පැවැත්වේ.', '2026-09-15', '/images/news/agm-48.jpg', false, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- gallery
-- ---------------------------------------------------------------------------
insert into public.gallery_items (id, title, description, aspect, image, likes) values
('gal-pirith', 'An all-night Pirith chanting ceremony', 'සමිතියේ වාර්ෂික සර්ව රාත්‍රී පිරිත් පිංකම — සාමාජිකයින් සහ පවුල් එක්ව සහභාගී වූ අවස්ථාව.', '4:3', '/images/gallery/pirith.jpg', 1),
('gal-agm', '48th Annual General Meeting', '48 වන වාර්ෂික මහා සභා රැස්වීම — MPCS ප්‍රධාන ශ්‍රවණාගාරය, හෙට්ටිපොල.', '16:9', '/images/gallery/agm.jpg', 3),
('gal-hq', 'Main Headquarters', 'සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතියේ ප්‍රධාන කාර්යාලය, හෙට්ටිපොල.', '3:2', '/images/gallery/headquarters.jpg', 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- data files (member Excel groups + voter file)
-- ---------------------------------------------------------------------------
insert into public.data_files (file_name, rows, kind) values
('Hettipola.xlsx', 3600, 'member'),
('Panduwasnuwara.xlsx', 2363, 'member'),
('Diyulwawa.xlsx', 2166, 'member'),
('Barampola.xlsx', 2073, 'member'),
('Kanogama.xlsx', 2001, 'member'),
('Madulla.xlsx', 1989, 'member'),
('Panduwasnuwara.xls', 2359, 'voter')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- sample member / voter rows (screenshots වලින් — real data Admin → Data එකෙන් upload කරන්න)
-- ---------------------------------------------------------------------------
insert into public.member_rows (member_no, nic, full_name, address, postal_address, gender, file_name) values
('41/01','0000000000','මුදිත ලියනආරච්චි','බෝගමුවාගොඩ','බෝගමුවාගොඩ','කාන්තා','Panduwasnuwara.xlsx'),
('41/02','0000000000','නි. සේ. සිසිර','හෙට්ටිපොල','හෙට්ටිපොල','පිරිමි','Panduwasnuwara.xlsx'),
('41/03','0000000000','ඩී. එම්. ඩී. සිල්වා බණ්ඩාර','ගිරිඋල්ල','ගිරිඋල්ල','පිරිමි','Panduwasnuwara.xlsx'),
('41/04','430500139v','චන්ද්‍රසේන ගුණසේන','පල්ලේනුවර','පල්ලේනුවර','පිරිමි','Hettipola.xlsx'),
('41/209','0000000000','කේ. එම්. පෙරේරා','පන්නිල්ගොඩ','පන්නිල්ගොඩ','කාන්තා','Hettipola.xlsx'),
('41/210','0000000000','මුදිත ලියනආරච්චි','අඹන්කුඹුර','අඹන්කුඹුර','කාන්තා','Hettipola.xlsx'),
('41/211','312490072v','චන්ද්‍රසේන ජයසිංහ මුදියන්සේලා ගුණසිංහ','ගිරිඋල්ල','ගිරිඋල්ල','පිරිමි','Diyulwawa.xlsx'),
('41/212','0000000000','නි. කේ. පී. රණසිංහ දිසානායක','බෝගමුවාගොඩ','බෝගමුවාගොඩ','පිරිමි','Diyulwawa.xlsx'),
('41/213','600164589v','චන්ද්‍රසේන ජයසිංහ මුදියන්සේලා ජයසූරිය','හෙට්ටිපොල','හෙට්ටිපොල','පිරිමි','Barampola.xlsx'),
('41/214','0000000000','නි. කේ. පී. ආර්. මුණසිංහ','පල්ලේනුවර','පල්ලේනුවර','පිරිමි','Barampola.xlsx'),
('41/215','0000000000','ජෝතිපාල ලියනආරච්චි','පන්නිල්ගොඩ','පන්නිල්ගොඩ','කාන්තා','Kanogama.xlsx'),
('41/216','0000000000','ඩී. කේ. පී. ආර්. ජයසිංහ','අඹන්කුඹුර','අඹන්කුඹුර','පිරිමි','Kanogama.xlsx');

insert into public.voter_rows (voter_no, nic, full_name, address, postal_address, gender, file_name) values
('01/01','0000000000','ඩබ්.බී. රණසිංහ','ගිරිඋල්ල','ගිරිඋල්ල','පිරිමි','Panduwasnuwara.xls'),
('01/03','0000000000','කේ. එම්. අබ්දුල්','පල්ලේනුවර','පල්ලේනුවර','පිරිමි','Panduwasnuwara.xls'),
('01/05','0000000000','අනු. අබේරත්න','පන්නිල්ගොඩ','පන්නිල්ගොඩ','කාන්තා','Panduwasnuwara.xls'),
('01/06','0000000000','ලී. පී. ප්‍රේමසිරි','අඹන්කුඹුර','අඹන්කුඹුර','පිරිමි','Panduwasnuwara.xls'),
('01/07','0000000000','ආර්. පී. සේනා','මැදබුලත්වැව','මැදබුලත්වැව','පිරිමි','Panduwasnuwara.xls'),
('01/08','0000000000','ඇම්. ඇම්. සිසිර කුමාර ලියනආරච්චි','කුඹුක්කුඹුර, වීරබුලත්වැව','වීරබුලත්වැව','පිරිමි','Panduwasnuwara.xls'),
('01/09','0000000000','ඇම්. ඇම්. ඇම්. ජයන්ති බණ්ඩාර.','වීරබුලත්වැව','වීරබුලත්වැව','කාන්තා','Panduwasnuwara.xls'),
('01/10','0000000000','ඇම්. ඇම්. උපුල් කුමාරි','වීරබුලත්වැව','වීරබුලත්වැව','කාන්තා','Panduwasnuwara.xls'),
('01/11','0000000000','ඇම්. ඇම්. ඇම්. ඇම්. ඇම්. බණ්ඩාර','වීරබුලත්වැව','වීරබුලත්වැව','පිරිමි','Panduwasnuwara.xls'),
('01/12','0000000000','ඇම්. ඇම්. තිලක්','වීරබුලත්වැව','වීරබුලත්වැව','පිරිමි','Panduwasnuwara.xls'),
('01/13','0000000000','ඇම්. ඇම්. චන්ද්‍රා බණ්ඩාර','ගිරිඋල්ල','ගිරිඋල්ල','කාන්තා','Panduwasnuwara.xls'),
('01/14','0000000000','ජී. ඇම්. උපුල් කුමාර','ගිරිඋල්ල','ගිරිඋල්ල','පිරිමි','Panduwasnuwara.xls');

-- ---------------------------------------------------------------------------
-- Superadmin account (NIC: SUPERADMIN / password: Admin@123)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_current, email_change_token_new,
  phone, phone_change, phone_change_token, reauthentication_token,
  is_super_admin, is_anonymous,
  raw_app_meta_data, raw_user_meta_data
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'superadmin@members.mpcs.lk',
  extensions.crypt('Admin@123', extensions.gen_salt('bf')),
  now(), now(), now(),
  '', '', '',
  '', '',
  '', '', '', '',
  false, false,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Super Administrator","nic":"SUPERADMIN"}'
where not exists (select 1 from auth.users where email = 'superadmin@members.mpcs.lk');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  format('{"sub":"%s","email":"%s"}', u.id, u.email)::jsonb,
  now(), now(), now()
from auth.users u
where u.email = 'superadmin@members.mpcs.lk'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into public.profiles (id, full_name, nic, phone, auth_email, password_display, role, status, joined_date)
select u.id, 'Super Administrator', 'SUPERADMIN', '0372291012', 'superadmin@members.mpcs.lk',
  encode('Admin@123'::bytea, 'base64'), 'superadmin', 'active', '2026-10-05'
from auth.users u
where u.email = 'superadmin@members.mpcs.lk'
  and not exists (select 1 from public.profiles p where p.nic = 'SUPERADMIN');
