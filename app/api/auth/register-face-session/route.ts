import { NextRequest, NextResponse } from 'next/server'
import {
  completeRegistrationFaceSession,
  createRegistrationFaceSession,
  getRegistrationFaceSession,
} from '@/lib/registration-face-store'
import { isValidFacialData } from '@/lib/facial-match'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseConnectionError } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = String(body.action || '')

    if (action === 'create') {
      const limit = checkRateLimit(request, {
        keyPrefix: 'auth:register-face:create',
        maxRequests: 10,
        windowMs: 15 * 60 * 1000,
      })

      if (!limit.allowed) {
        return rateLimitResponse(limit, 'Face ID QR sessiya juda ko‘p yaratildi. Birozdan keyin qayta urinib ko‘ring.')
      }

      const session = await createRegistrationFaceSession()
      return NextResponse.json({
        token: session.token,
        expiresAt: session.expiresAt,
      })
    }

    if (action === 'complete') {
      const token = String(body.token || '')
      const facialData = body.facialData

      if (!token || !facialData) {
        return NextResponse.json({ error: 'Token and facial data are required' }, { status: 400 })
      }

      const limit = checkRateLimit(request, {
        keyPrefix: 'auth:register-face:complete',
        keyParts: [token],
        maxRequests: 8,
        windowMs: 10 * 60 * 1000,
      })

      if (!limit.allowed) {
        return rateLimitResponse(limit, 'Face ID ro‘yxatga olish juda ko‘p takrorlandi. Birozdan keyin qayta urinib ko‘ring.')
      }

      if (!isValidFacialData(facialData)) {
        return NextResponse.json({
          error: 'Yuz profili yetarli emas. Kameraga qarab 2-3 soniya kutib qayta urinib ko‘ring.',
        }, { status: 400 })
      }

      const session = await completeRegistrationFaceSession(token, facialData)
      if (!session) {
        return NextResponse.json({ error: 'Face ID sessiya muddati tugagan. QR kodni qaytadan oching.' }, { status: 410 })
      }

      return NextResponse.json({
        success: true,
        completed: true,
        message: 'Face ID ro‘yxatga olish yakunlandi.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[auth-portal] Registration face session error:', error)
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json({ error: DATABASE_UNAVAILABLE_MESSAGE }, { status: 503 })
    }

    return NextResponse.json({ error: 'Face ID sessiyasini qayta ishlashda xatolik yuz berdi.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || ''
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const session = await getRegistrationFaceSession(token)
    if (!session) {
      return NextResponse.json({ expired: true, completed: false }, { status: 200 })
    }

    return NextResponse.json({
      completed: Boolean(session.completedAt && session.facialData),
      expired: false,
      facialData: session.completedAt ? session.facialData : null,
      expiresAt: session.expiresAt,
    })
  } catch (error) {
    console.error('[auth-portal] Registration face status error:', error)
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json({ error: DATABASE_UNAVAILABLE_MESSAGE }, { status: 503 })
    }

    return NextResponse.json({ error: 'Face ID sessiyasini tekshirishda xatolik yuz berdi.' }, { status: 500 })
  }
}
