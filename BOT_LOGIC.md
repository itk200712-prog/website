# 🤖 Baymax Bot — Logic & Training Guide (③)

> Site එකේ Live Chat widget එකේ ඉන්න **Baymax** බොට් ගේ මොළය. සුහද කතා සහ
> intent වචන තේරුම් ගැනීමේ logic එක **`src/lib/chatbot.ts`** එකේ තියෙනවා
> (pure functions, UI නැතුව). අඩවියේ ඕනෑම දෙයක් ගැන නිදහස් ප්‍රශ්නවලට
> පිළිතුරු දෙන **site brain** එක **`src/lib/knowledge.ts`** එකේ. දත්ත ගන්න
> flows සහ UI එක **`src/components/live-chat.tsx`** එකේ.

## 💬 Smalltalk (සුහද කතා)

| User ලියන දේ | Baymax කියන දේ |
|---|---|
| `hi` / `hii` / `hai` / `හයි` | «Hi! 👋 කොහොමද ඉන්නේ?» (කලින් නම කිව්වා නම් «**Hi Nimal!**») |
| `hello` / `hellow` / `හෙලෝ` | «Hello! 👋 මම Baymax බොට් — … මම කොහොමද ඔබට උදව් කරන්න ඕනෙ?» + මेनුව |
| `kohomada` / `කොහොමද` / `how are you` | «මම හොඳින් ඉන්නවා, ස්තූතියි! 😊 ඔයාට කොහොමද?» |
| → ඊට පස්සේ `hodin` / `මම හොඳින්` / `fine` | «අහන්න ලැබීම ගොඩක් සතුටුයි! 😊 මම අද ඔබට උදව් කරන්නේ කොහොමද?» + මෙනුව |
| → ඊට පස්සේ `නරකයි` / `not good` | සහකම්පාවෙන් + «ඇමතුමක් ඉල්ලන්න» යෝජනාව |
| `ආයුබෝවන්` / `ayubowan` | «ආයුබෝවන්! 🙏 …සාදරයෙන් පිළිගනිමු» |
| `good morning` / `සුබ උදෑසනක්` (afternoon/evening/night ද) | ඒ ආචාරයම ආපසු + උදව් යෝජනාව |
| `thank you` / `ස්තූතියි` / `bohoma sthuthi` | «ඔබව සාදරයෙන් පිළිගන්නවා! 🙏 තවත් උදව්වක් ඕනෙද?» |
| `bye` / `tata` / `ගිහින් එන්නම්` | «ගිහිල්ලා එන්න! 👋 …සුබ දවසක්!» |
| `ඔයා කවුද` / `your name` / නම විතරක් ඇහුවොත් | «මම Baymax — …» + කළ හැකි දේ ලැයිස්තුව (නමුත් `සභාපතිගේ නම`, `සමිතියේ නම` වගේ විෂයයක් තියෙන ප්‍රශ්න site brain එකට යයි) |
| `help` / `උදව්` / `menu` | 🧭 හැකියාවන් ලැයිස්තුව + shortcuts |
| `ok` / `හරි` / `එල` / `නියමයි` | «හරි! 👍 තවත් දෙයක් ඕනෙද?» |
| `මගේ නම Nimal Perera` / `my name is …` / `mage nama …` | නම **මතක තබා ගනී** (device එකේමයි) → පස්සේ හැම ආචාරයකදීම නමින් අමතයි |

විශේෂත්වය: reply භාෂාව පණිවිඩය අනුව ස්වයංක්‍රීයයි — සිංහල/Singlish ලියුවොත්
සිංහලෙන්ම, English ලියුවොත් site භාෂාව අනුව. Spelling වරදින්නත් කමක් නෑ
(`hellow`, `hii`, `kohomadha` වගේ තේරුම් ගනියි).

## 🧠 Site Brain — අඩවිය ගැන ඕනෑම දෙයක් අහන්න

Baymax දැන් බොත්තම්/කෙටි වචන විතරක් නෙවෙයි, නිදහස් ප්‍රශ්නත් තේරුම් ගන්නවා.
Chat එක අරින විට widget එක public website data එක වරක් load කරලා searchable
knowledge index එකක් හදනවා (offline/DB error නම් seed fallback):

- ව්‍යාපාර අංශ, ඒවායේ සේවා, කළමනාකරු සම්බන්ධතා සහ ශාඛා
- ග්‍රාමීය බැංකු ශාඛා 22 සහ එක් එක් ශාඛාවේ කළමනාකරු/දුරකථනය
- අධ්‍යක්ෂ මණ්ඩලය (තනතුර, සුදුසුකම්, දුරකථන)
- ප්‍රකාශිත පුවත් සහ ගැලරි අයිතම
- සාමාජික/ඡන්ද දායක සංඛ්‍යා සහ සේවා වසර
- සාමාජිකත්වයට අයදුම් කිරීම, ලේඛන, ගිණුම්/Register/Sign In/Forgot Password,
  F28, Privacy, සම්බන්ධතා/වේලාවන් වැනි අඩවියේ උපදෙස්

උදාහරණ: `සමිතියේ සම්පූර්ණ නම` · `සභාපතිගේ නම` · `chaiman name` ·
`Maliban` · `මාලිබන් කිරි` · `රූරල් බැංකුවේ සේවා මොනවාද?` ·
`Mandapola branch manager name` · `How do I reset my password?` ·
`gramiya bankuwe sewa monawada` · `සාමාජිකයින් කීයක් ඉන්නවාද?`

- හැම ක්‍රියාකාරී ව්‍යාපාර අංශයක්ම එහි නමෙන් හෝ එක keyword එකකින් සොයාගත
  හැක (`supermarket`, `සූපර් මාර්කට්`, `පොහොර`, `රක්ෂණය`, `රන් උකස්` වගේ).
  `Maliban` විතරක් ලියුවොත් ප්‍රධාන මාලිබන් බිස්කට් අංශය පෙන්වා, වෙනම මාලිබන්
  කිරි අංශයක් ඇති බවත් දන්වයි; `Maliban milk` කියුවොත් කෙලින්ම කිරි අංශය එයි.
- සමිතියේ නිල නම, සභාපති/උප සභාපති/අධ්‍යක්ෂ/සාමාන්‍ය කළමනාකරු වැනි තනතුරු,
  ශාඛා සහ කළමනාකරු නම්/දුරකථන සඳහා English, සිංහල, Singlish ප්‍රශ්න රටා සහ
  පොදුවේ දකින වැරදි අක්ෂර (`සබාපති`, `මැලිබන්`, `baliban` වගේ) තේරුම් ගනියි.
- සිංහල අකුරු, English සහ Singlish තුනම support; කුඩා spelling වැරදිත්
  බොහෝ විට තේරුම් ගනියි (`Restbury` → Ristbury වගේ).
- එකම වචනයෙන් අංශ කිහිපයක් අදහස් විය හැකි නම් (`services` වගේ) Baymax
  උත්තරයක් හිතාගන්නේ නැතුව «මේවායින් කෝකද අදහස් කළේ?» කියා විකල්ප පෙන්වයි.
- කලින් කතා කළ අංශය මතක තබා ගන්නා නිසා «ඒකේ දුරකථන අංකය මොකක්ද?» වගේ
  follow-up ප්‍රශ්නවලටත් උත්තර දෙයි.
- මෙය පිටත generative AI/API එකක් නොවේ — **අඩවියේම තහවුරු කළ තොරතුරු වලින්
  පමණක්** උත්තර දෙයි. අඩවියේ උත්තරයක් නැත්නම් ඒ බව කියා නිලධාරියෙකුට
  යොමු කරයි; තොරතුරු හදලා කියන්නේ නැහැ. ලියාපදිංචි user password වැනි
  රහසිගත දත්ත index එකට කිසිසේත් ඇතුළත් වන්නේ නැහැ.

අලුත් සේවාවක්/අංශයක් Admin එකෙන් දැම්මොත් ඊළඟ වර chat එක අරින විට එය
ස්වයංක්‍රීයව brain එකට එනවා. අලුත් උපදෙස් පිළිතුරක් උගන්වන්න නම්
`knowledge.ts` හි `staticEntries()` ට entry එකක් දමා `scripts/test.mts`
section 12 ට test එකක් එක් කරන්න.

## ⛽ Fuel Prices

- `fuel prices` / `ඉන්ධන මිල` → **මුලින්ම ඉන්ධනය තෝරන මෙනුව** (ඔක්ටේන් 92 ·
  සුපර් ඩීසල් · කිරෝසින් · සියලුම මිල ගණන් එකවර) → තෝරපු ගමන් **ඒ වර්ගයේ අද මිල**
  (Admin → Fuel Prices එකෙන් යාවත්කාලීන කරන live මිලමයි, seed fallback සමඟ)
- කෙලින්ම `petrol price` / `ඩීසල් මිල කීයද` / `kerosene` කියුවොත් මෙනුව නැතුව **ඒ මිලම** එනවා
- මිල දැක්වුවාට පස්සේ අනෙක් වර්ග වලට chips + ඉන්ධන පිරවුම්හල පිටුවට link එක

## 📰 News & 🖼️ Gallery

- `News` බොත්තම / `news` / `පුවත්` / `නිවේදන` → **published=true** අයිතම පමණක්,
  pinned මුලින් → අලුත්ම මුලින්, cards විදිහට (පින්තූරය, badge, දිනය) →
  card එක click කළාම **සම්පූර්ණ විස්තරය** + පුවත් පිටුවට link
- `job vacancies` / `රැකියා` → රැකියා නිවේදන පමණක් · `ටෙන්ඩර්` / `tender` → ටෙන්ඩර් පමණක්
- `Gallery` බොත්තම / `gallery` / `ඡායාරූප` → published ඡායාරූප **title + tagline
  (description) + ❤️ likes** සමඟ → click කළාම විස්තරය + ගැලරි පිටුවට link

## 👤 නිලධාරියෙකු සම්බන්ධ කරගැනීමේ ඉල්ලීම්

`chatbot.ts` හි `detectOfficerRequest()` එක සිංහල, Singlish සහ English
ස්වභාවික වාක්‍ය තේරුම් ගනී: `මට ඔෆිස් එකේ කෙනෙක්ව සම්බන්ද කරගන්න ඕන` ·
`කාර්යාලයේ කෙනෙක්ට කතා කරන්න ඕන` · `mata office eke kenekwa sambanda
karaganna ona` · `Please connect me to someone at the office`.

- `සම්බන්ධ` / `සම්බන්ද` / `සම්බඳ` කියන අක්ෂර වින්‍යාස තුනම එකම අර්ථයෙන්
  හඳුනාගනී; `නිලදාරි` වගේ සාමාන්‍ය වැරදි ලිවීම් සහ ඉඩ නොතබා ලියූ වාක්‍යත්
  තේරුම් ගනී.
- කෙලින්ම සම්බන්ධ වෙන්න/කතා කරන්න ඉල්ලන විට නිලධාරි flow එකට මුල් තැන
  ලැබේ. නමුත් කාර්යාල දුරකථන අංකය, නිලධාරියාගේ නම, ලිපිනය හෝ කාර්යාල
  වේලාවන් වැනි කරුණු ප්‍රශ්න site brain එකෙන්ම පිළිතුරු ලැබේ.
  `නිලධාරියෙක් සම්බන්ද කරගන්නෙ කොහොමද?` කියා ක්‍රමය අහන විට
  `officer-contact-process` පිළිතුර ලැබේ.
- English page එකක හිටියත් සිංහලෙන් ඇහුවොත්, closed-hours notice එක,
  `ඔව්/නෑ` තේරීම, callback form එක සහ ඉල්ලීම යැවූ පසු පණිවිඩය ඇතුළු
  සම්පූර්ණ officer flow එකම සිංහලෙන් පැවතේ. කාර්යාල වේලාවෙන් පිටතදී
  ඉල්ලීම නොයවා ඊළඟ විවෘත වන වේලාව පෙන්වයි.

## ✨ Gemini AI fallback — පොදු දැනුම් ප්‍රශ්න

සමිතියට අදාළ නැති **නිදහස් ප්‍රශ්නවලට** (උදා: `සමූපකාරයක් යනු කුමක්ද?`,
`සීගිරිය කොහෙද තියෙන්නේ?`) Baymax සාමාන්‍ය AI chat bot එකක් වගේ Gemini AI
එකෙන් — Google Search grounding එකත් එක්ක — උත්තර දෙනවා. කලින් කතා කරපු දේත්
(AI වට 8ක් දක්වා) යවන නිසා `ඒක කොහෙද තියෙන්නේ?` වගේ follow-up ප්‍රශ්නත්
තේරෙනවා. පිළිතුරු භාෂාව ප්‍රශ්නයේ භාෂාවමයි: සිංහල/Singlish ඇහුවොත් සිංහල
අකුරෙන්, English ඇහුවොත් English වලින්. සමිතියට අදාළ ඇත්ත තොරතුරු (නම්,
දුරකථන, මිල, සාමාජික වාර්තා) AI එක හදලා කියන්නේ නෑ — ඒවා site
brain/officer flow එකෙන්මයි. Keyword විතරක් තියෙන කෙටි ඒවාත් site brain එකටමයි.

- **වෘත්තීය හැසිරීම:** AI පිළිතුරු markdown නැති පිරිසිදු plain text එකක් ලෙස
  (`•` bullets සහිතව) එයි; සිංහල පිළිතුරු ගෞරවයෙන් “ඔබ” ස්වරූපයෙන් එයි;
  AI එකට අද දිනයත් දැනේ. පිළිතුරකට පසු «තව විස්තර කියන්න / කෙටියෙන් කියන්න /
  උදාහරණයක් දෙන්න» වගේ follow-up බොත්තම් එනවා.
- **Settings:** Admin → Live Chat → “Baymax AI — Gemini” card එකෙන් on/off,
  model එක සහ API key එක save කරන්න පුළුවන් (superadmin විතරයි key එක).
- **ආරක්ෂාව:** key එක `backup_secrets` (superadmin-only) එකේ; browser එකට
  එන්නේ නෑ. `/api/baymax-ai` server route එක Vercel env එකේ ඇති
  `SUPABASE_SERVICE_ROLE_KEY` එකෙන් විතරයි එය කියවන්නේ. ඒ env එක නැත්නම්
  AI එක නිහඬව off වෙලා පරණ fallback එකම වැඩ කරයි.
- **එක වරක් setup:** Vercel → Settings → Environment Variables එකට
  `SUPABASE_SERVICE_ROLE_KEY` දාලා redeploy කරන්න ඕනේ (Admin card එකෙත්
  පියවර තියෙනවා). ඊට පස්සේ Gemini key එක save කරලා **Test** ඔබන්න.
- **Quota/model වැටුණොත්:** තෝරපු model එකට 429 (quota) හෝ 404 ආවොත් server
  එක search නැතිවත් සහ වෙනත් models කීපයක්ද auto try කරනවා. සේරම fail නම්
  visitor ට “තේරුණේ නෑ” වෙනුවට AI සීමාව පැන ඇති බව කියනවා.

## 🕘 Live Chat කාර්යාල වේලාවන්

සජීවී නිලධාරියෙක් සම්බන්ධ කර ගැනීම (Live Chat / Request a Call) පුළුවන්
වන්නේ **Asia/Colombo වේලාවෙන්** සඳුදා–සිකුරාදා පෙ.ව. 8.30–ප.ව. 5.30 සහ
සෙනසුරාදා පෙ.ව. 8.30–ප.ව. 1.30 අතර විතරයි; ඉරිදා වසා ඇත. වේලාවෙන් පිටත
ඉල්ලුවොත් ඉල්ලීම නොයවා «මේ වෙලාවේ සජීවී නිලධාරියෙක් සම්බන්ධ කර ගැනීම
අපහසුයි» කියා **ඊළඟට විවෘත වන වේලාව** (අද / හෙට / සඳුදා) පෙන්වයි.
මේ සීමාව Live Chat එකට විතරයි — Baymax පිළිතුරු සහ Message පෙට්ටිය 24/7
වැඩ කරයි. දැනටමත් join වී ඇති සංවාදයක් මැදින් නවතින්නේ නැත.
Logic එක `src/lib/chatbot.ts` හි `getLiveChatHoursStatus()` එකේ ඇත.

## 🎓 Message වලින් ට්‍රේන් වීම (ඉගෙන ගැනීම)

1. **Context මතකය** — «ඔයාට කොහොමද?» කියලා ඇහැව්වට පස්සේ එන `hodin` වගේ
   පිළිතුරට ගැළපෙන විදිහට කතා කරනවා. කියපු **නමත්** මතක තබා ගන්නවා.
   නමුත් widget එක **X එකෙන් close කළාම** හෝ Live Chat එක **Clear chat**
   කළාම Baymax පණිවිඩ history එක, follow-up context එක, open panel සහ
   type කරමින් තිබුණු text ඔක්කොම අයින් වී අලුත් welcome එකකින් පටන් ගනී.
   (Minimize කළාම history එක එහෙමම තියෙනවා; officer session එකට X එකෙන්
   බලපෑමක් නෑ.)
2. **තේරුණේ නැති පණිවිඩ සටහන් වෙනවා** — bot එකට තේරුණේ නැති හැම පණිවිඩයක්ම
   `live_chat_events` එකට `event_type = 'unmatched'` විදිහට log වෙනවා (table එක
   තිබුණොත්). කවදා හරි ඒ ලැයිස්තුව බලලා නිතර එන වචන `chatbot.ts` එකට එකතු
   කරන එකෙන් bot එක දවසින් දවස දක්ෂ වෙනවා. හැම intent එකක්ම `intent_*` විදිහටත්
   log වෙනවා — මිනිස්සු වැඩිපුරම අහන්නේ මොනවාද කියලා බලන්න පුළුවන්.
3. **අලුත් වචනයක් උගන්වන්න:** `src/lib/chatbot.ts` එකේ අදාළ pattern එකට වචනය
   එකතු කරලා, `scripts/test.mts` එකේ section 11 ට test එකක් දාන්න. UI වෙනස්
   කරන්න ඕනේ නෑ.

## 🔐 Original Super Admin ආරක්ෂණය

මුල සිටම සිටි **original (root) superadmin** කෙනා `profiles.is_root_admin`
එකෙන් ලකුණු කරලා ඇත (එය Backup ZIP එකෙත්, schema එකෙත් එනවා). අලුතින් එකතු වූ
superadmin කෙනෙක්ට හෝ admin කෙනෙක්ට වෙනත් admin ගිණුමක password එක බලන්න,
reset කරන්න හෝ ගිණුම මකන්න බෑ — ඒවා root ට විතරයි. සාමාන්‍ය member ගිණුම්
ඕනෑම admin කෙනෙක්ට කළමනාකරණය කරන්න පුළුවන්. Password reset එක කරන්නේ
`/api/admin-reset-password` server route එකෙන් (service-role key එක server
එකේ විතරයි); තමන්ගේම password එක වෙනස් කිරීම Admin → Profile එකෙනි.

## ✅ පරීක්ෂණ

```bash
npx -y tsx scripts/test.mts   # 264 tests — smalltalk + Sinhala officer intent + Gemini AI (search/history/routing/pro tone) + office hours + site brain/keywords + message box + backup (manifest/encryption/restore) + root-admin protection + NIC/phone validation + activity-log delete
npm run build                 # production build
```

සටහන: Gemini AI එක දැන් **විකල්ප fallback එකක්** විදිහට සම්බන්ධ කරලා
තිබුණාත්, සමිතිය ගැන උත්තර සඳහා ප්‍රධාන මූලාශ්‍රය හැමවිටම මෙම verified
site knowledge එකමයි — AI එක පාවිච්චි වෙන්නේ එහි උත්තරයක් නැති පොදු
ප්‍රශ්නවලට විතරයි.
