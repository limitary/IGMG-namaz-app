import { Pool, type PoolClient, types } from 'pg';

// DATE-kolommen als "YYYY-MM-DD"-tekst teruggeven, nooit als JavaScript-Date
// (die zou de lokale tijdzone van de server erin mengen).
types.setTypeParser(1082, (v: string) => v);

declare global {
  // eslint-disable-next-line no-var
  var __mescidPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__mescidPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL ontbreekt. Zie .env.example.');
    globalThis.__mescidPool = new Pool({ connectionString, max: 10 });
  }
  return globalThis.__mescidPool;
}

export type Db = Pick<PoolClient, 'query'>;

export async function query<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(sql, params);
  return res.rows as T[];
}

/** Voert `fn` uit in één databasetransactie: alles of niets. */
export async function tx<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
