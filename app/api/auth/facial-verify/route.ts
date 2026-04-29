import { NextRequest, NextResponse } from 'next/server'
import { createJWT, generateOTP, logAuthAction, storeOTP } from '@/lib/auth-utils'
import { compareFacialData, isValidFacialData } from '@/lib/facial-match'
import { checkRateLimit, rateLimitConfig, rateLimitResponse } from '@/lib/rate-limit'
import { analyzeLoginRisk } from '@/lib/risk-analysis'
import { sendLoginNotification, sendRiskVerificationOTP } from '@/lib/telegram-bot'
import { query } from '@/lib/db'
import type { FacialDetectionData } from '@/lib/facial-detection'

const SUCCESS_REDIRECT_URL = 'https://my.gov.uz/uz'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionToken, facialData } = await request.json()
    const normalizedUserId = String(userId || '').trim()
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (!userId || !sessionToken || !facialData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const limit = checkRateLimit(request, {
      keyPrefix: 'auth:facial-verify',
      keyParts: [normalizedUserId, sessionToken],
      maxRequests: rateLimitConfig.facialMax,
      windowMs: 10 * 60 * 1000,
    })

    if (!limit.allowed) {
      return rateLimitResponse(limit, 'Face ID tekshiruvi juda ko‘p takrorlandi. Birozdan keyin qayta urinib ko‘ring.')
    }

    if (!UUID_PATTERN.test(normalizedUserId)) {
      return NextResponse.json(
        { error: 'Invalid user session. QR kodni qaytadan scan qiling.' },
        { status: 400 }
      )
    }

    if (!isValidFacialData(facialData)) {
      await logAuthAction(normalizedUserId, 'facial_verification_failed_bad_capture', { userId: normalizedUserId }, ipAddress, userAgent)
      return NextResponse.json(
        { error: 'Yuz profili yetarli emas. Kameraga qarab 2-3 soniya kutib qayta urinib ko‘ring.' },
        { status: 400 }
      )
    }

    const sessionResult = await query('SELECT * FROM login_sessions WHERE session_token = $1 AND user_id = $2 LIMIT 1', [sessionToken, normalizedUserId])
    const session = sessionResult.rows[0]

    if (!session || new Date(session.expires_at) < new Date()) {
      await logAuthAction(normalizedUserId, 'facial_verification_failed_invalid_session', { userId: normalizedUserId }, ipAddress, userAgent)
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    const userResult = await query<{ username: string; telegram_chat_id: string | null; facial_data: FacialDetectionData | null }>(
      'SELECT username, telegram_chat_id, facial_data FROM users WHERE id = $1 LIMIT 1',
      [normalizedUserId]
    )
    const user = userResult.rows[0]

    if (!user?.facial_data) {
      await logAuthAction(normalizedUserId, 'facial_verification_failed_missing_enrollment', { userId: normalizedUserId }, ipAddress, userAgent)
      return NextResponse.json(
        { error: 'Bu accountda yuz ma’lumoti yo‘q. Iltimos, qaytadan ro‘yxatdan o‘ting.' },
        { status: 403 }
      )
    }

    const match = compareFacialData(user.facial_data, facialData)

    if (!match.matched) {
      await logAuthAction(normalizedUserId, 'facial_verification_failed_mismatch', { score: match.score }, ipAddress, userAgent)
      return NextResponse.json(
        { error: 'Yuz mos kelmadi. Faqat ro‘yxatdan o‘tgan foydalanuvchi kira oladi.', score: match.score },
        { status: 401 }
      )
    }

    const riskAnalysis = await analyzeLoginRisk(normalizedUserId, request, match.score)

    if (riskAnalysis.requiresStepUp) {
      if (!user.telegram_chat_id) {
        await logAuthAction(
          normalizedUserId,
          'risk_step_up_failed_missing_chat_id',
          { riskAnalysis },
          ipAddress,
          userAgent
        )
        return NextResponse.json(
          { error: 'Qo‘shimcha verifikatsiya kerak, lekin Telegram Chat ID topilmadi.' },
          { status: 400 }
        )
      }

      const riskOtp = generateOTP(6)
      await storeOTP(normalizedUserId, riskOtp, 5)

      const otpSent = await sendRiskVerificationOTP(user.telegram_chat_id, user.username || 'Unknown', riskOtp, riskAnalysis)
      const allowDevelopmentOtp = process.env.NODE_ENV !== 'production'

      if (!otpSent && !allowDevelopmentOtp) {
        await logAuthAction(
          normalizedUserId,
          'risk_step_up_failed_send_otp',
          { riskAnalysis },
          ipAddress,
          userAgent
        )
        return NextResponse.json(
          { error: 'Qo‘shimcha verifikatsiya kodi Telegram botga yuborilmadi.' },
          { status: 500 }
        )
      }

      await query(
        'UPDATE login_sessions SET stage = $1, stage_data = $2 WHERE session_token = $3',
        [
          'risk_verification',
          {
            riskAnalysis,
            riskOtpSent: otpSent,
            riskDevOtp: otpSent ? undefined : riskOtp,
          },
          sessionToken,
        ]
      )

      await logAuthAction(
        normalizedUserId,
        'risk_step_up_required',
        { riskAnalysis, otpSent },
        ipAddress,
        userAgent
      )

      return NextResponse.json({
        success: true,
        stage: 'risk_verification',
        requiresAdditionalVerification: true,
        message: 'Yangi IP/location/device aniqlandi. Telegram botga qo‘shimcha verifikatsiya kodi yuborildi.',
        riskScore: riskAnalysis.score,
        riskReasons: riskAnalysis.reasons,
        riskAnalysis,
        devOtp: otpSent ? undefined : riskOtp,
      })
    }

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
      { username: user?.username, faceScore: match.score, riskAnalysis, securityContext: riskAnalysis.current },
      ipAddress,
      userAgent
    )

    const response = NextResponse.json({
      success: true,
      stage: 'completed',
      message: 'Authentication successful. Redirecting to dashboard...',
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
    console.error('[v0] Facial verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
