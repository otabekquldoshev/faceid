# Davlat xizmatlari autentifikatsiya portali

## Ishga tushirish

1. Loyihaning papkasiga kiring:

```bash
cd "/home/cracked/Desktop/Sharipov Alisher Diplom ishi/2"
```

2. Lokal PostgreSQL bazani tayyorlang va migrationlarni ishlating:

```bash
npm run db:setup
```

3. Next.js serverni ishga tushiring:

```bash
npm run dev
```

4. Brauzerda oching:

```text
https://localhost:3000/auth/login
```

Brauzer self-signed certificate bo‘yicha ogohlantirsa, `Advanced` orqali davom eting. Kamera/Face ID ishlashi uchun HTTPS kerak.

## To‘xtatish

1. `npm run dev` ishlayotgan terminalda:

```bash
Ctrl+C
```

2. PostgreSQL bazani ham to‘xtatish kerak bo‘lsa:

```bash
npm run db:stop
```

3. Keyingi safar yana ishga tushirish uchun:

```bash
npm run db:start
npm run dev
```

## Telegram botni almashtirish

1. `.env.local` ichida yangi bot tokeni va chat ID ni yozing:

```env
TELEGRAM_BOT_TOKEN=your_new_bot_token
TELEGRAM_CHAT_ID=your_new_chat_id
```

2. Yangi botga Telegramda `/start` yuboring.

3. Token va chat ID to‘g‘ri ishlayotganini tekshiring:

```bash
npm run telegram:test
```

4. App login, reset va risk OTP yuborishda `.env.local`dagi `TELEGRAM_CHAT_ID`ni birinchi navbatda ishlatadi. Ya’ni `.env.local`da chat ID bor bo‘lsa, bazadagi eski user `telegram_chat_id` qiymati ishlatilmaydi.

5. Agar foydalanuvchilar oldin ro‘yxatdan o‘tgan bo‘lsa va bazadagi qiymatlarni ham tozalab yangilamoqchi bo‘lsangiz:

```bash
npm run telegram:sync-chat
```

6. Serverni toza qayta ishga tushiring:

```bash
Ctrl+C
npm run dev
```

## Muhim

- Login qilishdan oldin foydalanuvchini `Ro‘yxatdan o‘tish` sahifasida yaratish kerak.
- Mavjud bo‘lmagan username kiritilsa API `Invalid username or password` qaytaradi.
- Telegram eski botga ketayotgan bo‘lsa, odatda sabab eski dev server restart qilinmagani yoki bazadagi userlarda eski `telegram_chat_id` saqlanib qolgani bo‘ladi.
