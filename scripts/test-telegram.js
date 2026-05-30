const fs = require('fs')
const path = require('path')

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken) throw new Error('Missing TELEGRAM_BOT_TOKEN in .env.local')
  if (!chatId) throw new Error('Missing TELEGRAM_CHAT_ID in .env.local')

  const response = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Auth portal test message. If you see this, the current .env.local Telegram bot is connected.',
    }),
  })

  const result = await response.json()

  if (!result.ok) {
    throw new Error(result.description || 'Telegram request failed')
  }

  console.log('[auth-portal] Telegram test message sent successfully.')
}

main().catch((error) => {
  console.error('[auth-portal] Telegram test failed:', error.message)
  process.exit(1)
})
