import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'
import { query } from '@/lib/db'

export type SecurityLocation = {
  city: string | null
  region: string | null
  country: string | null
  label: string
  source: 'headers' | 'ip-api' | 'unknown'
}

export type SecurityDevice = {
  type: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
  os: string
  browser: string
  label: string
  fingerprint: string
}

export type SecurityBehavior = {
  recentFailedAttempts: number
  recentLoginCount: number
  loginHourUtc: number
  faceScore: number
}

export type SecurityContext = {
  ipAddress: string
  ipSubnet: string | null
  location: SecurityLocation
  device: SecurityDevice
  behavior: SecurityBehavior
}

export type RiskAnalysis = {
  score: number
  requiresStepUp: boolean
  reasons: string[]
  current: SecurityContext
  previous: {
    ipAddress: string | null
    location: SecurityLocation | null
    device: SecurityDevice | null
    lastLoginAt: string | null
  } | null
  signals: {
    ipChanged: boolean
    locationChanged: boolean
    deviceChanged: boolean
    unusualBehavior: boolean
  }
}

type PreviousLoginRow = {
  ip_address: string | null
  user_agent: string | null
  created_at: Date | string | null
  details: unknown
}

type CountRow = {
  count: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNestedRecord(value: unknown, key: string) {
  if (!isRecord(value)) return null
  const nested = value[key]
  return isRecord(nested) ? nested : null
}

function getHeader(request: NextRequest, names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name)
    if (value?.trim()) return value.trim()
  }

  return null
}

function decodeHeader(value: string | null) {
  if (!value) return null

  try {
    return decodeURIComponent(value).trim() || null
  } catch {
    return value.trim() || null
  }
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const rawIp = forwardedFor || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown'
  const withoutPrefix = rawIp.replace(/^::ffff:/, '')

  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(withoutPrefix)) {
    return withoutPrefix.split(':')[0]
  }

  return withoutPrefix || 'unknown'
}

function getIpSubnet(ipAddress: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ipAddress)) {
    return ipAddress.split('.').slice(0, 3).join('.') + '.0/24'
  }

  if (ipAddress.includes(':') && ipAddress !== '::1') {
    return ipAddress.split(':').slice(0, 4).join(':') + '::/64'
  }

  return null
}

function isPublicIp(ipAddress: string) {
  if (ipAddress === 'unknown' || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'localhost') {
    return false
  }

  const match = ipAddress.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return true

  const first = Number(match[1])
  const second = Number(match[2])

  if (first === 10) return false
  if (first === 172 && second >= 16 && second <= 31) return false
  if (first === 192 && second === 168) return false
  if (first === 169 && second === 254) return false

  return true
}

function createLocation(city: string | null, region: string | null, country: string | null, source: SecurityLocation['source']) {
  const parts = [city, region, country].filter(Boolean)

  return {
    city,
    region,
    country,
    label: parts.length ? parts.join(', ') : 'Unknown',
    source,
  }
}

async function resolveLocationFromIp(ipAddress: string) {
  if (!isPublicIp(ipAddress)) return createLocation(null, null, null, 'unknown')

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=status,country,regionName,city,query`,
      { signal: AbortSignal.timeout(900) }
    )
    const data: unknown = await response.json()

    if (!response.ok || !isRecord(data) || data.status !== 'success') {
      return createLocation(null, null, null, 'unknown')
    }

    return createLocation(
      readString(data.city),
      readString(data.regionName),
      readString(data.country),
      'ip-api'
    )
  } catch {
    return createLocation(null, null, null, 'unknown')
  }
}

async function getRequestLocation(request: NextRequest, ipAddress: string) {
  const city = decodeHeader(getHeader(request, ['x-vercel-ip-city', 'x-ngrok-client-city', 'cf-ipcity']))
  const region = decodeHeader(getHeader(request, ['x-vercel-ip-country-region', 'x-ngrok-client-region', 'cf-region']))
  const country = decodeHeader(getHeader(request, ['x-vercel-ip-country', 'x-ngrok-client-country', 'cf-ipcountry']))

  if (city || region || country) {
    return createLocation(city, region, country, 'headers')
  }

  return resolveLocationFromIp(ipAddress)
}

function detectDevice(userAgent: string): SecurityDevice {
  const lower = userAgent.toLowerCase()
  const type: SecurityDevice['type'] = /bot|crawler|spider/.test(lower)
    ? 'bot'
    : /ipad|tablet/.test(lower)
      ? 'tablet'
      : /mobile|iphone|android/.test(lower)
        ? 'mobile'
        : userAgent === 'unknown'
          ? 'unknown'
          : 'desktop'
  const os = /windows/.test(lower)
    ? 'Windows'
    : /iphone|ipad|ios/.test(lower)
      ? 'iOS'
      : /android/.test(lower)
        ? 'Android'
        : /mac os|macintosh/.test(lower)
          ? 'macOS'
          : /linux/.test(lower)
            ? 'Linux'
            : 'Unknown OS'
  const browser = /edg\//.test(lower)
    ? 'Edge'
    : /firefox\//.test(lower)
      ? 'Firefox'
      : /chrome\//.test(lower) || /crios\//.test(lower)
        ? 'Chrome'
        : /safari\//.test(lower)
          ? 'Safari'
          : 'Unknown Browser'
  const label = [type, os, browser].join(' / ')
  const fingerprint = createHash('sha256').update(label).digest('hex').slice(0, 20)

  return { type, os, browser, label, fingerprint }
}

function getStoredSecurityContext(details: unknown): SecurityContext | null {
  const riskAnalysis = readNestedRecord(details, 'riskAnalysis')
  const currentFromRisk = readNestedRecord(riskAnalysis, 'current')
  const directContext = readNestedRecord(details, 'securityContext')
  const context = currentFromRisk || directContext

  if (!context) return null

  const ipAddress = readString(context.ipAddress)
  const location = readNestedRecord(context, 'location')
  const device = readNestedRecord(context, 'device')

  if (!ipAddress || !location || !device) return null

  return {
    ipAddress,
    ipSubnet: readString(context.ipSubnet),
    location: createLocation(
      readString(location.city),
      readString(location.region),
      readString(location.country),
      location.source === 'headers' || location.source === 'ip-api' ? location.source : 'unknown'
    ),
    device: {
      type:
        device.type === 'desktop' || device.type === 'mobile' || device.type === 'tablet' || device.type === 'bot'
          ? device.type
          : 'unknown',
      os: readString(device.os) || 'Unknown OS',
      browser: readString(device.browser) || 'Unknown Browser',
      label: readString(device.label) || 'unknown / Unknown OS / Unknown Browser',
      fingerprint: readString(device.fingerprint) || '',
    },
    behavior: {
      recentFailedAttempts: 0,
      recentLoginCount: 0,
      loginHourUtc: new Date().getUTCHours(),
      faceScore: 0,
    },
  }
}

function locationKey(location: SecurityLocation | null) {
  if (!location || location.label === 'Unknown') return null
  return [location.country, location.region, location.city]
    .filter(Boolean)
    .join('|')
    .toLowerCase()
}

function isDifferentLocation(previous: SecurityLocation | null, current: SecurityLocation) {
  const previousKey = locationKey(previous)
  const currentKey = locationKey(current)
  return Boolean(previousKey && currentKey && previousKey !== currentKey)
}

function formatChange(previous: string | null, current: string) {
  return `${previous || 'unknown'} -> ${current || 'unknown'}`
}

export async function analyzeLoginRisk(userId: string, request: NextRequest, faceScore: number): Promise<RiskAnalysis> {
  const ipAddress = getClientIp(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const location = await getRequestLocation(request, ipAddress)
  const device = detectDevice(userAgent)

  const [previousResult, failuresResult, loginsResult] = await Promise.all([
    query<PreviousLoginRow>(
      `SELECT ip_address, user_agent, details, created_at
       FROM auth_audit_logs
       WHERE user_id = $1
         AND action = 'login_successful'
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    ),
    query<CountRow>(
      `SELECT COUNT(*)::int AS count
       FROM auth_audit_logs
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '1 hour'
         AND action IN (
          'login_failed_invalid_password',
          'otp_verification_failed',
          'facial_verification_failed_mismatch',
          'facial_verification_failed_bad_capture',
          'risk_step_up_failed'
         )`,
      [userId]
    ),
    query<CountRow>(
      `SELECT COUNT(*)::int AS count
       FROM auth_audit_logs
       WHERE user_id = $1
         AND action = 'login_successful'
         AND created_at > NOW() - INTERVAL '10 minutes'`,
      [userId]
    ),
  ])

  const recentFailedAttempts = failuresResult.rows[0]?.count || 0
  const recentLoginCount = loginsResult.rows[0]?.count || 0
  const current: SecurityContext = {
    ipAddress,
    ipSubnet: getIpSubnet(ipAddress),
    location,
    device,
    behavior: {
      recentFailedAttempts,
      recentLoginCount,
      loginHourUtc: new Date().getUTCHours(),
      faceScore,
    },
  }

  const previousRow = previousResult.rows[0]
  const storedContext = previousRow ? getStoredSecurityContext(previousRow.details) : null
  const previousDevice = storedContext?.device || (previousRow?.user_agent ? detectDevice(previousRow.user_agent) : null)
  const previousIp = storedContext?.ipAddress || previousRow?.ip_address || null
  const previousLocation = storedContext?.location || null
  const lastLoginAt = previousRow?.created_at ? new Date(previousRow.created_at).toISOString() : null

  const ipChanged = Boolean(previousIp && previousIp !== ipAddress)
  const deviceChanged = Boolean(previousDevice?.fingerprint && previousDevice.fingerprint !== device.fingerprint)
  const locationChanged = isDifferentLocation(previousLocation, location)
  const unusualBehavior = recentFailedAttempts >= 3 || recentLoginCount >= 3 || faceScore < 82

  let score = previousRow ? 10 : 5
  const reasons: string[] = []

  if (ipChanged) {
    score += 30
    reasons.push(`IP address o‘zgardi: ${formatChange(previousIp, ipAddress)}`)
  }

  if (locationChanged) {
    score += 30
    reasons.push(`Location o‘zgardi: ${formatChange(previousLocation?.label || null, location.label)}`)
  } else if (ipChanged && location.label === 'Unknown') {
    score += 10
    reasons.push('Location aniqlanmadi, lekin IP address o‘zgargan.')
  }

  if (deviceChanged) {
    score += 25
    reasons.push(`Device o‘zgardi: ${formatChange(previousDevice?.label || null, device.label)}`)
  }

  if (recentFailedAttempts >= 3) {
    score += 20
    reasons.push(`Behavior: oxirgi 1 soatda ${recentFailedAttempts} ta muvaffaqiyatsiz urinish bor.`)
  }

  if (recentLoginCount >= 3) {
    score += 10
    reasons.push(`Behavior: oxirgi 10 daqiqada ${recentLoginCount} ta login bor.`)
  }

  if (faceScore < 82) {
    score += 15
    reasons.push(`Behavior: Face ID score pastroq (${faceScore}).`)
  } else if (faceScore < 90) {
    score += 8
    reasons.push(`Behavior: Face ID score chegaraga yaqin (${faceScore}).`)
  }

  score = Math.min(100, score)

  return {
    score,
    requiresStepUp: Boolean(previousRow && (ipChanged || locationChanged || deviceChanged)) || score >= 50,
    reasons,
    current,
    previous: previousRow
      ? {
          ipAddress: previousIp,
          location: previousLocation,
          device: previousDevice,
          lastLoginAt,
        }
      : null,
    signals: {
      ipChanged,
      locationChanged,
      deviceChanged,
      unusualBehavior,
    },
  }
}
