// Leegt de e2e-database. Weigert alles zonder "e2e" in de naam.
import pg from 'pg';
const url = process.env.DATABASE_URL ?? '';
if (!/e2e/.test(url)) throw new Error('Weiger: DATABASE_URL is geen e2e-database');
const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await c.end();
