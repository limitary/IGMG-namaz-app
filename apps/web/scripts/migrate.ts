import './env';
import path from 'node:path';
import { getPool } from '../src/server/db';
import { migrate } from '../src/server/migrate';

const dir = path.resolve(__dirname, '../../../database/migrations');
migrate(getPool(), dir, console.log)
  .then((done) => {
    console.log(done.length ? `${done.length} migratie(s) toegepast.` : 'Database is al bijgewerkt.');
    return getPool().end();
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
