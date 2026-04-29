import bcryptjs from 'bcryptjs'
import { randomBytes, randomInt } from 'crypto'
import jwt from 'jsonwebtoken'
import { query } from '@/lib/db'
import type { FacialDetectionData } from '@/lib/facial-detection'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10)
  return bcryptjs.hash(password, salt)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash)
}

// Generate OTP
export function generateOTP(length: number = 6): string {
  const max = 10 ** length
  return randomInt(0, max).toString().padStart(length, '0')
}

// Create JWT token
export function createJWT(userId: string, sessionId: string): string {
  return jwt.sign(
    { userId, sessionId },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
}

// Verify JWT token
export function verifyJWT(token: string): { userId: string; sessionId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; sessionId: string }
    return decoded
  } catch {
    return null
  }
}

// Create login session
export async function createLoginSession(userId: string, stage: string = 'username') {
  const sessionToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

  const result = await query<{ id: string }>(
    'INSERT INTO login_sessions (user_id, session_token, stage, expires_at) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, sessionToken, stage, expiresAt.toISOString()]
  )

  return { sessionToken, sessionId: result.rows[0].id }
}

// Get login session
export async function getLoginSession(sessionToken: string) {
  const result = await query('SELECT * FROM login_sessions WHERE session_token = $1 LIMIT 1', [sessionToken])
  const session = result.rows[0]

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null
  return session
}

// Update login session
export async function updateLoginSession(sessionToken: string, updates: Record<string, unknown>) {
  const keys = Object.keys(updates)
  if (keys.length === 0) {
    throw new Error('No updates provided')
  }

  const sets = keys.map((key, index) => `${key} = $${index + 1}`).join(', ')
  const values = keys.map((key) => updates[key])
  values.push(sessionToken)

  const result = await query(
    `UPDATE login_sessions SET ${sets} WHERE session_token = $${values.length} RETURNING *`,
    values
  )

  const updatedSession = result.rows[0]
  if (!updatedSession) {
    throw new Error('Session not found')
  }

  return updatedSession
}

// Store OTP
export async function storeOTP(userId: string, otpCode: string, expiryMinutes: number = 3) {
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

  await query(
    'UPDATE otp_records SET is_used = true WHERE user_id = $1 AND is_used = false',
    [userId]
  )

  const result = await query<{ id: string }>(
    'INSERT INTO otp_records (user_id, otp_code, expires_at) VALUES ($1, $2, $3) RETURNING id',
    [userId, otpCode, expiresAt.toISOString()]
  )

  return result.rows[0]
}

// Verify OTP
export async function verifyOTP(userId: string, otpCode: string): Promise<boolean> {
  const normalizedOtp = otpCode.trim()

  const result = await query(
    'SELECT * FROM otp_records WHERE user_id = $1 AND otp_code = $2 AND is_used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
    [userId, normalizedOtp]
  )

  const record = result.rows[0]
  if (!record) return false

  await query('UPDATE otp_records SET is_used = true, verified_at = NOW() WHERE id = $1', [record.id])

  return true
}

// Create user
export async function createUser(
  username: string,
  email: string,
  passwordHash: string,
  telegramChatId?: string,
  facialData?: FacialDetectionData
) {
  const existingUsername = await getUserByUsername(username)
  if (existingUsername) {
    throw new Error('Username already exists')
  }

  const existingEmail = await getUserByEmail(email)
  if (existingEmail) {
    throw new Error('Email already registered')
  }

  const result = await query(
    'INSERT INTO users (username, email, password_hash, telegram_chat_id, facial_data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [username, email, passwordHash, telegramChatId || null, facialData || null]
  )

  return result.rows[0]
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  )
}

export async function findUserByUsernameOrEmail(identifier: string) {
  const usernameUser = await getUserByUsername(identifier)
  if (usernameUser) return usernameUser
  return await getUserByEmail(identifier)
}

// Get user by username
export async function getUserByUsername(username: string) {
  const result = await query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username])
  return result.rows[0] || null
}

// Get user by email
export async function getUserByEmail(email: string) {
  const result = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email])
  return result.rows[0] || null
}

// Get user by id
export async function getUserById(id: string) {
  const result = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id])
  return result.rows[0] || null
}

// Create session token
export async function createSessionToken(userId: string, expiryHours: number = 24): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

  await query(
    'INSERT INTO login_sessions (user_id, session_token, stage, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, token, 'completed', expiresAt.toISOString()]
  )

  return token
}

// Get session by token
export async function getSessionByToken(token: string) {
  const result = await query('SELECT * FROM login_sessions WHERE session_token = $1 LIMIT 1', [token])
  const session = result.rows[0]
  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null
  return session
}

// Audit log
export async function logAuthAction(userId: string | null, action: string, details: unknown, ipAddress?: string, userAgent?: string) {
  await query(
    'INSERT INTO auth_audit_logs (user_id, action, details, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
    [userId, action, details, ipAddress, userAgent]
  )
}
