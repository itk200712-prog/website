# 🔄 Update එකක් ආවම — Pull/Push කරන විදිහ (සරල පියවර)

> මම (AI එක) update එකක් හදලා commit කළාම, ඔයාගේ site එකට (GitHub → Vercel) යන විදිහ.

---

## 🅰️ හැඩය A — සරලම ක්‍රමය (නිර්දේශිත ✅)

**ඔයා කිසිවක් කරන්න ඕන නෑ!** මට කියන්න "update එක push කරන්න" කියලා —
මම මෙතන ඉඳන්ම GitHub repo එකට push කරන්නම් → **Vercel එක auto deploy වෙනවා** 🚀

ඊළඟ වතාවට token එකක් ඕන වෙනවා:
1. github.com → Settings → Developer settings → **Personal access tokens → Tokens (classic)**
2. **Generate new token** → ✅ **repo** tick → Generate → `ghp_...` copy
3. මට එවන්න (මම push කරලා කියන්නම් — ඉවරයි!)
4. ⚠️ දවසකට පස්සේ github.com එකේ ගිහින් ඒ token එක **Delete** කරන්න (ආරක්ෂාවට)

---

## 🅱️ හැඩය B — ඔයාම Push කරනවා නම්

### 1️⃣ අලුත් code එක ගන්න
1. **Arena එකෙන් workspace එක නැවත Download කරන්න**
2. Download එක **extract** කරලා **`coop-web`** folder එක අරින්න
3. ඇතුළේ තියෙන **හැම දෙයක්ම** (Ctrl+A → Ctrl+C) copy කරන්න

### 2️⃣ පරණ project folder එකට දාන්න
1. ඔයාගේ project folder එක අරින්න  
   (උදා: `C:\Users\computer\Downloads\workspace-xxxx\coop-web`)
2. **Ctrl + V** → **"Replace the files in the destination"** ✅
3. ⚠️ **`.git` folder එක replace කරන්න එපා** (එන dialog එකේ තිබුණොත් **Skip** කරන්න)  
   — නැත්නම් ඔයාගේ GitHub connection එක නැති වෙනවා

### 3️⃣ Push කරන්න (cmd එකේ)
```
cd C:\Users\computer\Downloads\workspace-xxxx\coop-web
git add -A
git commit -m "update"
git push
```
> login ඇසුවොත්: Username = ඔයාගේ GitHub username · Password = `ghp_...` token එක

### 4️⃣ Deploy
- ඔයාගේ repo එක **Vercel එකට connect කරලා ඇත්නම්** → push එකෙන් **ස්වයංක්‍රීයව deploy වෙනවා** ✅
- නැත්නම් → vercel.com → project එක → **Deployments → ⋮ → Redeploy**

---

## 💡 පොඩි උපදෙස්
- Project folder එක **Downloads එකේ නෙවෙයි**, නිතර මකෙන්නේ නැති තැනක (උදා: `C:\mpcs-site`) තියාගන්න — එතකොට හැම update එකකදීම අලුත් folder හොයන්න ඕන නෑ
- පරණ `.env.local` file එක **කිසිවිටෙක GitHub එකට push කරන්න එපා** ⚠️
- අවුලක් ආවොත්: `git status` කියලා screenshot එකක් මට එවන්න
