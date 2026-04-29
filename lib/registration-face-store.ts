import { randomBytes } from 'crypto'
import { query } from '@/lib/db'

type RegistrationFaceSession = {
  token: string
  facialData: unknown | null
  createdAt: string
  expiresAt: string
  completedAt: string | null
}

type RegistrationFaceSessionRow = {
  token: string
  facial_data: unknown | null
  created_at: Date | string
  expires_at: Date | string
  completed_at: Date | string | null
}

const SESSION_TTL_MS = 10 * 60 * 1000

function toIsoString(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapSession(row: RegistrationFaceSessionRow): RegistrationFaceSession {
  return {
    token: row.token,
    facialData: row.facial_data,
    createdAt: toIsoString(row.created_at) || new Date().toISOString(),
    expiresAt: toIsoString(row.expires_at) || new Date().toISOString(),
    completedAt: toIsoString(row.completed_at),
  }
}

async function pruneExpiredRegistrationFaceSessions() {
  await query('DELETE FROM registration_face_sessions WHERE expires_at < NOW()')
}

export async function createRegistrationFaceSession() {
  await pruneExpiredRegistrationFaceSessions()

  const token = randomBytes(32).toString('hex')
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS)

  const result = await query<RegistrationFaceSessionRow>(
    `INSERT INTO registration_face_sessions (token, expires_at)
     VALUES ($1, $2)
     RETURNING token, facial_data, created_at, expires_at, completed_at`,
    [token, expiresAt.toISOString()]
  )

  return mapSession(result.rows[0])
}

export async function getRegistrationFaceSession(token: string) {
  await pruneExpiredRegistrationFaceSessions()

  const result = await query<RegistrationFaceSessionRow>(
    `SELECT token, facial_data, created_at, expires_at, completed_at
     FROM registration_face_sessions
     WHERE token = $1
     LIMIT 1`,
    [token]
  )

  const session = result.rows[0]
  return session ? mapSession(session) : null
}

export async function completeRegistrationFaceSession(token: string, facialData: unknown) {
  await pruneExpiredRegistrationFaceSessions()

  const result = await query<RegistrationFaceSessionRow>(
    `UPDATE registration_face_sessions
     SET facial_data = $2, completed_at = NOW()
     WHERE token = $1 AND expires_at > NOW()
     RETURNING token, facial_data, created_at, expires_at, completed_at`,
    [token, facialData]
  )

  const session = result.rows[0]
  return session ? mapSession(session) : null
}
