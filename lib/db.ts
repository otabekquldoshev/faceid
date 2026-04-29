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
