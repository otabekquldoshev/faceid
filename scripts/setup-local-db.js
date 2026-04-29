const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PG_BIN = '/usr/lib/postgresql/18/bin'
const DATA_DIR = path.join(process.cwd(), '.postgres-data')
const PG_CTL = path.join(PG_BIN, 'pg_ctl')
const PSQL = path.join(PG_BIN, 'psql')
const CREATEDB = path.join(PG_BIN, 'createdb')

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

function ensurePostgresRunning() {
  try {
    execFileSync(PG_CTL, ['-D', DATA_DIR, 'status'], { stdio: 'pipe' })
    console.log('[v0] PostgreSQL is already running.')
    return
  } catch {}

  console.log('[v0] Starting local PostgreSQL...')
  execFileSync(PG_CTL, ['-D', DATA_DIR, '-l', path.join(DATA_DIR, 'postgres.log'), '-o', '-k /tmp', 'start'], {
    stdio: 'inherit',
  })
}

function ensureDatabase() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL in .env.local')
  }

  const url = new URL(databaseUrl)
  const database = url.pathname.replace(/^\//, '')
  const username = url.username || 'postgres'
  const password = url.password || ''
  const host = url.hostname || 'localhost'
  const port = url.port || '5432'
  const env = { ...process.env, PGPASSWORD: password }

  const exists = execFileSync(
    PSQL,
    [
      '-h',
      host,
      '-p',
      port,
      '-U',
      username,
      '-d',
      'postgres',
      '-Atc',
      `SELECT 1 FROM pg_database WHERE datname = '${database.replace(/'/g, "''")}'`,
    ],
    { env, encoding: 'utf8' }
  ).trim() === '1'

  if (exists) {
    console.log(`[v0] Database ${database} exists.`)
    return
  }

  console.log(`[v0] Creating database ${database}...`)
  execFileSync(CREATEDB, ['-h', host, '-p', port, '-U', username, database], { env, stdio: 'inherit' })
}

loadLocalEnv()
ensurePostgresRunning()
ensureDatabase()
require('./run-migration')
