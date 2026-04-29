import { NextRequest, NextResponse } from 'next/server'

type RateLimitOptions = {
  keyPrefix: string
  keyParts?: Array<string | number | null | undefined>
  maxRequests?: number
  windowMs?: number
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfter: number
  headers: Record<string, string>
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX_REQUESTS = 60
const buckets = new Map<string, RateLimitBucket>()
let lastCleanupAt = 0

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const rateLimitConfig = {
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  defaultWindowMs: readPositiveNumber(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
  defaultMaxRequests: readPositiveNumber(process.env.RATE_LIMIT_MAX_REQUESTS, DEFAULT_MAX_REQUESTS),
  loginPasswordMax: readPositiveNumber(process.env.AUTH_PASSWORD_RATE_LIMIT_MAX, 5),
  otpMax: readPositiveNumber(process.env.AUTH_OTP_RATE_LIMIT_MAX, 5),
  forgotPasswordMax: readPositiveNumber(process.env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX, 4),
  facialMax: readPositiveNumber(process.env.AUTH_FACE_RATE_LIMIT_MAX, 10),
}

export function getRateLimitIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const rawIp =
    forwardedFor ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'

  return rawIp.replace(/^::ffff:/, '') || 'unknown'
}

function normalizeKeyPart(value: string | number | null | undefined) {
  const normalized = String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120)

  return normalized || 'unknown'
}

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < 60 * 1000) return

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }

  lastCleanupAt = now
}

export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): RateLimitResult {
  const limit = options.maxRequests ?? rateLimitConfig.defaultMaxRequests
  const windowMs = options.windowMs ?? rateLimitConfig.defaultWindowMs

  if (!rateLimitConfig.enabled) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: Date.now() + windowMs,
      retryAfter: 0,
      headers: {},
    }
  }

  const now = Date.now()
  cleanupExpiredBuckets(now)

  const key = [
    options.keyPrefix,
    getRateLimitIp(request),
    ...(options.keyParts || []).map(normalizeKeyPart),
  ].join(':')

  const existingBucket = buckets.get(key)
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : { count: 0, resetAt: now + windowMs }

  bucket.count += 1
  buckets.set(key, bucket)

  const remaining = Math.max(0, limit - bucket.count)
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  const allowed = bucket.count <= limit
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(bucket.resetAt / 1000)),
  }

  if (!allowed) {
    headers['Retry-After'] = String(retryAfter)
  }

  return {
    allowed,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfter,
    headers,
  }
}

export function rateLimitResponse(
  result: RateLimitResult,
  message = 'Juda ko‘p urinish bo‘ldi. Birozdan keyin qayta urinib ko‘ring.'
) {
  return NextResponse.json(
    {
      error: message,
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: result.headers,
    }
  )
}

export function withRateLimitHeaders<T extends NextResponse>(
  response: T,
  result: RateLimitResult
) {
  Object.entries(result.headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
