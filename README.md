# 🏛️ පඳුවස්නුවර නව බහු අරමුණු සමූපකාර සමිතිය — වෙබ් අඩවිය

> 🌐 **Site එක දැන් භාෂා routes සමඟයි:** `/si` (සිංහල) · `/en` (English) — දකුණු පස ඇති **සිංහල | English** button එකෙන් මාරු කරන්න. Fonts: English = **Inter** · සිංහල = **Noto Sans Sinhala**. සමිතියේ නම: සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය.

**Panduwasnuwara New Multi Purpose Co-Operative Society LTD**  
Reg. No: ලියා/186 · ස්ථාපිතය: 1976-10-06 · හෙට්ටිපොල, පඳුවස්නුවර

| | |
|---|---|
| **Framework** | Next.js 15 (App Router) + TypeScript |
| **Styles** | Tailwind CSS (Bold & Corporate design) |
| **Database** | Supabase (PostgreSQL) — SQL file එකයි |
| **Hosting** | Vercel |
| **Fonts** | Inter + Noto Sans Sinhala (site එක පුරාම එකම font) |
| **Languages** | සිංහල / English (switcher එකක් සමඟ) |

---

## 🚀 ඉක්මන් ආරම්භය (Local)

```bash
npm install        # packages ස්ථාපනය
npm run dev        # http://localhost:3000 — සංවර්ධනය
npm run build      # production build
npm start          # production server
npm test           # logic + data tests (64 tests)
```

> ✅ Supabase නැතිවත් site එක **සම්පූර්ණයෙන්ම වැඩ කරයි** (seed data සමඟ). SQL run කළාට පස්සේ live database එකට යනවා.

---

## ✨ විශේෂාංග

### 🌐 Public Site
- **මුල් පිටුව** — hero background **slideshow** (images 5ක්+ auto-change · crossfade + zoom animation), live counters, ව්‍යාපාර, නිවේදන, membership CTA
- **ව්‍යාපාර අංශ 14ක්** — services, managers, contacts · විශේෂ pages: Rural Bank (ශාඛා **22** + සොයන්න), Consumer Section (කලාපීය ශාඛා), Fuel Station (ඉන්ධන මිල + "In Stock")
- **අධ්‍යක්ෂ මණ්ඩලය** — නිලධාරීන් 9 (Chairman / Vice Chairman / Directors / Officers)
- **සාමාජික ලේඛනය** — 52,964 members / 52 files · "Page 1 / 2119" · search + file filter + PDF
- **ඡන්ද ලේඛනය** — 2,359 voters / 1 file · "Page 1 / 95"
- **සාමාජිකත්ව අයදුම්පත** — රබර් මුද්‍රා ලේඛනය upload (≤10MB) + උපදෙස් 1–5
- **නිවේදන** — Job Vacancies / Special Notices / Tenders / News (tabs + PINNED)
- **Gallery** — title + description හැම විටම පෙනේ · lightbox · aspect ratios (4:3, 16:9, 1:1, 3:2)
- **සම්බන්ධතා** — FormSubmit මගින් විද්‍යුත් තැපෑලට · department select
- **Sign In / Register** — **NIC පිවිසුම** · Forgot Password → **WhatsApp** (wa.me) message

### 🔐 Admin Console (`/admin` — login අවශ්‍යයි)
Dashboard · My Profile · Registered Members (**PASSWORD column** show/hide) · Administrators · Applications (approve/reject) · Data & Live Metrics (**Excel/CSV import**) · Board · News · Gallery · **Messages & Inquiries** (business tabs + Unread/Read/Replied + **Reply**) · **Businesses & Services** (Edit/Add + Services(N) badge → services tab) · Fuel Prices · **System Settings**

### ⚙️ System Settings වලින් වෙනස් කරන්න පුළුවන්
- WhatsApp අංකය (password recovery) · Years of Service · FormSubmit emails
- **Hero Background Images** — ⬆ **Upload Image** (Supabase Storage) · 🗑️ delete (storage එකෙනුත් මකයි) · ↑ ↓ order · උපරිම 10

---

## 📁 ව්‍යුහය

```
coop-web/
├── supabase/
│   └── schema.sql        ★ එකම SQL file එක (schema + සියලු දත්ත + image storage)
├── src/
│   ├── app/              pages (public + membership + admin 13)
│   ├── components/       header, footer, hero slideshow, tables, admin UI
│   └── lib/
│       ├── seed.ts       screenshot දත්ත (fallback)
│       ├── directory-rows.ts  52,964 + 2,359 rows (client-side generate)
│       ├── i18n.tsx      සිංහල/English dictionary
│       ├── auth.ts       NIC login logic
│       └── supabase/     client, server, storage (upload/delete)
├── public/images/hero/   hero-1.jpg … hero-5.jpg
├── DEPLOY_STEPS.md       සිංහල deploy මාර්ගෝපදේශය (විස්තරාත්මක)
└── README.md             (මේ file එක)
```

---

## 🗄️ Database — එකම SQL file එක

**`supabase/schema.sql`** — මෙහි ඔක්කොම ඇතුළත්:
- Tables 17ක් (`profiles`, `business_units`, `board_members`, `news`, `gallery_items`, `messages`, `membership_applications`, `member_rows`, `voter_rows`, `fuel_prices`, `system_settings` …)
- `login_lookup` view (NIC login) + `protect_role_change` trigger
- **Panduwasnuwara දත්ත පමණයි** (පැරණි සමිති දත්ත නැත) · superadmin ගිණුම
- Image storage bucket (`site-images`) + admin upload/delete policies

**Run කරන විදිහ:** Supabase Dashboard → **SQL Editor** → New query → `schema.sql` file එකේ මුළු අන්තර්ගතයම paste කර **Run**. නැවත run කිරීම ආරක්ෂිතයි.

### 🔑 Login අක්කරණ

| භූමිකාව | NIC | Password |
|---|---|---|
| Superadmin | `SUPERADMIN` | `Admin@123` |
| Admin | `ITKWEB` | `Kenula@123` |

---

## 🌍 Publish කිරීම (GitHub → Vercel)

1. **Supabase** — උඩ SQL file එක Run කරන්න → Authentication → Email → "Confirm email" **OFF** → Settings → API වලින් **URL** + **anon key** copy
2. **GitHub** — repo එකට push (⚠️ `.env.local` **කවදාවත් push කරන්න එපා**):
   ```bash
   git add .
   git commit -m "Panduwasnuwara MPCS website"
   git push -u origin main
   ```
3. **Vercel** — Add New → Project → repo එක Import → Environment Variables දෙක දාන්න:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   → **Deploy** → ඉවරයි 🎉
4. **FormSubmit** — `/contact` එකෙන් test පණිවුඩයක් යවන්න → inbox එකේ **"Activate Form"** link එක click (එක වතාවක්)
5. **Login** — `SUPERADMIN / Admin@123` වලින් `/admin` එකට

> 📖 පියවරෙන් පියවර විස්තර **`DEPLOY_STEPS.md`** එකේ ඇත.

---

## 🔧 ගැටලු ආවොත්

| ගැටලුව | විසඳුම |
|---|---|
| "Supabase වින්‍යාස වී නොමැත" | `.env.local` / Vercel env vars බලා `npm run dev` නැවත අරින්න (Vercel නම් redeploy) |
| Login වෙන්නේ නෑ | NIC එක නිවැරදිද බලන්න · Supabase → Authentication → Users එකේ ගිණුම තියෙනවද? |
| `/admin` යන්න බෑ | admin / superadmin role එකක් අවශ්‍යයි · login වීම අනිවාර්යයි |
| SQL Editor එකේ role error | trigger එක නිසායි — මුලින් SQL එකෙන් දාලා, පස්සේ admin UI එකෙන් වෙනස් කරන්න |
| Password අමතක | SQL එකෙන් reset: `update auth.users set encrypted_password = extensions.crypt('නවpassword', extensions.gen_salt('bf')) where email = 'nic@members.mpcs.lk';` |

---

## 📝 සටහන්

- පරිපාලක වෙනස්කම් demo mode එකේ (Supabase නැතිව) සුරැකෙන්නේ නෑ — SQL run කළාට පස්සේ live වේ
- Hero images upload කිරීමට Supabase අවශ්‍යයි (Storage) — නැතිව නම් path/URL input එක භාවිතා කරන්න
- member logic පසුව එකතු කිරීමට සැලසුම් කර ඇත

---

**Designed By Induwara Thathsara**  
පඳුවස්නුවර නව බහු අරමුණු සමූපකාර සමිතිය · Panduwasnuwara New MPCS LTD
