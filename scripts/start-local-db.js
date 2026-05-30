const { execFileSync } = require('child_process')
const path = require('path')

const PG_BIN = '/usr/lib/postgresql/18/bin'
const DATA_DIR = path.join(process.cwd(), '.postgres-data')
const PG_CTL = path.join(PG_BIN, 'pg_ctl')

function isPostgresRunning() {
  try {
    execFileSync(PG_CTL, ['-D', DATA_DIR, 'status'], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

if (isPostgresRunning()) {
  console.log('[auth-portal] PostgreSQL is already running.')
  process.exit(0)
}

try {
  console.log('[auth-portal] Starting local PostgreSQL...')
  execFileSync(
    PG_CTL,
    ['-D', DATA_DIR, '-l', path.join(DATA_DIR, 'postgres.log'), '-o', '-k /tmp', 'start'],
    { stdio: 'inherit' }
  )
} catch (error) {
  if (isPostgresRunning()) {
    console.log('[auth-portal] PostgreSQL is running.')
    process.exit(0)
  }

  throw error
}
