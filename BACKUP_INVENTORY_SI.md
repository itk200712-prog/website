# Backup / Import සම්පූර්ණතා පරීක්ෂාව

## නිවැරදි කළ දේ

- Director Board photos ඇතුළු `site-images` ගොනු **URL පමණක් නොව සැබෑ bytes සමඟ** SQL backup එකට ඇතුළත් වේ. සාමාන්‍ය ZIP එකක `media/board/…` යටතේ Board photo files ද වෙනම දැකිය හැක.
- Public URL, signed/authenticated URL, URL-encoded නාම, nested objects/arrays සහ JSON ලෙස ගබඩා කළ settings වල image references හඳුනාගනී. වෙනත් project එකකට restore කළ විට ඒවා අලුත් ගොනු URL වෙත මාරු කරයි.
- Board photo වැනි external media URL එකක් තිබුණොත් එහි ගොනුවත් capture කරයි. සාමාන්‍ය website/social links සියල්ල download කිරීමට උත්සාහ නොකරයි.
- Storage listing එකේ පෙර තිබුණු folders 6 / files 10,000 සීමාවෙන් නිහඬව ගොනු මඟහැරීම ඉවත් කර ඇත. Coverage counter හි files 5,000 සීමාවත් ඉවත් කර ඇත. ආරක්ෂිත nesting සීමාව ඉක්මවුවහොත් error එකක් පෙන්වයි; සම්පූර්ණ බව නොකියයි.
- පැරණි `site_images_backup` cache rows අලුත් image bytes නැවත overwrite කිරීම නවතා ඇත. පැරණි SQL backup එකක duplicate cache inserts තිබුණොත් මුලින් තිබෙන fresh image block එකට ප්‍රමුඛත්වය දෙයි.
- Table, file, public asset, canonical schema හෝ source snapshot එකක් ලබාගත නොහැකි නම් **full backup එක අසාර්ථක බව පෙන්වයි**. Missing files නිහඬව අත්හරින්නේ නැත.
- Board table එක පමණක් තෝරා restore කළත් අවශ්‍ය photos ස්වයංක්‍රීයව restore වේ.
- Image upload හෝ referenced-file පරීක්ෂාව අසාර්ථක නම් database tables මකා නැවත පිරවීම ආරම්භ නොකරයි. Storage uploads කිහිපයක් ඊට පෙර සිදුවී තිබිය හැක; මෙය transaction එකක් නොවේ.
- Backup වෙලාවේ හිස්ව තිබුණු News/Gallery වැනි tables ද හිස් තත්ත්වයට restore වේ. එම නිසා පසුව ඉතිරි වූ පැරණි posts නැවත පෙන්වන්නේ නැත.
- Gallery replies වල parent comment එක UUID අනුපිළිවෙළින් පසුව තිබුණත්, parents මුලින් restore කරයි. Missing parents පරීක්ෂාව table deletion එකට පෙර සිදු වේ.
- ZIP manifest එකේ සඳහන් **සෑම file එකකම** තිබීම, size හා SHA-256 hash import preview එකට පෙර පරීක්ෂා කරයි. Corrupt/missing files ඇති ZIP එකක් restore කිරීමට ඉඩ නොදේ.
- Restore verification එක දැන් 52,013 expected rows වෙනුවට row එකක් තිබීම “හරි” ලෙස පිළිගන්නේ නැත. Replace කරන tables වල exact counts සසඳයි. ආරක්ෂාවට merge කරන profiles/secrets සහ history retention වෙනම සලකයි.
- Canonical `supabase/schema.sql` එකට එකතු කරන supported tables/primary keys build වෙලාවේ catalog එකට එකතු වේ. FK dependencies අනුව import order සැකසේ. Unsupported composite keys හෝ cross-table cyclic dependencies තිබුණොත් build එක නවතා දැනුම් දෙයි; table එක නිහඬව අතහැරෙන්නේ නැත.
- Source snapshot එකට package files සහ build generator ඇතුළත් කර ඇත. Backup helper APIs superadmin හෝ නිවැරදි cron secret එකට පමණක් සීමා කර ඇත.

මෙම code gaps තහවුරු කර නිවැරදි කර ඇත. Live production එකේ Board photos මඟහැරුණු නිශ්චිත සිදුවීම/හේතුව remote inspection එකකින් තහවුරු කර නැත.

## Backup එකට ඇතුළත් database tables — දැනට 29

| කොටස | ඇතුළත් tables / දත්ත |
|---|---|
| Users / admins | `profiles` — නම, NIC, contact details, roles, profile fields, ගබඩා කර තිබෙන login-recovery fields |
| අවසර | `special_download_access` — Download With Special අවසර; අනෙකුත් app permission/settings fields ද ඒවා තිබෙන rows තුළ |
| Site settings | `system_settings` — notices, visibility toggles, WhatsApp/contact options, theme/animation/hero/chat settings, schedules, email configuration සහ එහි ගබඩා කර ඇති අනෙකුත් values |
| රහස් | `backup_secrets` — app එක මෙහි ගබඩා කරන API/SMTP/MEGA/backup passwords, cron/encryption values සහ backup-mail retry/outbox state |
| සාමාජික / ඡන්ද හිමි | `member_rows`, `voter_rows` — සියලු columns හා rows; `data_files` — file names/count metadata; `data_imports` — import history |
| අයදුම්පත් | `membership_applications` |
| අධ්‍යක්ෂ මණ්ඩලය | `board_members` — සියලු විස්තර හා photo references; photo file bytes ද media backup එකේ ඇත |
| ව්‍යාපාර / ශාඛා | `business_units`, `business_services`, `business_contacts`, `business_branches` |
| News / Gallery | `news`, `gallery_items`, `gallery_comments` — posts, media references, comments/replies සහ ගබඩා කර ඇති metrics |
| ඉන්ධන | `fuel_prices`, `fuel_stock` |
| Messages / notifications | `messages`, `notify_emails` |
| F28 | `f28_members`, `f28_items` |
| Chat | `chat_sessions`, `chat_messages`, `live_chat_events` |
| Logs / backup metadata | `admin_activity_logs`, `backup_history`, `site_images_backup` — image archive rows අලුත් ගොනු capture එකෙන් නැවත සකසයි |

`select("*")` නිසා මේ tables වල අලුතින් එකතු කරන columns ද backup වේ. Managed schema එකට පිටින් අතින් හදන arbitrary database objects මෙම app catalog එකට ස්වයංක්‍රීයව හඳුනාගන්නේ නැත.

## Images / ගොනු

- `site-images` bucket එකේ සියලු listed files, භාවිත වන folder එක කුමක් වුවත්: Board, profile/member/application photos, news/gallery/business/hero/bot images වැනි upload කළ අන්තර්ගතය.
- `public/` manifest එකේ සියලු site assets: icons, images, fonts ආදිය. දැන් ගොනු **39ක්**; build වෙලාවේ නව public assets ස්වයංක්‍රීයව එකතු වේ. Public source/source-map files සඳහා ආරක්ෂිත exclusions අදාළ වේ.
- App data තුළ හඳුනාගත් media/file references. External files සඳහා public HTTP(S) access අවශ්‍යය; 32 MiB/file, timeout සහ SSRF ආරක්ෂිත සීමා අදාළ වේ. Blocked/expired/login-required/unreachable file එකක් තිබුණොත් backup එක නවතා error එකක් පෙන්වයි—එය `site-images` වෙත නැවත upload කර retry කරන්න.
- වෙනත් Supabase buckets වල referenced files තිබුණොත් capture කරයි. Restore කළ යුතු project එකේ අදාළ buckets/access policies මුලින් සකස් කර තිබිය යුතුය. ඒ files public `site-images` bucket එකට දමා private data public නොකරයි. එවැනි private-bucket references සඳහා සාදන signed URL පැයකින් expire වේ; භාවිත කරන app එකට එය නැවත සාදාගැනීමේ ක්‍රමය අවශ්‍යය. දැනට app එකේ සාමාන්‍ය uploads භාවිත කරන්නේ public `site-images` bucket එකයි; ඒවාට මේ පැයක සීමාව නැත.
- Inline `data:` image එකක bytes දැනටමත් row එකේ තිබෙන නිසා එයත් SQL තුළ රැකේ. `blob:` / `file:` වැනි තාවකාලික photo reference එකක් නම් නැවත upload කළ යුතු බව දන්වයි.

## ZIP ගොනු ලැයිස්තුව

| ZIP entry | අන්තර්ගතය |
|---|---|
| `schema.sql` | Canonical tables, app functions/RPC, RLS, triggers සහ schema එකේ සඳහන් storage setup |
| `database.sql` | App table data, media bytes (base64), media reference mapping, empty-table metadata සහ login-recovery SQL |
| `media/…` | Uploaded/referenced media වල binary පිටපත්; සාමාන්‍ය backup එකේ Board photos `media/board/…`. External Board photos `media/referenced-media/…`. Encrypted mode හි මේ plain copies නොදමයි; bytes encrypted SQL එකේ තිබේ |
| `site-assets/public/…` | Public icons/images/fonts ආදිය |
| `site-source/…` | Capture කළ app/frontend/API source, CSS/cursor/components, config/package/build files; actual environment secrets සහ generated/dependency directories නොමැත |
| `Members-Register.xlsx`, `Voters-Register.xlsx` | Export කළ DB snapshot එකෙන් නැවත සාදන registers |
| `Members-Register.csv`, `Voters-Register.csv` | එම snapshot එකේ UTF-8 CSV registers |
| `manifest.json` | Version/date, table/file counts, sizes හා SHA-256 hashes |
| `README.txt`, `RECOVERY.txt` | Inventory, recovery පියවර සහ සීමා |

## වැදගත් සීමා — “මුළු Supabase/Vercel account එකේ clone එකක්” නොවේ

1. **මුල් Excel workbook bytes:** මේ app එක සාමාන්‍ය import එකේ workbook එක නොව rows සහ file metadata ගබඩා කරයි. ඒ නිසා මුල් formatting, macros, formulas, hidden sheets නැවත සාදන්න බැහැ. Backup XLSX/CSV යනු ගබඩා කළ registers data වලින් නැවත සාදන files. වෙනම ගබඩා කළ referenced original workbook එකක් ඇත්නම් media capture යටතේ එය ලබාගැනීමට උත්සාහ කරයි.
2. **Supabase Auth:** Profiles/permissions හා තිබෙන email/password recovery fields ඇතුළත් වේ. `auth.users` සම්පූර්ණ raw dump එකක්, existing password hashes, MFA secrets, OAuth identities/provider state හෝ sessions නොවේ. Fresh-project recovery SQL සඳහා `auth_email` සහ `password_display` තිබිය යුතුය. නැති ගිණුම් invite/reset/reconcile කළ යුතුය. සාමාන්‍ය browser Import එක auth accounts නැවත නිර්මාණය කරන්නේ හෝ existing accounts මකන්නේ නැත.
3. **Hosting / external services:** Vercel environment values, Supabase service-role/anon keys, DNS/domain/SSL configuration, mail-provider account, GitHub credentials, provider-side config හා logs ස්වයංක්‍රීයව export/import නොවේ. App එකේ DB තුළ ගබඩා කළ configuration පමණක් table backup එකෙන් ආපසු ලැබේ.
4. **අනෙකුත් buckets:** Referenced නොවන arbitrary buckets, old backup ZIP copies සහ MEGA ගබඩාව සම්පූර්ණයෙන් nested backup නොකරයි. එය recursive backup growth වැළැක්වීමටත් අවශ්‍යය.
5. **Code / schema deploy:** Browser Import එක deployed source code, SQL schema/functions/policies හෝ environment settings ස්වයංක්‍රීයව apply නොකරයි. Fresh project එකකට canonical schema run කර source නැවත deploy කළ යුතුය. ZIP source එකෙන් repo එක ගොඩනගන්නේ නම් root `schema.sql` එක `supabase/schema.sql` ලෙසත් තබන්න; `site-source/` project root වෙතත් `site-assets/public/` public folder වෙතත් copy කර dependencies install/build කරන්න.
6. **Encryption:** Checkbox එක encrypt කරන්නේ `database.sql` එකයි; uploaded media ද ඒ තුළ ආරක්ෂා වේ. Excel/CSV, canonical schema, source හා public assets එයින් encrypt නොවේ. **මුළු ZIP එකම රහසිගතව තබන්න**; transport/storage encryption ද භාවිත කරන්න.
7. **Snapshot / rollback:** මෙය single database transaction/PITR snapshot එකක් හෝ atomic restore එකක් නොවේ. Export වෙලාවේ bulk edits/imports නවතා තැබීම හොඳය. Restore වෙලාවේ error එකක් ආවොත් සමහර storage writes හෝ කලින් tables වෙනස් වී තිබිය හැක. Safety ZIP එක තබාගන්න.
8. **පැරණි backup:** ඒ ZIP එකට නොගත් photo bytes නව code එකෙන් මවාගත නොහැක. File එක තවම live storage එකේ තිබෙන විට **update පසු අලුත් backup එකක් ගන්න**. Missing old files නැවත upload කිරීමට සිදුවිය හැක.

## භාවිත කරන පිළිවෙළ

1. Code deploy වීමෙන් පසු superadmin ලෙස Admin → Backup & Restore විවෘත කරන්න.
2. අලුත් Full ZIP එකක් ගන්න. Unencrypted ZIP නම් `media/board/` හෝ external photos සඳහා `media/referenced-media/` බලන්න. Encrypted නම් image bytes SQL තුළ තිබෙන නිසා plain media folder එකක් නොමැති වීම සාමාන්‍යය.
3. Restore rehearsal එක production වෙනුවට staging/test project එකක කරන්න. Canonical schema/setup, accounts සහ bucket access නිවැරදිව සකස් කරන්න.
4. Import Preview/manifest verification බලන්න. Safety backup එක තෝරා තබාගෙන අවශ්‍ය tables/RESTORE confirm කරන්න. Errors/verification warnings නැති බවත් Board photos/public pages පෙනෙන බවත් බලන්න.
5. Manual සහ scheduled backups දෙකම එකම builder එක භාවිත කරයි. පෙර SMTP immediate-report/retry behavior, one backup-recipient configuration, next-hour scheduling සහ actual ZIP-byte size reporting වෙනස් කර නැත. Old installed cron HTTP-timeout migration එක කලින් කර නැත්නම් එම වෙනම deployment උපදෙස් තවමත් අදාළය.

## පරීක්ෂණ සටහන්

- Isolated fixtures මත full engine export/import, exact photo bytes, 52,013 rows, signed/relative/external/nested URL rewrite, deep/10,000+ storage pagination, private bucket handling, empty tables, Gallery reply dependencies, failures, ZIP hashes, encryption සහ future schema discovery පරීක්ෂා කරයි.
- මේවා live production restore, production storage completeness හෝ SMTP inbox receipt තහවුරු කිරීමක් නොවේ.
- Dependency audit එකේ existing Next/PostCSS/Nodemailer/SheetJS advisory reports තවම තිබේ. මෙම backup patch එක full dependency-security upgrade හෝ penetration-test certification එකක් නොවේ; ඒ සඳහා වෙනම compatibility/security remediation අවශ්‍යය.

### අවසන් local verification

- Regression suite: **409 passed, 0 failed**.
- Backup/media behavioral suite: **46 passed**.
- SMTP/retry behavioral suite: **33 passed**.
- Production Next.js build: **passed**.
- `npm test` දැන් source metadata නැවත generate කර suites තුනම ධාවනය කරයි.
- ඉහත ප්‍රතිඵල local/mocked පරීක්ෂණ වලට පමණි; deployed production හෝ real inbox තහවුරු කිරීමක් නොවේ.
