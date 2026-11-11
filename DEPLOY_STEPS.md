# 🚀 Deploy මාර්ගෝපදේශය (සිංහලෙන් — පියවරෙන් පියවර)

පඳුවස්නුවර නව බහු අරමුණු සමූපකාර සමිති වෙබ් අඩවිය — GitHub → Vercel + Supabase.

---

## පියවර 1 — Supabase දත්ත සමුදාය

1. https://supabase.com → sign in → **New Project** (හෝ දැනට ඇති project එක භාවිතා කරන්න — ref: `gdablxopbyzyqdyphtib`)
2. වම් පස **SQL Editor** → **New query**
3. **`supabase/schema.sql`** file එකේ මුළු අන්තර්ගතයම copy කර paste කර **Run** කරන්න
   (එකම SQL file එකයි — tables + සියලු දත්ත + image storage ඔක්කොම ඇතුළත්)
4. **Authentication → Providers → Email** → "Confirm email" **OFF** කරන්න (NIC login සඳහා අවශ්‍යයි)
5. **Settings → API** වලින් මේ දෙක copy කරගන්න:
   - Project URL
   - anon public key

## පියවර 2 — පිවිසුම් පරීක්ෂා කිරීම

සමිතියේ වෙබ් අඩවිය හරහා `/signin` පිටුවට ගොස්:

| භූමිකාව | NIC | Password |
|---|---|---|
| Superadmin | `SUPERADMIN` | `Admin@123` |
| Admin | `ITKWEB` | `Kenula@123` |

පිවිසුම් වීමෙන් පසු `/admin` පිටුවට යන්න.

> **සටහන:** SQL Editor එකෙන් role වෙනස් කරන විට `ERROR P0001: Only administrators can change role or status` ආවොත් — protect_role_change() trigger එක නිසා. `update profiles set role='admin' where nic='ITKWEB';` වැනි වෙනස්කම් මුලින් SQL එකෙන් කර, ඊට පස්සේ Superadmin ලෙස ලොග් වී Admin Console එකෙන් වෙනස් කරන්න.

## පියවර 3 — GitHub එකට push කිරීම

```bash
cd coop-web
git init   (දැනටමත් repo නම් අවශ්‍ය නෑ)
git add .
git commit -m "Panduwasnuwara MPCS website"
git remote add origin https://github.com/ඔබේ-username/ඔබේ-repo.git
git push -u origin main
```

⚠️ **`.env.local` GitHub එකට යන්නේ නැති බවට වග බලා ගන්න** (`.gitignore` එකේ ඇත). වැරදීමකින් push වුණොත් Supabase → Settings → API → **Rotate keys**.

## පියවර 4 — Vercel එකට deploy කිරීම

1. https://vercel.com → **Add New → Project**
2. GitHub repo එක තෝරන්න → **Import**
3. **Environment Variables** එකේ මේ දෙක එකතු කරන්න:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL (පියවර 1)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key (පියවර 1)
4. **Deploy** ඔබන්න
5. Deploy වූ පසු https://ඔබේ-වෙබ්-අඩවිය.vercel.app ලිපිනයෙන් පිවිසෙන්න

## පියවර 5 — Hero Background Images (upload/delete)

**Admin → System Settings → Hero Background Images** එකෙන්:
- **⬆ Upload Image** — ඔබේ computer එකෙන් image එකක් ඇතුළත් කරන්න (Supabase Storage එකට upload වේ)
- 🗑️ delete කළ විට upload කළ image එක storage එකෙනුත් ඉවත් වේ
- ↑ ↓ පිළිවෙල වෙනස් කරන්න · උපරිම images 10ක් · **Save Settings** ඔබන්න

## පියවර 6 — SMTP ONLY email සැකසීම

1. යවන Gmail ගිණුමේ Google Account → Security → **2-Step Verification ON**.
2. https://myaccount.google.com/apppasswords → app name `MPCS Website` → Create → අකුරු 16ක App Password copy කරන්න. සාමාන්‍ය Gmail password එක භාවිත නොකරන්න; App Password chat එකක share නොකරන්න.
3. **Admin → Emails → Mail Server (SMTP)** පුරවන්න:
   - Gmail address = යවන Gmail එක
   - App Password = ඉහත ලබාගත් එක
   - From name = `Panduwasnuwara MPCS`
   - Host = `smtp.gmail.com`
   - Port = `465` (TLS); `587` නම් STARTTLS භාවිත වේ
   - From email = යවන Gmail එකම
4. **SMTP සුරකින්න**. Blank password එකෙන් දැනට saved password මැකෙන්නේ නෑ. Password එක server-side `backup_secrets` තුළයි; GET response එකෙන් password එවන්නේ නෑ. Full backup/export/import එකට ඇතුළත්.
5. **SMTP Test — saved settings** → Inbox / Spam / All Mail බලන්න. වෙනත් test recipient ලිපිනයක් දාන්නත් පුළුවන්.
6. එක් එක් කාරණාවේ card එකේ ලැබිය යුතු ලිපින දාලා **Save → Test**. Recipient email සඳහා වෙනම SMTP accounts/passwords/keys අවශ්‍ය නැහැ. එක sender account එකෙන් යවයි. Card එකකට උපරිම ලිපින 10යි. ලිපින 7කට ඕන නම් එම card එකේ තවත් ලිපිනයක් ඔබමින් 7ම දාලා Save කරන්න. එක් එක් recipient එක වෙනම SMTP message එකක් ලබයි; අනෙක් recipients ලැයිස්තුව නොපෙන්වයි.
7. **Auto Backup Reports** card එකේ recipients Save → Admin → Backup → test run → History බලන්න. Actual ZIP size = final compressed bytes. උදා: `36.7 MB (36,700,000 bytes)`; ZIP එක email attachment නොවේ.

**SMTP පමණයි:** provider selector, access-key forms සහ වෙනත් mail services/fallback නැහැ. SMTP නැත්නම් / auth error / recipient rejection නම් error පෙන්වයි. එක recipient fail වුණත් අනෙක් ලිපිනවල send දිගටම සිදුවේ. Form data/Admin messages වෙනම සුරැකේ.

SMTP Save කළ විට පරණ භාවිත නොවන mail-provider රහස් rows පමණක් cleanup වේ; SMTP credentials, routes සහ වෙනත් රහස් මැකෙන්නේ නෑ. නව SQL run කිරීමක් අවශ්‍ය නැහැ. පරණ backup එකක් restore කළත් retired settings email යැවීමට භාවිත වෙන්නේ නෑ.

**Server accepted ≠ inbox delivered.** Instant delivery සහතික කළ නොහැක. Inbox/Spam පරීක්ෂා කරන්න; authentication error නම් App Password නැවත සාදන්න.

## පියවර 7 — WhatsApp Password Recovery

Admin → System Settings → **Password Reset WhatsApp Number** → `94742352670` (දැනටමත් ඇත).
"Forgot Password?" click කළ විට member කෙනෙකුගේ විස්තර සමඟ WhatsApp message එකක් මෙම අංකයට සැකසේ.

---

## නිතර අසන ප්‍රශ්න

**"Supabase වින්‍යාස වී නොමැත" යැයි පෙන්වයි නම්:**
`.env.local` එකේ keys ඇතිද බලා `npm run dev` නැවත අරින්න (browser Ctrl+Shift+R). Vercel එකේ නම් Environment Variables නැවත බලා redeploy කරන්න.

**password එකෙන් පිවිසිය නොහැකි නම්:** NIC එක නිවැරදිද? Supabase → Authentication → Users එකේ user ඉන්නවද? ඉන්නවා නම් SQL එකෙන්:
```sql
update auth.users set encrypted_password = extensions.crypt('නවpassword', extensions.gen_salt('bf'))
where email = 'nic@members.mpcs.lk';
```

**admin පිටුවට යන්න බැරි නම්:** Middleware එකෙන් admin/superadmin පමණයි ඇතුළු වෙන්නේ. පිවිසීමෙන් පස්සේ role එක `admin` හෝ `superadmin` දැයි බලන්න.

## 💾 Backup එකේ **සියල්ලම** තියෙනවද කියා බලන විදිහ

Admin → **Backup & Restore** → උඩම තියෙන **📋 Backup Coverage — සියල්ල ඇතුළත්ද?** card එකේ
**"දැන් පරීක්ෂා කරන්න"** button එක ඔබන්න. එතකොට මේවා ගණන් කරලා පෙන්වයි:

| කාණ්ඩය | ඇතුළත් දේ |
|---|---|
| 👤 ගිණුම් · Admin · රහස් | Admin/සාමාජික login ගිණුම් (password සමඟ), roles, backup රහස්, site settings |
| 📊 සාමාජික · ඡන්ද හිමි · Excel | member_rows / voter_rows (52,000+), Members/Voters-Register.xlsx, applications, F28 |
| 🖼️ Images · Files · Design | Storage bucket එකේ හැම image එකක්ම, public/ icons/images/fonts, site design source files |
| 🌐 Site අන්තර්ගතය | Board members, businesses, news, gallery, fuel prices, notify emails |
| 💬 සන්නිවේදනය · Logs | messages, live chat, activity logs, backup history |

හරිත ✅ = දත්ත තියෙනවා · කහ ⚠ = හිස් (ඒක වැරැද්දක් නොවේ) · රතු ✗ = ගණන් ගන්න බැරි වුණා.

> 🔁 **හැම අලුත් update එකක්ම backup එකට අපේම එකතු වේ** — `src/` එකේ අලුතෙන් හදන
> file එකක් හෝ `public/` එකට දාන icon/image/font එකක් වුණත් `npm run build` එකේදී
> self-regenerate වෙනවා. (`scripts/test.mts` එකේ test 2කින් ඒක සෑම build එකකදීම තහවුරු කරයි.)

---

Designed By Induwara Thathsara · පඳුවස්නුවර නව බහු අරමුණු සමූපකාර සමිතිය

---

## 🔄 Update එකක් ආවම (GitHub → Vercel)
> මම (AI එක) update එකක් හදලා commit කළාම, ඔයාගේ site එකට (GitHub → Vercel) යන විදිහ.

---

### 🅰️ හැඩය A — සරලම ක්‍රමය (නිර්දේශිත ✅)

**ඔයා කිසිවක් කරන්න ඕන නෑ!** මට කියන්න "update එක push කරන්න" කියලා —
මම මෙතන ඉඳන්ම GitHub repo එකට push කරන්නම් → **Vercel එක auto deploy වෙනවා** 🚀

ඊළඟ වතාවට token එකක් ඕන වෙනවා:
1. github.com → Settings → Developer settings → **Personal access tokens → Tokens (classic)**
2. **Generate new token** → ✅ **repo** tick → Generate → `ghp_...` copy
3. මට එවන්න (මම push කරලා කියන්නම් — ඉවරයි!)
4. ⚠️ දවසකට පස්සේ github.com එකේ ගිහින් ඒ token එක **Delete** කරන්න (ආරක්ෂාවට)

---

### 🅱️ හැඩය B — ඔයාම Push කරනවා නම්

#### 1️⃣ අලුත් code එක ගන්න
1. **Arena එකෙන් workspace එක නැවත Download කරන්න**
2. Download එක **extract** කරලා **`coop-web`** folder එක අරින්න
3. ඇතුළේ තියෙන **හැම දෙයක්ම** (Ctrl+A → Ctrl+C) copy කරන්න

#### 2️⃣ පරණ project folder එකට දාන්න
1. ඔයාගේ project folder එක අරින්න  
   (උදා: `C:\Users\computer\Downloads\workspace-xxxx\coop-web`)
2. **Ctrl + V** → **"Replace the files in the destination"** ✅
3. ⚠️ **`.git` folder එක replace කරන්න එපා** (එන dialog එකේ තිබුණොත් **Skip** කරන්න)  
   — නැත්නම් ඔයාගේ GitHub connection එක නැති වෙනවා

#### 3️⃣ Push කරන්න (cmd එකේ)
```
cd C:\Users\computer\Downloads\workspace-xxxx\coop-web
git add -A
git commit -m "update"
git push
```
> login ඇසුවොත්: Username = ඔයාගේ GitHub username · Password = `ghp_...` token එක

#### 4️⃣ Deploy
- ඔයාගේ repo එක **Vercel එකට connect කරලා ඇත්නම්** → push එකෙන් **ස්වයංක්‍රීයව deploy වෙනවා** ✅
- නැත්නම් → vercel.com → project එක → **Deployments → ⋮ → Redeploy**

---

### 💡 පොඩි උපදෙස්
- Project folder එක **Downloads එකේ නෙවෙයි**, නිතර මකෙන්නේ නැති තැනක (උදා: `C:\mpcs-site`) තියාගන්න — එතකොට හැම update එකකදීම අලුත් folder හොයන්න ඕන නෑ
- පරණ `.env.local` file එක **කිසිවිටෙක GitHub එකට push කරන්න එපා** ⚠️
- අවුලක් ආවොත්: `git status` කියලා screenshot එකක් මට එවන්න

## SMTP 535 BadCredentials / provider mismatch

- `@mail.com` සහ `@gmail.com` වෙනස් providers. `@mail.com` username එක `smtp.gmail.com` වෙත යැවීමෙන් වැරදි login එකක් ලැබේ. Site එක ලිපිනය ඉබේම වෙනස් නොකරයි.
- Gmail භාවිත කරන්න නම් සැබෑ Gmail / Google Workspace sender username එක + එම ගිණුමේ 2-Step Verification/App Password + `smtp.gmail.com:465` + නිවැරදි From email දාන්න.
- Mail.com තබාගන්න නම් Mail.com preset → `smtp.mail.com:465` (හෝ 587 STARTTLS) + Mail.com account එකට අදාළ SMTP credentials. SMTP access/account restrictions provider එකෙන් තහවුරු කරන්න. Gmail App Password එක Mail.com account එකකට භාවිත කළ නොහැක.
- Sender username / host වෙනස් කරන විට password එකත් නැවත දාන්න; වෙනත් ගිණුමේ saved password එක වැරදි server එකකට යවන්නේ නෑ.
- Save → Test. 535 දිගටම ආවොත් නිවැරදි account එකෙන් අලුත් credentials සාදන්න. Site code එකෙන් වැරදි password එක නිවැරදි කළ නොහැක; password chat එකට එවන්න එපා.
- Auto Backup Reports card එකට recipient emails 7ම Add → Save → Test. SMTP password එක එක sender එකට පමණයි. සැබෑ backup report අවශ්‍ය නම් Admin → Backup → test run → History + inbox බලන්න.
- Official Mail.com SMTP data: https://support.mail.com/premium/imap/server.html

## Backup සාර්ථක වුණත් report email නොඑනවා නම් — durable SMTP outbox update

- ZIP build/upload සම්පූර්ණ වූ වහාම report එක private `backup_secrets` outbox එකේ සුරැකී එම completion request එකේම SMTP send වේ. SMTP fail වුණොත් ඊළඟ authenticated cron check එකේ retry වේ; නව backup එකක් due වීම අවශ්‍ය නැහැ, ZIP එක නැවත සාදන්නේ නැහැ.
- Auto Backup Reports card එකේ save කළ recipients පමණයි; Contact inbox එකට fallback නොවේ. එහි නිවැරදි ලිපිනය දාලා Save කරන්න.
- Accepted recipients සුරැකෙන නිසා partial failure එකකදී ඉතිරි ලිපින පමණක් retry වේ. Parallel workers සඳහා atomic lease එකක් සහ සෑම run/recipient එකකටම stable Message-ID එකක් ඇත. SMTP acceptance හා DB acknowledgement අතර process එක කඩා වැටුණොත් SMTP මඟින් exactly-once inbox delivery සහතික කළ නොහැක.
- Backup History detail එකේ `SMTP accepted (...)` හෝ `PENDING SMTP retry` + හේතුව පෙන්වයි. Backup successful වීම සහ email accepted වීම වෙන වෙනම තත්ත්වයන්.
- **Timer HTTP timeout update:** Admin → Backup → Scheduled card → **SQL එක copy කරන්න** → Supabase SQL Editor → paste → Run. SQL එකට secret paste නොකරන්න; current secret එක private table එකෙන් සෑම tick එකකම කියවයි. නව SQL එකේ `timeout_milliseconds := 300000` තිබිය යුතුයි. කෙටි HTTP timeout එකක් full ZIP + SMTP request එකට ප්‍රමාණවත් නොවිය හැක.
- Admin → Backup → **දැන්ම Test එකක් දුවවන්න** භාවිත කර සැබෑ ZIP + completion report පරීක්ෂා කරන්න. `Test report` button එක sample email එකක් පමණයි.
- Outbox එකට නව table එකක් අවශ්‍ය නැහැ; පවතින backup/export/import coverage තුළ සුරැකේ. SMTP send attempt එක completion මොහොතේම වේ; සැබෑ inbox delivery තහවුරු කළ නොහැක.

## Board photos + full backup audit

- See `BACKUP_INVENTORY_SI.md` for the full Sinhala inventory, recovery steps and explicit limits.
- Deploy this update, then make a NEW full backup. Old ZIPs cannot recover photo bytes they never captured.
- No new DB migration is needed for this patch; media mapping uses existing `site_images_backup` columns. A full restore now retains empty-table metadata. Test on staging first and keep the safety ZIP.
- Normal ZIPs include `media/board/` copies as well as SQL-embedded bytes. Encrypted SQL retains uploaded media bytes without adding plaintext media copies. XLSX/CSV and public/source/schema files are not encrypted by this checkbox.
- Missing files/tables/schema/source and corrupt declared ZIP files now fail visibly instead of producing a falsely complete backup. Fix the reported access/missing-file issue and retry.
- Referenced files from other buckets are not moved into a public bucket: create matching private buckets/policies first. Their restored signed links expire after one hour and need a normal application refresh mechanism.
- Source restoration requires deployment. If rebuilding from ZIP, copy its root `schema.sql` to the project's `supabase/schema.sql` too; the build generator needs the canonical schema.
- npm scripts now declare the `tsx` test runner in devDependencies so the test gate is reproducible after `npm ci`.

### Verify image contents and actual hourly/SMTP observations

1. Full ZIPs now include `MEDIA-VERIFICATION.json`. With encryption ON, do not look for plaintext uploaded-image copies: choose the ZIP in Admin Backup Preview and decrypt locally to inspect/extract Board, bot and template images. RESTORE is not required.
2. Use **Live Auto-Backup / Confirmation Email Check** after deploying. It is authenticated/read-only and never sends sample messages. Look separately at cron heartbeat, consecutive scheduled runs, last success, SMTP-accepted and pending reports.
3. A force test is explicitly labeled manual, not evidence of hourly automation. Wait for real scheduled observations to confirm cadence. Inbox receipt still needs the recipient's inbox.
4. A missing heartbeat is not fixed by a configured secret alone. Re-run the Scheduled card's Copy SQL using the same current secret if the timer/job/timeout migration has not been installed. Heartbeat/media auditing itself uses existing tables, but the new install/repair/status RPCs REQUIRE the single timer SQL migration below.


## Latest required timer + encrypted-image update

1. Deploy the current source changes (not just the previous 72db4ef revision).
2. Run **`supabase/scheduled-backup.sql` once** in the production Supabase SQL Editor as the database owner. This is ONE secret-free update. If the current private cron secret exists, it repairs the timer immediately; it does NOT force an early backup. No member/voter/gallery/news tables are deleted or imported.
3. Admin → Backup & Restore → Save Schedule now calls the superadmin-only `mpcs_backup_timer_repair` RPC. **Install / Repair database timer** repairs without changing the save-time anchor. If SQL has not been applied, the UI reports that explicitly rather than claiming automation is ready. SQL contains the fixed production domain; a deliberate domain migration must update that destination.
4. Live status shows actual installed/active job, dynamic-secret use, last pg_net HTTP response/timeout, app heartbeat and saved history separately. A 401 suggests a secret mismatch; a 5xx is a handler failure, not success. A queued HTTP request is NOT backup completion.
5. Encrypted new full ZIPs contain **`encrypted-media/ALL-IMAGES.enc`** AND the backwards-compatible image bytes in `database.sql`. Uploaded media is NOT copied into plaintext `media/`. Use the normal ZIP Preview, or select the extracted `.enc` file in **Encrypted images පමණක් පරීක්ෂා කරන්න** with the same encryption password. No SQL import or restore is required. ZIP Preview checks both encrypted representations match by every file hash and category reference count.
6. Encryption ON + missing saved password now blocks the auto-backup instead of silently sending plaintext. Save the existing password through the encryption card first.
7. Existing MIME labels such as `application/octet-stream` no longer hide valid Board/template images in preview; detection uses image signatures and known image extensions.

Validation: 409 regression + 56 media + 17 diagnostics + 33 SMTP + 9 embedded-PostgreSQL SQL integration tests. SQL extension networking/cron are mocked in the embedded test: this is NOT evidence of a running production job. A separate read-only check downloaded current production Board 5 + bot 1 + template 70 images and passed actual encrypted-package byte/hash round trip; this is NOT a full production backup or inbox check.

Browser smoke test additionally passed AES-GCM+gzip image-package encrypt/decrypt, generic-MIME image detection, backup-byte thumbnails, pagination, decrypted image ZIP download, selection reset and no page errors. It was a local component fixture, not an authenticated production-admin session.
