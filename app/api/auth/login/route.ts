import { NextRequest, NextResponse } from 'next/server'
import { findUserByUsernameOrEmail, storeOTP, logAuthAction, verifyPassword } from '@/lib/auth-utils'
import { checkRateLimit, rateLimitConfig, rateLimitResponse } from '@/lib/rate-limit'
import { sendOTPViaTelegram } from '@/lib/telegram-bot'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stage, username, password, userId, otp } = body
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Stage 1: Username/Email verification
    if (stage === 'username') {
      const identifier = String(username || '').trim().toLowerCase()
      const limit = checkRateLimit(request, {
        keyPrefix: 'auth:login:identifier',
        keyParts: [identifier],
        maxRequests: 20,
        windowMs: 10 * 60 * 1000,
      })

      if (!limit.allowed) {
        return rateLimitResponse(limit)
      }

      const user = await findUserByUsernameOrEmail(identifier)
      
      if (!user) {
        await logAuthAction(null, 'login_failed_user_not_found', { identifier }, ipAddress, userAgent)
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
      }

      await logAuthAction(user.id, 'login_stage_1_complete', { identifier }, ipAddress, userAgent)

      return NextResponse.json({
        success: true,
        stage: 'password',
        userId: user.id,
        message: 'Username verified. Please enter password.',
      })
    }

    // Stage 2: Password verification
    if (stage === 'password') {
      const identifier = String(username || '').trim().toLowerCase()
      const limit = checkRateLimit(request, {
        keyPrefix: 'auth:login:password',
        keyParts: [identifier],
        maxRequests: rateLimitConfig.loginPasswordMax,
        windowMs: 15 * 60 * 1000,
      })

      if (!limit.allowed) {
        return rateLimitResponse(limit, 'Parol juda ko‘p marta noto‘g‘ri kiritildi. 15 daqiqadan keyin qayta urinib ko‘ring.')
      }

      const user = await findUserByUsernameOrEmail(identifier)
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 401 })
      }

      const isPasswordValid = await verifyPassword(password, user.password_hash)
      
      if (!isPasswordValid) {
        await logAuthAction(user.id, 'login_failed_invalid_password', { identifier }, ipAddress, userAgent)
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
      }

      // Generate OTP
      const { generateOTP } = await import('@/lib/auth-utils')
      const otp = generateOTP(6)
      
      // Store OTP in database
      await storeOTP(user.id, otp, 3)
      
      // Send OTP via Telegram
      const targetChatId = user.telegram_chat_id

      if (!targetChatId) {
        await logAuthAction(user.id, 'otp_send_failed_missing_chat_id', { identifier }, ipAddress, userAgent)
        return NextResponse.json({
          error: 'This account has no Telegram Chat ID. Please register again or contact support.',
        }, { status: 400 })
      }

      const otpSent = await sendOTPViaTelegram(targetChatId, user.username, otp)

      const allowDevelopmentOtp = process.env.NODE_ENV !== 'production'

      if (!otpSent && !allowDevelopmentOtp) {
        await logAuthAction(user.id, 'otp_send_failed', { identifier }, ipAddress, userAgent)
        return NextResponse.json({ 
          error: 'Failed to send OTP. Check your Telegram account.' 
        }, { status: 500 })
      }

      await logAuthAction(
        user.id,
        otpSent ? 'otp_sent' : 'otp_generated_development_fallback',
        { identifier },
        ipAddress,
        userAgent
      )

      return NextResponse.json({
        success: true,
        stage: 'otp',
        userId: user.id,
        message: otpSent
          ? 'OTP sent to your Telegram. Please verify.'
          : 'Telegram OTP yuborilmadi. Development rejimida kod sahifada ko‘rsatiladi.',
        devOtp: otpSent ? undefined : otp,
      })
    }

    // Stage 3: OTP verification
    if (stage === 'otp') {
      if (!userId || !otp) {
        return NextResponse.json({ error: 'Missing userId or OTP' }, { status: 400 })
      }

      const limit = checkRateLimit(request, {
        keyPrefix: 'auth:login:otp',
        keyParts: [userId],
        maxRequests: rateLimitConfig.otpMax,
        windowMs: 10 * 60 * 1000,
      })

      if (!limit.allowed) {
        return rateLimitResponse(limit, 'OTP kodi juda ko‘p marta tekshirildi. Birozdan keyin qayta urinib ko‘ring.')
      }

      const { verifyOTP } = await import('@/lib/auth-utils')
      
      const normalizedOtp = String(otp).replace(/\D/g, '').slice(0, 6)
      const isOtpValid = await verifyOTP(userId, normalizedOtp)

      if (!isOtpValid) {
        await logAuthAction(userId, 'otp_verification_failed', { userId }, ipAddress, userAgent)
        return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })
      }

      // Create session for next stage
      const { createSessionToken } = await import('@/lib/auth-utils')
      const sessionToken = await createSessionToken(userId)

      await logAuthAction(userId, 'otp_verified', { userId }, ipAddress, userAgent)

      return NextResponse.json({
        success: true,
        stage: 'facial_verification',
        sessionToken,
        userId,
        message: 'OTP verified. Proceed to facial verification.',
      })
    }

    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  } catch (error) {
    console.error('[v0] Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
