// GET  /api/charges?status=unpaid|paid|all -> betalningskrav med person
// POST /api/charges {personId, description, amount, dueOn?, kind?} -> nytt betalningskrav
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const status = new URL(request.url).searchParams.get('status') ?? 'all';
  const q = await db();
  const charges = await q(
    `select c.id, c.description, c.amount, c.kind, c.status, to_char(c.due_on, 'YYYY-MM-DD') as due_on,
       to_char(c.reported_paid_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as reported_at,
       p.id as person_id, p.name, p.phone,
       (select to_char(max(paid_at) at time zone 'Europe/Stockholm', 'YYYY-MM-DD') from payments where charge_id = c.id) as paid_on,
       (select max(method) from payments where charge_id = c.id) as method,
       (select max(receipt_number) from payments where charge_id = c.id) as receipt_number
     from charges c join people p on p.id = c.person_id
     where c.status <> 'cancelled' and ($1 = 'all' or c.status = $1)
     order by (c.status = 'unpaid') desc, (c.reported_paid_at is not null) desc, c.due_on nulls last, p.name`,
    [status],
  );
  return json({ charges });
}

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<{ personId?: string; description?: string; amount?: number; dueOn?: string; kind?: string }>(request);
  if (!isUuid(b.personId)) return bad('Välj person');
  const description = (b.description ?? '').trim();
  const amount = Math.round(Number(b.amount));
  if (!description) return bad('Beskrivning saknas');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return bad('Ogiltigt belopp');
  if (b.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(b.dueOn)) return bad('Ogiltigt datum');
  const kind = ['round', 'installment', 'drop_in', 'punch_card', 'event', 'product', 'tab', 'online'].includes(b.kind ?? '') ? b.kind : 'product';
  const q = await db();
  const [c] = await q<{ id: string }>(
    `insert into charges (person_id, description, amount, due_on, kind) values ($1, $2, $3, $4::date, $5) returning id`,
    [b.personId, description, amount, b.dueOn || null, kind],
  );
  return json({ id: c.id }, 201);
}
export { OPTIONS } from './_lib/http.js';
