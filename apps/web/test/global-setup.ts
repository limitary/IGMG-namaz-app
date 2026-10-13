import path from 'node:path';
import { Pool } from 'pg';
import { migrate } from '../src/server/migrate';

/** Begint elke testrun met een lege, volledig gemigreerde testdatabase. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://mescid:mescid@localhost:5432/mescid_test';
  if (!/test/.test(url)) throw new Error('Weiger tests te draaien op een database zonder "test" in de naam.');
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool, path.resolve(__dirname, '../../../database/migrations'));
  await pool.end();
}
