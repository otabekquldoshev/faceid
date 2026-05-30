# Render.com Deployment Guide

Bu loyihani Render.com-ga deploy qilish bo'yicha to'liq ko'rsatma.

## 📋 Talab qilinadigan narsalar

- [ ] GitHub akkauntiga kirish
- [ ] Render.com-da ro'yxatdan o'tish (https://render.com)
- [ ] Telegram Bot Token va Chat ID (`.env.local`-da mavjud)

## 🚀 Deployment qadamlari

### 1. GitHub-ga push qiling

```bash
git init
git add .
git commit -m "Initial commit for Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Render-da yangi Blueprint deploy qiling

1. [Render Dashboard](https://dashboard.render.com) ga o'ting
2. **"New +"** ni bosing → **"Blueprint"** tanlang
3. GitHub repositoriyasini ulangi
4. Repository-ni tanlang va deploy qiling

### 3. Environment Variables o'rnating

Render Dashboard-da quyidagi o'zgaruvchilarni qo'shing:

```
TELEGRAM_BOT_TOKEN=8665817275:AAHnEm0vHPNlCG5kcIrLlpBjtNUOMxwusg0
TELEGRAM_CHAT_ID=7947005705
```

**Muhim:** `JWT_SECRET` va `DATABASE_URL` avtomatik ravishda yaratiladi.

### 4. Ma'lumotlar Bazasini o'rnating

render.yaml fayl `auth_db` PostgreSQL datab'esini avtomatik ravishda yaratadi.

Database migrations-ni o'tkazish:

```bash
# Render Shell (Web Service console) orqali:
npm run db:migrate
```

Yoki scripts/01-setup-auth-tables.sql-ni to'g'ridan-to'g'ri run qiling.

## ⚙️ Muhim Konfiguratsiyalar

### Render Web Service Settings

- **Build Command**: `pnpm install && pnpm run build`
- **Start Command**: `pnpm run start`
- **Node Version**: 20.x (avtomatik)
- **Plan**: Free (yoki Pro)

### Next.js Production Optimizations

Render-da Next.js toʻliq optimizatsiyalash uchun:

1. **Static Generation**: Qayta takrorlanuvchi sahifalarni `.next` kesh qiling
2. **API Routes**: Serverless functions sifatida ishlaydi
3. **Database Connection**: Render PostgreSQL-ni auto-replicate qiladi

## 🔐 Xavfsizlik

### Environment Variables

- `JWT_SECRET` - Render avtomatik qilib yaratadi
- `DATABASE_URL` - Hech qachon ulovga yuklang
- `TELEGRAM_*` tokens - Render Dashboard-da maxfiy saqlang

### HTTPS

Render avtomatik SSL/TLS sertifikatini taqdim etadi.

## 📊 Monitoring va Logs

1. Render Dashboard-da service-ni tanlang
2. **Logs** tab-ga o'ting
3. Real-time logs va errors ko'ring

### Database Logs

```bash
# PostgreSQL stats:
SELECT * FROM pg_stat_statements;
```

## 🆘 Muammolar

### "Cannot find module" xatosi

```bash
# Render Shell-da:
pnpm install
pnpm run build
```

### Database Connection Xatosi

```bash
# Connection string-ni tekshiring:
psql $DATABASE_URL -c "SELECT 1;"
```

### Telegram OTP ishlami?

1. TELEGRAM_BOT_TOKEN to'g'riligini tekshiring
2. Render logs-da errors izlang
3. Bot still subscribed-mi?

## 📈 Performance Tips

- **Static Pages**: ISR (Incremental Static Regeneration) foydalaning
- **Image Optimization**: Next.js Image component ishlatish
- **Caching**: Render caching headers o'rnating

## 🔄 Updates va Deploys

GitHub-ga push qilgandan keyin:

1. Render avtomatik webhook qabul qiladi
2. Build va deploy avtomatik boshlanadi
3. Logs Dashboard-da ko'rish mumkin

```bash
# GitHub-ga deploy qilish:
git add .
git commit -m "Feature: add new auth flow"
git push origin main
```

## 📞 Foydalanuvchi Support

- Render Support: https://support.render.com
- Next.js Docs: https://nextjs.org/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/

---

**Muvaffaqiyat!** 🎉
