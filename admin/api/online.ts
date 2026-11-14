// GET  /api/online -> alla onlineprogram med antal deltagare och pass
// POST /api/online {id?, name, description?, price, startsOn?, endsOn?, status?} -> skapa eller ändra program
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const q = await db();
  const programs = await q(
    `select p.id, p.name, p.description, p.price, p.status,
       to_char(p.starts_on, 'YYYY-MM-DD') as starts_on, to_char(p.ends_on, 'YYYY-MM-DD') as ends_on,
       (select count(*) from online_access a where a.program_id = p.id)::int as members,
       (select count(*) from workouts w where w.program_id = p.id)::int as workouts,
       (select count(*) from charges c where c.online_program_id = p.id and c.status = 'unpaid')::int as unpaid
     from online_programs p order by p.created_at desc`,
  );
  return json({ programs });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<{ id?: string; name?: string; description?: string; price?: number; startsOn?: string; endsOn?: string; status?: string }>(request);
  const name = (b.name ?? '').trim();
  if (!name) return bad('Namn saknas');
  const price = Math.round(Number(b.price ?? 0));
  if (!(price >= 0 && price <= 100000)) return bad('Ogiltigt pris');
  for (const d of [b.startsOn, b.endsOn]) if (d && !DATE.test(d)) return bad('Ogiltigt datum');
  const status = ['draft', 'open', 'closed'].includes(b.status ?? '') ? b.status : 'open';
  const q = await db();
  if (b.id) {
    if (!isUuid(b.id)) return bad('Ogiltigt program');
    await q(
      `update online_programs set name = $2, description = $3, price = $4, starts_on = $5::date, ends_on = $6::date, status = $7 where id = $1`,
      [b.id, name, b.description?.trim() || null, price, b.startsOn || null, b.endsOn || null, status],
    );
    return json({ id: b.id });
  }
  const [p] = await q<{ id: string }>(
    `insert into online_programs (name, description, price, starts_on, ends_on, status) values ($1, $2, $3, $4::date, $5::date, $6) returning id`,
    [name, b.description?.trim() || null, price, b.startsOn || null, b.endsOn || null, status],
  );
  return json({ id: p.id }, 201);
}
