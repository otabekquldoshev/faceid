import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP, createSessionToken } from '@/lib/auth-utils'
import { checkRateLimit, rateLimitConfig, rateLimitResponse } from '@/lib/rate-limit'
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseConnectionError } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { userId, otp } = await request.json()

    if (!userId || !otp) {
      return NextResponse.json(
        { error: 'User ID and OTP are required' },
        { status: 400 }
      )
    }

    const limit = checkRateLimit(request, {
      keyPrefix: 'auth:verify-otp',
      keyParts: [userId],
      maxRequests: rateLimitConfig.otpMax,
      windowMs: 10 * 60 * 1000,
    })

    if (!limit.allowed) {
      return rateLimitResponse(limit, 'OTP kodi juda ko‘p marta tekshirildi. Birozdan keyin qayta urinib ko‘ring.')
    }

    // Verify OTP
    const isValid = await verifyOTP(userId, otp)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 401 }
      )
    }

    // Create session token
    const sessionToken = await createSessionToken(userId)

    return NextResponse.json(
      {
        success: true,
        sessionToken,
        userId,
        message: 'OTP verified successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[auth-portal] OTP verification error:', error)
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json({ error: DATABASE_UNAVAILABLE_MESSAGE }, { status: 503 })
    }

    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
