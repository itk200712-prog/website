# 🔐 Security Policy — Panduwasnuwara New MPCS

මේ ලේඛනයේ තියෙන දේවල් **හැම අලුත් update එකකදීම රැකෙන්න ඕනේ**. `scripts/test.mts` එකේ
ඒවා අල්ලන **regression tests** තියෙනවා — ඒවා fail වුණොත් deploy කරන්න එපා.

## HTTP Security Headers (pentestnet report — 07 Nov 2026)

`next.config.ts` → `headers()` එකෙන් හැම route එකකටම set වේ.
**හැර `Content-Security-Policy` එකට** — ඒක `src/middleware.ts` එකේදී **හැම request එකකටම අලුත් nonce එකක්
සමඟ** හැදේ (එකම header එක දෙපැත්තෙන් යැව්වොත් browser එක headers දෙක intersect කරන නිසා nonce එක
reject වේ → **CSP එක next.config.ts එකට ආපහු දාන්න එපා**).

| Header | Value | තත්ත්වය |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'` · **`script-src 'self' 'nonce-…' 'strict-dynamic'`** (`unsafe-inline` **නෑ**) · `style-src 'self' 'unsafe-inline'` · `connect-src` Supabase විතරයි · `object-src 'none'` · `base-uri 'self'` · `frame-ancestors 'self'` | ✅ |
| `X-Frame-Options` | `SAMEORIGIN` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | හැම feature එකක්ම `()` — `geolocation=(), microphone=(), camera=(), payment=(), usb=(), …` (`src/lib/permissions-policy.ts` → middleware). කිසිම origin එකකට (self ටත්) අවසර නෑ. **pentestnet warning එක false positive — පහළ බලන්න** | ✅ |
| `Cross-Origin-Opener-Policy` | `same-origin` | ✅ |
| `X-Powered-By` | **ඉවත්** (`poweredByHeader: false`) | ✅ |
| `Strict-Transport-Security` | Vercel auto (`max-age=63072000; includeSubDomains; preload`) | ✅ |

**රන්න එපා:** `default-src *`, `script-src 'unsafe-inline'`, `script-src 'unsafe-eval'` (production), `frame-ancestors *`,
`Permissions-Policy` එකේ `(self)` හෝ `*` (scan එකට ඒක "specific origin" නෙවෙයි).
`script-src` එකේ `'unsafe-inline'` දැම්මොත් pentest report එකේ **warning** එකක් එනවා වගේම nonce එකත්
නිෂ්ඵල වේ. Nonce එක `x-nonce` request header එකෙන් server components වලට ලැබේ.
`unsafe-eval` දාන්නේ development එකේදී විතරයි (`NODE_ENV !== "production"`).

## ⚠ pentestnet "permissions-policy" warning — false positive (සාක්ෂි සහිතව)

scan එකේ එන *"Privacy-sensitive feature 'X' is not restricted to specific origins"* note එක
**අපේ header එකේ වැරැද්දක් නෙවෙයි** — pentestnet ගේ parser එක header එකේ **පළවෙනි directive එක විතරයි**
කියවනවා. එකම header එකේ order එක විතරක් වෙනස් කරලා තමයි මේක ඔප්පු කළේ (production එකේම scan කරලා):

| Production header (එකම syntax, එකම values) | scan එකේ note වුණේ | "Pass" වුණේ |
|---|---|---|
| `camera=(…) first, microphone=(…) second, …` | geolocation, microphone, payment | **camera** (1st) |
| `geolocation=(…) first, microphone=(…) second, …` | camera, microphone, payment | **geolocation** (1st) |
| `geolocation=(), microphone=(), camera=(), …` | camera, microphone, payment | **geolocation** (1st) |

`()`, `(self)`, `("https://<site>")` — මේ **තුනම** එකම warning එක දුන්නා. ඒ කියන්නේ
feature එකේ value එක කියවන්නේ නෑ; header එකේ **පළමු එක විතරයි** කියවනවා.

තහවුරු කිරීමක්: **cloudflare.com** (`geolocation=(), camera=(), microphone=()`) ටත් එකම warning
එකම එනවා — note වෙන්නේ `camera, microphone, payment` (එයාගේ පළවෙනි එක `geolocation` නිසා ඒක pass).

**ඒ නිසා:** කවදාවත් මේ warning එක නිසා `*` දාන්න එපා. අපේ header එක spec-compliant (MDN/W3C) සහ
උපරිම ආරක්ෂිත (`()` = deny all). Pentestnet support එකට මේ වගුව යවන්න පුළුවන්; නැත්නම්
securityheaders.com / Mozilla Observatory වලින් cross-check කරන්න.

## Well-known files

- `/robots.txt` — `src/app/robots.ts` (admin/api/dashboard disallow, sitemap link)
- `/sitemap.xml` — `src/app/sitemap.ts`
- `/.well-known/security.txt` — RFC 9116 (`src/app/.well-known/security.txt/route.ts`)
- ⚠ මේවා middleware එකේ `ROOT_FILES` list එකේ තියෙන්න ඕනේ — නැත්නම් `/en/robots.txt` වලට redirect වෙලා pentest එකේ "Not found" වෙනවා.

## Secrets — කවදාවත් client bundle එකට යන්න එපා

- `supabase/schema.sql` **server-only** (`/api/backup/schema` — admin/superadmin හෝ cron secret)
- Seed/default passwords placeholders විතරයි
- `SUPABASE_SERVICE_ROLE_KEY`, Gemini key, `backup_secrets` — server පමණයි
- පරීක්ෂාව: `npm run build` → `grep -r "MPCS@\|Admin@123" .next/static` → **0** විය යුතුයි

## API routes

| Route | Auth |
|---|---|
| `POST /api/scheduled-backup` | `x-backup-secret` = `backup_secrets.backup_cron_secret` |
| `GET /api/backup/schema` | Bearer (admin/superadmin) **හෝ** `x-backup-secret` |
| `POST /api/admin-reset-password` | same-origin + rate-limit + Bearer + role checks (root superadmin පමණයි admin ගේ password) |
| `POST /api/baymax-ai` | origin check + rate-limit + server-side key |

## Data (RLS)

- `profiles`, `backup_secrets`, `backup_history`, `special_download_access`, `admin_activity_logs`,
  `messages`, `membership_applications`, `f28_members`, `fuel_stock` → anon අයට කියවන්න බෑ ✅
- `member_rows` / `system_settings` → public read (site එකේ list/settings) — NIC public පෙන්වන නිසා.
  අවශ්‍ය නම් column-level restriction එකක් දාන්න පුළුවන්.
- `register_counts()` → `security invoker` (RLS apply වේ) + `grant execute to anon, authenticated`

## Update කරද්දී run කරන්න

```bash
npm run gen:site-source     # snapshot
npx tsx scripts/test.mts    # 354 tests — security regression ඇතුළුව
npm run build               # tsc + lint + prerender
```

යම් test එකක් security එකට සම්බන්ධ නම් (`security:`, `backup:`, `counts:`, `excel import:`) — ඒක fix කරලාම deploy කරන්න.
