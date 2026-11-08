// Databasåtkomst. Produktion: Neon Postgres via DATABASE_URL.
// Lokalt utan DATABASE_URL (npm run dev:demo): PGlite i minnet med samma
// migreringar som Neon plus påhittad demodata, så att inget riktigt rörs.
import { neon } from '@neondatabase/serverless';

export type Row = Record<string, unknown>;
export type Query = <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;

let cached: Promise<Query> | null = null;

export function db(): Promise<Query> {
  if (!cached) cached = connect();
  return cached;
}

async function connect(): Promise<Query> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = neon(url);
    return (async (text: string, params: unknown[] = []) => (await sql.query(text, params)) as never) as Query;
  }
  if (process.env.DEMO_DB) return demoDb();
  throw new Error('DATABASE_URL saknas');
}

/** Bara för lokal utveckling och tester. */
export async function demoDb(): Promise<Query> {
  const { PGlite } = await import('@electric-sql/pglite');
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.resolve(process.cwd(), process.cwd().endsWith('admin') ? '..' : '.');
  const pg = new PGlite();
  for (const f of ['db/migrations/001_init.sql', 'db/migrations/002_seed_ct_v45_51.sql', 'db/migrations/003_login_codes.sql', 'admin/dev/demo-seed.sql']) {
    await pg.exec(await fs.readFile(path.join(root, f), 'utf8'));
  }
  return (async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows as never) as Query;
}
