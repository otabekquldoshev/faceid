# 🚀 Render-ga Deploy Qilish - Tez Qo'llanma

## ✅ Pre-Deployment Checklist

- [ ] `pnpm install` va `pnpm run build` local-da ishlaydi
- [ ] `.env.local` file-da TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID mavjud
- [ ] Git repository GitHub-da mavjud
- [ ] `.gitignore` `.env.local` ignore qiladi
- [ ] `render.yaml` loyihaning root-ida mavjud

## 📍 5 Qadamlik Deployment Jarayon

### Qadam 1️⃣: GitHub-ga Push Qiling

```bash
# Agar git init qilinmagan bo'lsa:
git init
git add .
git commit -m "Initial commit: ready for Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Qadam 2️⃣: Render-da Login va Blueprint Deploy

1. https://dashboard.render.com ga o'ting
2. GitHub akkauntingiz bilan login qiling
3. **"New +"** → **"Blueprint"** tanlang
4. GitHub repositoriyasini tanlang

### Qadam 3️⃣: Environment Variables O'rnating

Render Dashboard-da **Environment** sectioning-ga o'ting va qo'shing:

```
TELEGRAM_BOT_TOKEN=8665817275:AAHnEm0vHPNlCG5kcIrLlpBjtNUOMxwusg0
TELEGRAM_CHAT_ID=7947005705
```

Qolgan o'zgaruvchilar:
- `JWT_SECRET` - Render avtomatik qilib yaratadi ✓
- `DATABASE_URL` - PostgreSQL avtomatik qilib tahdid etadi ✓

### Qadam 4️⃣: Deploy Qiling

- **"Deploy Blueprint"** tugmasini bosing
- Build va deploy process 3-5 daqiqada tugatiladi
- Render LIVE URL beradi

### Qadam 5️⃣: Database Setup (Opsional)

Agar database migrations kerak bo'lsa:

1. Render Dashboard → Web Service → Shell (Console)
2. Quyidagi buyruqni ishga tushiring:

```bash
psql $DATABASE_URL < scripts/01-setup-auth-tables.sql
```

Yoki:

```bash
npm run db:migrate
```

## 🔗 Olingan URL

Deploy tugagandan keyin Render sizga beradi:
```
https://auth-system.onrender.com
```

## ⚠️ Muhim Eslatma

- `.env.local` hech qachon Git-ga push qilmang
- Render avtomatik HTTPS/SSL taqdim etadi
- Database va Web Service bir-biri bilan avtomatik bog'lanadi

## 📝 Keyin Kod O'zgartirganda

```bash
# GitHub-ga push qiling
git add .
git commit -m "Feature: add new login method"
git push origin main

# Render avtomatik redeploy qiladi ✓
```

## 🆘 Muammolar

### Deployment Failed?

1. Render Logs-da tekshiring: Dashboard → Logs
2. Build Command: `pnpm install && pnpm run build`
3. Start Command: `pnpm run start`

### OTP/Telegram ishlami?

```bash
# Render Shell-da test qiling:
echo "SELECT * FROM users LIMIT 1;" | psql $DATABASE_URL
```

---

**Shu hammasini bo'lgach, loyihangiz Render-da live bo'ladi! 🎉**

Batafsil ma'lumot: [RENDER_DEPLOY.md](./RENDER_DEPLOY.md)
