const { Pool } = require('pg')
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
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in .env.local')
  }

  if (!process.env.TELEGRAM_CHAT_ID) {
    throw new Error('Missing TELEGRAM_CHAT_ID in .env.local')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const result = await pool.query(
      'UPDATE users SET telegram_chat_id = $1, updated_at = NOW() RETURNING username, email',
      [process.env.TELEGRAM_CHAT_ID]
    )

    console.log(`[auth-portal] Updated Telegram Chat ID for ${result.rowCount} user(s).`)
    for (const user of result.rows) {
      console.log(`[auth-portal] - ${user.username} <${user.email}>`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[auth-portal] Telegram Chat ID sync failed:', error.message)
  process.exit(1)
})
