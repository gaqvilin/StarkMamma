// GET /api/round -> pågående omgång med priser och grupper (antal medlemmar per grupp).
import { requireAdmin } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { json } from './_lib/http.js';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const q = await db();
  const [round] = await q(
    `select r.id, r.name, r.status, p.name as program,
       to_char(r.starts_on, 'YYYY-MM-DD') as starts_on, to_char(r.ends_on, 'YYYY-MM-DD') as ends_on,
       to_char(r.pay_deadline, 'YYYY-MM-DD') as pay_deadline,
       to_char(r.installment_deadline, 'YYYY-MM-DD') as installment_deadline
     from rounds r join programs p on p.id = r.program_id
     order by (r.status = 'running') desc, r.starts_on desc limit 1`,
  );
  if (!round) return json({ round: null, prices: [], groups: [] });
  const prices = await q(
    `select per_week, price, first_installment from price_tiers where round_id = $1 order by per_week`,
    [round.id],
  );
  const groups = await q(
    `select g.id, g.weekday, to_char(g.start_time, 'HH24.MI') as time, g.place, g.capacity, g.min_participants,
       (select count(*) from group_members gm where gm.group_id = g.id)::int as members
     from groups g where g.round_id = $1 order by g.weekday, g.start_time`,
    [round.id],
  );
  return json({ round, prices, groups });
}
