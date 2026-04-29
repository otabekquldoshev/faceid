import { NextRequest, NextResponse } from 'next/server'
import { createJWT, logAuthAction, verifyOTP } from '@/lib/auth-utils'
import { checkRateLimit, rateLimitConfig, rateLimitResponse } from '@/lib/rate-limit'
import { query } from '@/lib/db'
import { sendLoginNotification } from '@/lib/telegram-bot'

const SUCCESS_REDIRECT_URL = 'https://my.gov.uz/uz'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionToken, otp } = await request.json()
    const normalizedUserId = String(userId || '').trim()
    const normalizedOtp = String(otp || '').replace(/\D/g, '').slice(0, 6)
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (!UUID_PATTERN.test(normalizedUserId) || !sessionToken || normalizedOtp.length !== 6) {
      return NextResponse.json({ error: 'Qo‘shimcha verifikatsiya ma’lumotlari noto‘g‘ri.' }, { status: 400 })
    }

    const limit = checkRateLimit(request, {
      keyPrefix: 'auth:risk-verify',
      keyParts: [normalizedUserId, sessionToken],
      maxRequests: rateLimitConfig.otpMax,
      windowMs: 10 * 60 * 1000,
    })

    if (!limit.allowed) {
      return rateLimitResponse(limit, 'Qo‘shimcha verifikatsiya kodi juda ko‘p tekshirildi. Birozdan keyin qayta urinib ko‘ring.')
    }

    const sessionResult = await query<{
      id: string
      stage: string
      stage_data: unknown
      expires_at: Date | string
    }>(
      'SELECT id, stage, stage_data, expires_at FROM login_sessions WHERE session_token = $1 AND user_id = $2 LIMIT 1',
      [sessionToken, normalizedUserId]
    )
    const session = sessionResult.rows[0]

    if (!session || new Date(session.expires_at) < new Date()) {
      await logAuthAction(normalizedUserId, 'risk_step_up_failed_invalid_session', { userId: normalizedUserId }, ipAddress, userAgent)
      return NextResponse.json({ error: 'Sessiya muddati tugagan. Qaytadan login qiling.' }, { status: 401 })
    }

    if (session.stage !== 'risk_verification') {
      return NextResponse.json({ error: 'Bu sessiya qo‘shimcha verifikatsiya kutmayapti.' }, { status: 400 })
    }

    const isOtpValid = await verifyOTP(normalizedUserId, normalizedOtp)

    if (!isOtpValid) {
      await logAuthAction(normalizedUserId, 'risk_step_up_failed', { userId: normalizedUserId }, ipAddress, userAgent)
      return NextResponse.json({ error: 'Qo‘shimcha verifikatsiya kodi noto‘g‘ri yoki muddati tugagan.' }, { status: 401 })
    }

    const userResult = await query<{ username: string; telegram_chat_id: string | null }>(
      'SELECT username, telegram_chat_id FROM users WHERE id = $1 LIMIT 1',
      [normalizedUserId]
    )
    const user = userResult.rows[0]

    await query(
      'UPDATE login_sessions SET completed_at = NOW(), stage = $1 WHERE session_token = $2',
      ['completed', sessionToken]
    )

    if (user?.telegram_chat_id) {
      await sendLoginNotification(user.telegram_chat_id, user.username || 'Unknown', new Date().toLocaleString())
    }

    const jwtToken = createJWT(normalizedUserId, session.id)

    await logAuthAction(
      normalizedUserId,
      'login_successful',
      { username: user?.username, riskVerified: true, stageData: session.stage_data },
      ipAddress,
      userAgent
    )

    const response = NextResponse.json({
      success: true,
      stage: 'completed',
      message: 'Qo‘shimcha verifikatsiya tasdiqlandi.',
      redirectUrl: SUCCESS_REDIRECT_URL,
      token: jwtToken,
    })

    response.cookies.set('auth_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[v0] Risk verification error:', error)
    return NextResponse.json({ error: 'Qo‘shimcha verifikatsiyani tekshirishda xatolik yuz berdi.' }, { status: 500 })
  }
}
