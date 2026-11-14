// GET  /api/rounds -> alla omgångar
// POST /api/rounds -> ny omgång: kopierar grupper från en tidigare omgång och skapar alla pass.
//   {name, firstMonday, weeks, skipWeeks?, copyFromRoundId, prices: [{per_week, price, first_installment}],
//    payDeadline?, installmentDeadline?, registrationOpensAt?, priorityUntil?, info?}
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const q = await db();
  const rounds = await q(
    `select r.id, r.name, r.status, to_char(r.starts_on, 'YYYY-MM-DD') as starts_on, to_char(r.ends_on, 'YYYY-MM-DD') as ends_on,
       to_char(r.registration_opens_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as registration_opens_at,
       to_char(r.priority_until at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as priority_until,
       (select count(*) from registrations g where g.round_id = r.id)::int as registrations,
       (select count(*) from sessions s where s.round_id = r.id)::int as sessions
     from rounds r order by r.starts_on desc`,
  );
  return json({ rounds });
}

type Input = {
  name?: string;
  firstMonday?: string;
  weeks?: number;
  skipWeeks?: number[];
  copyFromRoundId?: string;
  prices?: { per_week: number; price: number; first_installment?: number | null }[];
  payDeadline?: string;
  installmentDeadline?: string;
  registrationOpensAt?: string;
  priorityUntil?: string;
  info?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<Input>(request);
  const name = (b.name ?? '').trim();
  if (!name) return bad('Namn saknas');
  if (!b.firstMonday || !DATE.test(b.firstMonday) || new Date(`${b.firstMonday}T12:00`).getDay() !== 1) return bad('Startdatum måste vara en måndag');
  const weeks = Math.round(Number(b.weeks));
  if (!(weeks >= 1 && weeks <= 26)) return bad('Antal veckor måste vara 1–26');
  if (!isUuid(b.copyFromRoundId)) return bad('Välj vilken omgång grupperna ska kopieras från');
  for (const d of [b.payDeadline, b.installmentDeadline]) if (d && !DATE.test(d)) return bad('Ogiltigt datum');
  for (const d of [b.registrationOpensAt, b.priorityUntil]) if (d && !DATETIME.test(d)) return bad('Ogiltig tidpunkt');
  const prices = (b.prices ?? []).filter((p) => [1, 2, 3].includes(p.per_week) && p.price > 0);
  if (!prices.length) return bad('Ange minst ett pris');
  const skip = (b.skipWeeks ?? []).map(Number).filter((n) => n >= 1 && n <= 53);

  const q = await db();
  const [from] = await q<{ program_id: string }>(`select program_id from rounds where id = $1`, [b.copyFromRoundId]);
  if (!from) return bad('Omgången att kopiera från finns inte');
  const [r] = await q<{ id: string }>(
    `insert into rounds (program_id, name, starts_on, ends_on, registration_opens_at, priority_until, pay_deadline,
       installment_deadline, info, status, previous_round_id)
     values ($1, $2, $3::date, $3::date + ($4 * 7 - 1), ($5::timestamp) at time zone 'Europe/Stockholm',
       ($6::timestamp) at time zone 'Europe/Stockholm', $7::date, $8::date, $9, 'open', $10)
     returning id`,
    [from.program_id, name, b.firstMonday, weeks, b.registrationOpensAt || null, b.priorityUntil || null,
     b.payDeadline || null, b.installmentDeadline || null, b.info?.trim() || null, b.copyFromRoundId],
  );
  for (const p of prices) {
    await q(`insert into price_tiers (round_id, per_week, price, first_installment) values ($1, $2, $3, $4)`, [
      r.id, p.per_week, Math.round(p.price), p.first_installment ? Math.round(p.first_installment) : null,
    ]);
  }
  await q(
    `insert into groups (round_id, weekday, start_time, place, capacity, min_participants, kind)
     select $1, weekday, start_time, place, capacity, min_participants, kind from groups where round_id = $2`,
    [r.id, b.copyFromRoundId],
  );
  const [made] = await q<{ n: number }>(
    `with ins as (
       insert into sessions (round_id, group_id, starts_at, place, capacity)
       select g.round_id, g.id, (($2::date + w * 7 + g.weekday - 1) + g.start_time) at time zone 'Europe/Stockholm', g.place, g.capacity
       from groups g, generate_series(0, $3 - 1) as w
       where g.round_id = $1 and not (extract(week from $2::date + w * 7)::int = any($4::int[]))
       returning 1)
     select count(*)::int as n from ins`,
    [r.id, b.firstMonday, weeks, skip],
  );
  return json({ id: r.id, sessions: made.n }, 201);
}
export { OPTIONS } from './_lib/http.js';
