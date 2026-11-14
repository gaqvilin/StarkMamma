// GET  /api/my-charges -> den inloggades betalningar (att betala och betalda med kvittonummer).
// POST /api/my-charges {id} -> "Jag har swishat": Emma ser att betalningen bör ha kommit in.
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const q = await db();
  const charges = await q(
    `select c.id, c.description, c.amount, c.status, c.kind, to_char(c.due_on, 'YYYY-MM-DD') as due_on,
       c.reported_paid_at is not null as reported,
       (select max(receipt_number) from payments where charge_id = c.id) as receipt_number,
       (select to_char(max(paid_at) at time zone 'Europe/Stockholm', 'YYYY-MM-DD') from payments where charge_id = c.id) as paid_on
     from charges c where c.person_id = $1 and c.status <> 'cancelled'
     order by (c.status = 'unpaid') desc, c.due_on nulls last, c.created_at desc`,
    [user.id],
  );
  return json({ charges, swish: process.env.SWISH_NUMBER ?? null });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await body<{ id?: string }>(request);
  if (!isUuid(id)) return bad('Ogiltig betalning');
  const q = await db();
  const [row] = await q<{ online_program_id: string | null }>(
    `update charges set reported_paid_at = coalesce(reported_paid_at, now())
     where id = $1 and person_id = $2 and status = 'unpaid' returning online_program_id`,
    [id, user.id],
  );
  if (!row) return bad('Betalningen finns inte', 404);
  // Onlineträning: tillgång direkt, så att ingen behöver vänta på Emma. Hon kontrollerar
  // betalningen i efterhand och kan ta bort tillgången om den inte kommit in.
  if (row.online_program_id) {
    await q(`insert into online_access (program_id, person_id, source) values ($1, $2, 'reported') on conflict do nothing`, [
      row.online_program_id, user.id,
    ]);
  }
  return json({ ok: true, access: !!row.online_program_id });
}
