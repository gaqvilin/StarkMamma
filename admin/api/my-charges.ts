// GET /api/my-charges -> den inloggades betalningar (att betala och betalda med kvittonummer).
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const q = await db();
  const charges = await q(
    `select c.id, c.description, c.amount, c.status, c.kind, to_char(c.due_on, 'YYYY-MM-DD') as due_on,
       (select max(receipt_number) from payments where charge_id = c.id) as receipt_number,
       (select to_char(max(paid_at) at time zone 'Europe/Stockholm', 'YYYY-MM-DD') from payments where charge_id = c.id) as paid_on
     from charges c where c.person_id = $1 and c.status <> 'cancelled'
     order by (c.status = 'unpaid') desc, c.due_on nulls last, c.created_at desc`,
    [user.id],
  );
  return json({ charges, swish: process.env.SWISH_NUMBER ?? null });
}
