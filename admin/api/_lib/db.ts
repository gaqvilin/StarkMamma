// Databasåtkomst. Produktion: Neon Postgres via DATABASE_URL.
// Lokalt utan DATABASE_URL (npm run dev:demo): PGlite i minnet med samma
// migreringar som Neon plus påhittad demodata, så att inget riktigt rörs.
import { neon } from '@neondatabase/serverless';

export type Row = Record<string, unknown>;
export type Query = <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;
/** Kör flera satser i en och samma transaktion (allt eller inget). Returnerar raderna per sats. */
export type Tx = (statements: { text: string; params?: unknown[] }[]) => Promise<Row[][]>;

let cached: Promise<Query> | null = null;
let txImpl: Tx | null = null;

export async function tx(statements: { text: string; params?: unknown[] }[]): Promise<Row[][]> {
  await db();
  return txImpl!(statements);
}

export function db(): Promise<Query> {
  if (!cached) cached = connect();
  return cached;
}

async function connect(): Promise<Query> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = neon(url);
    txImpl = async (statements) => (await sql.transaction(statements.map((st) => sql.query(st.text, st.params ?? [])))) as Row[][];
    return (async (text: string, params: unknown[] = []) => (await sql.query(text, params)) as never) as Query;
  }
  if (process.env.DEMO_DB) {
    // Demoläget får aldrig köras i produktion: koder visas på skärmen och data är påhittad.
    if (process.env.VERCEL_ENV === 'production') throw new Error('DEMO_DB är inte tillåtet i produktion');
    return demoDb();
  }
  throw new Error('DATABASE_URL saknas');
}

/** Bara för lokal utveckling och tester. */
export async function demoDb(): Promise<Query> {
  const { PGlite } = await import('@electric-sql/pglite');
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.resolve(process.cwd(), process.cwd().endsWith('admin') ? '..' : '.');
  const pg = new PGlite();
  for (const f of ['db/migrations/001_init.sql', 'db/migrations/002_seed_ct_v45_51.sql', 'db/migrations/003_login_codes.sql', 'db/migrations/004_identities.sql', 'db/migrations/005_self_signup.sql', 'db/migrations/006_operations.sql', 'db/migrations/007_acknowledgements.sql', 'db/migrations/008_reported_payments.sql', 'db/migrations/009_online_and_challenges.sql', 'db/migrations/010_hardening.sql', 'db/migrations/011_video.sql', 'db/migrations/012_review_fixes.sql', 'admin/dev/demo-seed.sql']) {
    await pg.exec(await fs.readFile(path.join(root, f), 'utf8'));
  }
  txImpl = (statements) =>
    pg.transaction(async (t) => {
      const out: Row[][] = [];
      for (const st of statements) out.push((await t.query(st.text, st.params ?? [])).rows as Row[]);
      return out;
    });
  return (async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows as never) as Query;
}
