import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, getUserByUsername, hashPassword, storeOTP, verifyOTP, updateUserPassword, logAuthAction } from '@/lib/auth-utils'
import { checkRateLimit, rateLimitConfig, rateLimitResponse } from '@/lib/rate-limit'
import { sendOTPViaTelegram } from '@/lib/telegram-bot'

function isDatabaseConnectionError(error: unknown) {
  if (error instanceof AggregateError) return true

  const message = error instanceof Error ? error.message : String(error)
  return /ECONNREFUSED|Connection terminated|connect/i.test(message)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stage, identifier, telegramChatId, otp, userId, newPassword } = body
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (stage === 'request') {
      if (!identifier) {
        return NextResponse.json({ error: 'Foydalanuvchi nomi yoki emailni kiriting.' }, { status: 400 })
      }

      const normalizedIdentifier = String(identifier).trim().toLowerCase()
      const limit = checkRateLimit(request, {
        keyPrefix: 'auth:forgot-password:request',
        keyParts: [normalizedIdentifier],
        maxRequests: rateLimitConfig.forgotPasswordMax,
        windowMs: 15 * 60 * 1000,
      })

      if (!limit.allowed) {
        return rateLimitResponse(limit, 'Parolni tiklash kodi juda ko‘p so‘raldi. 15 daqiqadan keyin qayta urinib ko‘ring.')
      }

      const user = (await getUserByUsername(normalizedIdentifier)) || (await getUserByEmail(normalizedIdentifier))

      if (!user) {
        return NextResponse.json({ error: 'Bunday foydalanuvchi topilmadi.' }, { status: 404 })
      }

      const resetChatId = String(user.telegram_chat_id || telegramChatId || '').trim()

      if (!resetChatId) {
        return NextResponse.json({
          error: 'Bu accountga Telegram Chat ID bog‘lanmagan. Qaytadan ro‘yxatdan o‘ting yoki administratorga murojaat qiling.',
        }, { status: 400 })
      }

      const { generateOTP } = await import('@/lib/auth-utils')
      const resetOtp = generateOTP(6)
      await storeOTP(user.id, resetOtp, 5)

      const otpSent = await sendOTPViaTelegram(resetChatId, user.username, resetOtp)
      const allowDevelopmentOtp = process.env.NODE_ENV !== 'production'

      if (!otpSent && !allowDevelopmentOtp) {
        return NextResponse.json({ error: 'OTP yuborilmadi. Telegram botni /start qilganingizni tekshiring.' }, { status: 500 })
      }

      await logAuthAction(user.id, 'password_reset_requested', { identifier: normalizedIdentifier }, ipAddress, userAgent)
      return NextResponse.json({
        success: true,
        userId: user.id,
        message: otpSent
          ? 'Password reset code sent to Telegram'
          : 'Telegram OTP yuborilmadi. Development rejimida kod sahifada ko‘rsatiladi.',
        devOtp: otpSent ? undefined : resetOtp,
      }, { status: 200 })
    }

    if (stage === 'reset') {
      if (!userId || !otp || !newPassword) {
        return NextResponse.json({ error: 'User ID, OTP, and new password are required' }, { status: 400 })
      }

      const limit = checkRateLimit(request, {
        keyPrefix: 'auth:forgot-password:reset',
        keyParts: [userId],
        maxRequests: rateLimitConfig.otpMax,
        windowMs: 15 * 60 * 1000,
      })

      if (!limit.allowed) {
        return rateLimitResponse(limit, 'Parolni tiklash urinishlari ko‘payib ketdi. Birozdan keyin qayta urinib ko‘ring.')
      }

      const isValid = await verifyOTP(userId, otp)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })
      }

      const passwordHash = await hashPassword(newPassword)
      await updateUserPassword(userId, passwordHash)
      await logAuthAction(userId, 'password_reset_success', {}, ipAddress, userAgent)

      return NextResponse.json({ success: true, message: 'Password has been reset successfully' }, { status: 200 })
    }

    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  } catch (error) {
    console.error('[v0] Forgot password error:', error)
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json({
        error: 'Ma’lumotlar bazasiga ulanib bo‘lmadi. Terminalda npm run db:start buyrug‘ini ishga tushiring va qayta urinib ko‘ring.',
      }, { status: 503 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
