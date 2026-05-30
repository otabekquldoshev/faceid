import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUserByEmail, getUserByUsername, hashPassword, logAuthAction } from '@/lib/auth-utils'
import { isValidFacialData } from '@/lib/facial-match'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseConnectionError } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, password, telegramChatId, facialData } = body
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (!username || !email || !password || !telegramChatId || !facialData) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const limit = checkRateLimit(request, {
      keyPrefix: 'auth:register',
      keyParts: [email || username],
      maxRequests: 5,
      windowMs: 60 * 60 * 1000,
    })

    if (!limit.allowed) {
      return rateLimitResponse(limit, 'Ro‘yxatdan o‘tish urinishlari ko‘payib ketdi. 1 soatdan keyin qayta urinib ko‘ring.')
    }

    if (!isValidFacialData(facialData)) {
      return NextResponse.json({ error: 'Face verification is required before registration' }, { status: 400 })
    }

    const normalizedUsername = username.trim().toLowerCase()
    const normalizedEmail = email.trim().toLowerCase()

    if (await getUserByUsername(normalizedUsername)) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
    }

    if (await getUserByEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await createUser(normalizedUsername, normalizedEmail, passwordHash, telegramChatId.trim(), facialData)

    await logAuthAction(user.id, 'user_registered', { username: normalizedUsername, email: normalizedEmail }, ipAddress, userAgent)

    return NextResponse.json({ success: true, userId: user.id, message: 'Account created successfully' }, { status: 201 })
  } catch (error) {
    console.error('[auth-portal] Register error:', error)
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json({ error: DATABASE_UNAVAILABLE_MESSAGE }, { status: 503 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
