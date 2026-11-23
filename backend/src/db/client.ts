import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema/index.js';

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

export type Database = ReturnType<typeof drizzlePglite<typeof schema>>;

export interface DbHandle {
  db: Database;
  close: () => Promise<void>;
}

/**
 * DATABASE_URL definido -> Postgres real (Neon etc.).
 * Sem DATABASE_URL -> PGlite: em memória nos testes, em ./.data em dev.
 * Ambos aplicam as mesmas migrações.
 */
export async function createDb(opts: { url?: string; inMemory?: boolean }): Promise<DbHandle> {
  if (opts.url) {
    const pool = new pg.Pool({ connectionString: opts.url });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    return { db: db as unknown as Database, close: () => pool.end() };
  }
  let dataDir: string | undefined;
  if (!opts.inMemory) {
    dataDir = './.data/pglite';
    mkdirSync(dataDir, { recursive: true });
  }
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db, close: () => client.close() };
}
