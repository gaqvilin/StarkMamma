// GET /api/week?from=YYYY-MM-DD  (måndag) -> alla pass den veckan med beläggning.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, json } from './_lib/http.js';
import { ACTIVE, ROSTER_CTE } from './_lib/roster.js';

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const from = new URL(request.url).searchParams.get('from') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return bad('from måste vara ett datum (YYYY-MM-DD)');

  const q = await db();
  const sessions = await q(
    `with s as (
       select * from sessions
       where starts_at >= ($1::date)::timestamp at time zone 'Europe/Stockholm'
         and starts_at < ($1::date + 7)::timestamp at time zone 'Europe/Stockholm'
     ), ${ROSTER_CTE}
     select s.id, s.kind, s.status, s.place, s.capacity, s.note, s.group_id,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') as date,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'HH24.MI') as time,
       (select count(*) from roster r where r.session_id = s.id and r.status in ${ACTIVE})::int as booked,
       (select count(*) from roster r where r.session_id = s.id and r.status in ('attending', 'attended'))::int as attending,
       (select count(*) from roster r where r.session_id = s.id and r.status like 'cancelled%')::int as cancelled,
       (select count(*) from waitlist w where w.session_id = s.id)::int as queue
     from s
     order by s.starts_at, s.place`,
    [from],
  );
  return json({ from, sessions });
}
