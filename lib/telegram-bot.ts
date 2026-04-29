import { Telegraf } from 'telegraf'
import type { RiskAnalysis } from '@/lib/risk-analysis'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

if (!TELEGRAM_BOT_TOKEN) {
  console.warn('[v0] TELEGRAM_BOT_TOKEN not set. OTP sending will not work.')
}

let bot: Telegraf | null = null

// Initialize bot
export function initTelegramBot() {
  if (!TELEGRAM_BOT_TOKEN) return
  bot = new Telegraf(TELEGRAM_BOT_TOKEN)
  return bot
}

// Send OTP via Telegram
export async function sendOTPViaTelegram(chatId: string, username: string, otpCode: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[v0] Telegram bot token not configured')
    return false
  }

  try {
    const message = `🔐 *Authentication OTP*

Username: \`${username}\`
Code: \`${otpCode}\`
Valid for: 3 minutes

⚠️ Never share this code with anyone!`

    const response = await fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    const result = await response.json()
    
    if (!result.ok) {
      console.error('[v0] Telegram error:', result.description)
      return false
    }

    console.log('[v0] OTP sent successfully to Telegram')
    return true
  } catch (error) {
    console.error('[v0] Error sending OTP to Telegram:', error)
    return false
  }
}

// Send alert to admin
export async function sendTelegramAlert(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return false
  }

  try {
    const response = await fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    const result = await response.json()
    return result.ok
  } catch (error) {
    console.error('[v0] Error sending alert:', error)
    return false
  }
}

// Send login notification
export async function sendLoginNotification(chatId: string, username: string, timestamp: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    return false
  }

  try {
    const message = `✅ *Successful Login*

Username: \`${username}\`
Time: ${timestamp}

If this wasn't you, please secure your account immediately!`

    const response = await fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    const result = await response.json()
    return result.ok
  } catch (error) {
    console.error('[v0] Error sending login notification:', error)
    return false
  }
}

export async function sendRiskVerificationOTP(
  chatId: string,
  username: string,
  otpCode: string,
  riskAnalysis: RiskAnalysis
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    return false
  }

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

    const response = await fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    })

    const result = await response.json()
    return Boolean(result.ok)
  } catch (error) {
    console.error('[v0] Error sending risk verification OTP:', error)
    return false
  }
}
