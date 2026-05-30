const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    if (key && !process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, '')
    }
  }
}

loadLocalEnv()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[auth-portal] Missing DATABASE_URL environment variable')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })

async function runMigration() {
  try {
    console.log('[auth-portal] Reading migration file...')
    const migrationPath = path.join(process.cwd(), 'scripts', '01-setup-auth-tables.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    console.log('[auth-portal] Executing migration...')
    await pool.query(sql)

    console.log('[auth-portal] Migration completed successfully!')
  } catch (err) {
    console.error('[auth-portal] Error running migration:', {
      message: err instanceof Error ? err.message : String(err),
      code: err && typeof err === 'object' && 'code' in err ? err.code : undefined,
      detail: err && typeof err === 'object' && 'detail' in err ? err.detail : undefined,
      hint: err && typeof err === 'object' && 'hint' in err ? err.hint : undefined,
    })
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigration()
