# 4-Stage Authentication System Setup

Davlat xizmatlari portalining xavfsiz autentifikatsiya tizimi.

## 🔐 Autentifikatsiya Bosqichlari

1. **Username/Email Tekshirish** - Foydalanuvchi nomini kiriting
2. **Parol Tasdiqlanishi** - Parolni kiriting va Telegram Chat ID-ni qo'shing
3. **OTP Verifikatsiyasi** - Telegram orqali yuborilan 6-xonali kodni kiriting
4. **Yuz Yuzaga Tekshirish** - Kamera orqali yuzni tasdiq qiling

## 📋 Jadvallari

### users
- `id` (UUID) - Foydalanuvchi identifikatori
- `username` (VARCHAR) - Foydalanuvchi nomi
- `email` (VARCHAR) - Email manzili
- `password_hash` (VARCHAR) - Hashed parol (bcrypt)
- `telegram_chat_id` (VARCHAR) - Telegram chat ID
- `facial_data` (JSONB) - Yuz sifatidagi ma'lumotlar
- `created_at`, `updated_at` (TIMESTAMP)

### otp_records
- `id` (UUID) - OTP identifikatori
- `user_id` (UUID) - Foydalanuvchi ID
- `otp_code` (VARCHAR) - 6-xonali OTP kod
- `expires_at` (TIMESTAMP) - OTP tugash vaqti (3 daqiqa)
- `is_used` (BOOLEAN) - OTP ishlatilganmi
- `verified_at` (TIMESTAMP) - Tasdiqlanish vaqti
- `attempts` (INT) - Urinish soni

### login_sessions
- `id` (UUID) - Session identifikatori
- `user_id` (UUID) - Foydalanuvchi ID
- `session_token` (VARCHAR) - Unique session token
- `stage` (VARCHAR) - Joriy bosqich (username, password, otp, facial, completed)
- `stage_data` (JSONB) - Bosqich bo'yicha ma'lumotlar
- `expires_at` (TIMESTAMP) - Session tugash vaqti (30 daqiqa)
- `completed_at` (TIMESTAMP) - Tugallash vaqti

### auth_audit_logs
- `id` (UUID) - Log identifikatori
- `user_id` (UUID) - Foydalanuvchi ID
- `action` (VARCHAR) - Amal (login_successful, login_failed, otp_sent, etc.)
- `details` (JSONB) - Qo'shimcha ma'lumotlar
- `ip_address` (VARCHAR) - IP manzili
- `user_agent` (TEXT) - Browser/Device info
- `created_at` (TIMESTAMP) - Log vaqti

## 🤖 Telegram Bot Konfiguratsiyasi

### Telegram Bot Yaratish
1. Telegram da `@BotFather` bilan suhbat qo'ling
2. `/newbot` buyrug'ini kiriting
3. Bot uchun nom va username tanlang
4. Bot tokenni olib qo'ying

### Environment Variables
```env
TELEGRAM_BOT_TOKEN=<your_bot_token>
TELEGRAM_CHAT_ID=<your_chat_id>
JWT_SECRET=<random_secret_key>
DATABASE_URL=postgresql://username:password@localhost:5432/your_db
RATE_LIMIT_ENABLED=true
AUTH_PASSWORD_RATE_LIMIT_MAX=5
AUTH_OTP_RATE_LIMIT_MAX=5
AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX=4
AUTH_FACE_RATE_LIMIT_MAX=10
```

### Chat ID Bilish
1. Telegram da bot bilan suhbat qo'ling
2. `/start` yuboring
3. Bot sizning chat ID-ingizni javob beradi

## 🔄 API Routes

### POST /api/auth/login
**Stage 1 - Username**
```json
{
  "stage": "username",
  "username": "user123"
}
```

**Stage 2 - Password**
```json
{
  "stage": "password",
  "username": "user123",
  "password": "password123",
  "telegramChatId": "123456789"
}
```

**Stage 3 - OTP**
```json
{
  "stage": "otp",
  "userId": "uuid",
  "otp": "123456"
}
```

### POST /api/auth/verify-otp
```json
{
  "userId": "uuid",
  "otp": "123456"
}
```

### POST /api/auth/facial-verify
```json
{
  "userId": "uuid",
  "sessionToken": "token",
  "facialData": {
    "confidence": 0.95,
    "livenessScore": 0.92,
    "expressions": {...}
  }
}
```

### POST /api/auth/forgot-password
**Stage 1 - Reset kodi so‘rash**
```json
{
  "stage": "request",
  "identifier": "user123"
}
```

**Stage 2 - Parolni yangilash**
```json
{
  "stage": "reset",
  "userId": "uuid",
  "otp": "123456",
  "newPassword": "new-password"
}
```

## 🔒 Xavfsizlik Xususiyatlari

✅ **Bcrypt Password Hashing** - Parollar bcrypt bilan hash qilingan
✅ **JWT Tokens** - Xavfsiz session tokenlar
✅ **HTTP-Only Cookies** - Automatik session saqlash
✅ **OTP Expiration** - 3 daqiqada tugash
✅ **Rate Limiting Ready** - Qayta urinishlarni cheklash imkoni
✅ **Active Rate Limiting** - Parol, OTP, Face ID, risk va reset urinishlari 429 bilan cheklanadi
✅ **Audit Logs** - Barcha logininglar yozib qolishi
✅ **Row Level Security** - Supabase RLS siyosatlari

## 📱 Facial Verification

- **Camera Access** - Face-API.js yordamida yuz aniqlanadi
- **Liveness Detection** - Ko'z yumish va bosh harakati tekshiriladi
- **Confidence Scoring** - Yuz tanish aniqligini baholash
- **Expression Analysis** - Ifoda tahlili (neutral, happy, angry, etc.)

## 🚀 Jadvalni Yaratish

Postgres-da `/scripts/01-setup-auth-tables.sql` faylning kodini ishlating:

```bash
# Yoki terminal orqali
psql -U postgres -d your_db -f scripts/01-setup-auth-tables.sql
```

## 🧪 Test Foydalanuvchilari

Postgres-da quyidagi test foydalanuvchisini yarating:

```sql
INSERT INTO users (username, email, password_hash, telegram_chat_id)
VALUES (
  'test_user',
  'test@example.com',
  '$2a$10$...hash...',  -- bcrypt hash of "password123"
  '123456789'
);
```

## 🛠️ Muammo Hal Qilish

### OTP Telegram orqali yo'q
- TELEGRAM_BOT_TOKEN to'g'riligini tekshiring
- Telegram Chat ID to'g'riligini tekshiring
- Bot @userinfobot orqali chat ID-ni olganingizni tekshiring

### Session tugaydi
- `login_sessions` jadvalidagi `expires_at` vaqtini tekshiring
- Default 30 daqiqa, kerak bo'lsa uzaytiring

### Yuz yuzaga tanish ishlamaydi
- Camera ruxsatini berganingizni tekshiring
- Face-API.js modellarini yuklashini kutib turing
- Console da xatolarni tekshiring

## 📚 O'zgaruvchilar

```typescript
interface User {
  id: string
  username: string
  email: string
  password_hash: string
  telegram_chat_id: string
  facial_data: FacialData
  created_at: Date
  updated_at: Date
}

interface OTPRecord {
  id: string
  user_id: string
  otp_code: string
  expires_at: Date
  is_used: boolean
  verified_at?: Date
  attempts: number
}

interface LoginSession {
  id: string
  user_id: string
  session_token: string
  stage: 'username' | 'password' | 'otp' | 'facial' | 'completed'
  stage_data: Record<string, any>
  expires_at: Date
  completed_at?: Date
}
```

## 📞 Qo'llab-quvvatlash

Savollar bo'lsa, yoki muammo bo'lsa, audit loglarini tekshiring:

```sql
SELECT * FROM auth_audit_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

---

**Versiya**: 1.0
**Oxirgi yangilanish**: 2026-04-28
