import { NextRequest, NextResponse } from 'next/server'
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseConnectionError, query } from '@/lib/db'

const SUCCESS_REDIRECT_URL = 'https://my.gov.uz/uz'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionToken = searchParams.get('session')
    const userId = searchParams.get('user')

    if (!sessionToken || !userId) {
      return NextResponse.json({ error: 'Missing session or user' }, { status: 400 })
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    }

    const result = await query<{
      stage: string
      stage_data: unknown
      completed_at: string | null
      expires_at: string
    }>(
      'SELECT stage, stage_data, completed_at, expires_at FROM login_sessions WHERE session_token = $1 AND user_id = $2 LIMIT 1',
      [sessionToken, userId]
    )

    const session = result.rows[0]
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const expired = new Date(session.expires_at) < new Date()

    const completed = session.stage === 'completed' && Boolean(session.completed_at)
    const stageData = typeof session.stage_data === 'object' && session.stage_data !== null
      ? session.stage_data as Record<string, unknown>
      : {}
    const riskRequired = session.stage === 'risk_verification'

    return NextResponse.json({
      completed,
      expired,
      riskRequired,
      stage: session.stage,
      riskAnalysis: riskRequired ? stageData.riskAnalysis || null : null,
      devOtp: riskRequired && process.env.NODE_ENV !== 'production' ? stageData.riskDevOtp || undefined : undefined,
      redirectUrl: completed ? SUCCESS_REDIRECT_URL : null,
    })
  } catch (error) {
    console.error('[auth-portal] Session status error:', error)
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json({ error: DATABASE_UNAVAILABLE_MESSAGE }, { status: 503 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
