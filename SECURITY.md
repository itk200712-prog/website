# 🔐 Security Policy — Panduwasnuwara New MPCS

මේ ලේඛනයේ තියෙන දේවල් **හැම අලුත් update එකකදීම රැකෙන්න ඕනේ**. `scripts/test.mts` එකේ
ඒවා අල්ලන **regression tests** තියෙනවා — ඒවා fail වුණොත් deploy කරන්න එපා.

## HTTP Security Headers (pentestnet report — 07 Nov 2026)

`next.config.ts` → `headers()` එකෙන් හැම route එකකටම set වේ:

| Header | Value | තත්ත්වය |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'` · script/style `'unsafe-inline'` (Next app-router) · `connect-src` Supabase විතරයි · `object-src 'none'` · `frame-ancestors 'self'` | ✅ |
| `X-Frame-Options` | `SAMEORIGIN` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), …` | ✅ |
| `Cross-Origin-Opener-Policy` | `same-origin` | ✅ |
| `X-Powered-By` | **ඉවත්** (`poweredByHeader: false`) | ✅ |
| `Strict-Transport-Security` | Vercel auto (`max-age=63072000; includeSubDomains; preload`) | ✅ |

**රන්න එපා:** `default-src *`, `script-src 'unsafe-eval'` (production), `frame-ancestors *`.
`unsafe-eval` දාන්නේ development එකේදී විතරයි (`NODE_ENV !== "production"`).

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
