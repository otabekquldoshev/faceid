import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('Missing DATABASE_URL environment variable')
    }

    pool = new Pool({ connectionString })
  }

  return pool
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  let client: PoolClient | null = null
  try {
    client = await getPool().connect()
    return await client.query<T>(text, params)
  } finally {
    client?.release()
  }
}

export async function closePool() {
  if (!pool) return
  await pool.end()
}

export const DATABASE_UNAVAILABLE_MESSAGE =
  'Ma’lumotlar bazasiga ulanib bo‘lmadi. Terminalda npm run db:start buyrug‘ini ishga tushiring va qayta urinib ko‘ring.'

export function isDatabaseConnectionError(error: unknown) {
  if (error instanceof AggregateError) return true

  const message = error instanceof Error ? error.message : String(error)
  return /ECONNREFUSED|Connection terminated|connect|connection refused|ETIMEDOUT|ENOTFOUND/i.test(message)
}
