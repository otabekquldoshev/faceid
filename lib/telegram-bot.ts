import fs from 'fs'
import path from 'path'
import { Telegraf } from 'telegraf'
import type { RiskAnalysis } from '@/lib/risk-analysis'

type TelegramConfig = {
  botToken?: string
  chatId?: string
}

let bot: Telegraf | null = null
let botTokenForInstance: string | null = null

function readLocalEnv() {
  const values: Record<string, string> = {}

  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return values

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) continue

      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
      if (key) values[key] = value
    }
  } catch (error) {
    console.warn('[auth-portal] Could not read .env.local for Telegram config:', error)
  }

  return values
}

export function getTelegramConfig(): TelegramConfig {
  const localEnv = process.env.NODE_ENV === 'production' ? {} : readLocalEnv()

  return {
    botToken: localEnv.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
    chatId: localEnv.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID,
  }
}

function maskToken(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : 'configured'
}

export function getTelegramTargetChatId(fallbackChatId?: string) {
  const { chatId } = getTelegramConfig()
  return String(chatId || fallbackChatId || '').trim()
}

export function initTelegramBot() {
  const { botToken } = getTelegramConfig()
  if (!botToken) return null

  if (!bot || botTokenForInstance !== botToken) {
    bot = new Telegraf(botToken)
    botTokenForInstance = botToken
  }

  return bot
}

async function sendTelegramMessage(chatId: string | undefined, text: string, parseMode?: 'Markdown') {
  const { botToken } = getTelegramConfig()
  const targetChatId = getTelegramTargetChatId(chatId)

  if (!botToken) {
    console.warn('[auth-portal] TELEGRAM_BOT_TOKEN not set. OTP sending will not work.')
    return false
  }

  if (!targetChatId) {
    console.warn('[auth-portal] TELEGRAM_CHAT_ID not set and no user chat ID was provided.')
    return false
  }

  console.log(`[auth-portal] Sending Telegram message via bot ${maskToken(botToken)} to chat ${targetChatId}`)

  const response = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: targetChatId,
      text,
      parse_mode: parseMode,
    }),
  })

  const result = await response.json()

  if (!result.ok) {
    console.error('[auth-portal] Telegram error:', result.description)
    return false
  }

  return true
}

// Send OTP via Telegram
export async function sendOTPViaTelegram(chatId: string, username: string, otpCode: string): Promise<boolean> {
  try {
    const message = `🔐 *Authentication OTP*

Username: \`${username}\`
Code: \`${otpCode}\`
Valid for: 3 minutes

⚠️ Never share this code with anyone!`

    const sent = await sendTelegramMessage(chatId, message, 'Markdown')
    if (sent) console.log('[auth-portal] OTP sent successfully to Telegram')
    return sent
  } catch (error) {
    console.error('[auth-portal] Error sending OTP to Telegram:', error)
    return false
  }
}

// Send alert to admin
export async function sendTelegramAlert(message: string): Promise<boolean> {
  const { chatId } = getTelegramConfig()
  if (!chatId) return false

  try {
    return await sendTelegramMessage(chatId, message, 'Markdown')
  } catch (error) {
    console.error('[auth-portal] Error sending alert:', error)
    return false
  }
}

// Send login notification
export async function sendLoginNotification(chatId: string, username: string, timestamp: string): Promise<boolean> {
  try {
    const message = `✅ *Successful Login*

Username: \`${username}\`
Time: ${timestamp}

If this wasn't you, please secure your account immediately!`

    return await sendTelegramMessage(chatId, message, 'Markdown')
  } catch (error) {
    console.error('[auth-portal] Error sending login notification:', error)
    return false
  }
}

export async function sendRiskVerificationOTP(
  chatId: string,
  username: string,
  otpCode: string,
  riskAnalysis: RiskAnalysis
): Promise<boolean> {
  try {
    const reasons = riskAnalysis.reasons.length
      ? riskAnalysis.reasons.map((reason) => `- ${reason}`).join('\n')
      : '- Past risk, lekin qo‘shimcha tekshiruv yoqilgan.'
    const behavior = riskAnalysis.current.behavior
    const message = `⚠️ Qo‘shimcha verifikatsiya kerak

Username: ${username}
Verification code: ${otpCode}
Valid for: 5 minutes

Risk score: ${riskAnalysis.score}/100
IP address: ${riskAnalysis.current.ipAddress}
Location: ${riskAnalysis.current.location.label}
Device: ${riskAnalysis.current.device.label}
Behavior: failed attempts=${behavior.recentFailedAttempts}, recent logins=${behavior.recentLoginCount}, face score=${behavior.faceScore}

Reasons:
${reasons}

Agar bu siz bo‘lmasangiz, parolingizni darhol almashtiring.`

    return await sendTelegramMessage(chatId, message)
  } catch (error) {
    console.error('[auth-portal] Error sending risk verification OTP:', error)
    return false
  }
}
