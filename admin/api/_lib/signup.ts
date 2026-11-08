import type { Query } from './db.js';

/** Hittar personen med e-postadressen, eller skapar ett nytt konto som väntar på aktivering. */
export async function findOrCreateByEmail(
  q: Query,
  email: string,
  via: 'email' | 'google' | 'facebook',
  name = '',
): Promise<{ id: string; created: boolean }> {
  const [existing] = await q<{ id: string }>(`select id from people where lower(email) = $1`, [email]);
  if (existing) return { id: existing.id, created: false };
  const [p] = await q<{ id: string }>(
    `insert into people (name, email, status, signed_up_via) values ($1, $2, 'pending', $3)
     on conflict (email) do update set email = excluded.email returning id`,
    [name.trim().slice(0, 100), email, via],
  );
  return { id: p.id, created: true };
}
