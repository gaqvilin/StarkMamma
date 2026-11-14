// GET /api/bookable -> pass de kommande 14 dagarna som den inloggade kan boka utöver sina ordinarie,
// med antal lediga platser och om personen redan är bokad eller står i kö.
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { json } from './_lib/http.js';
import { ACTIVE, ROSTER_CTE } from './_lib/roster.js';
import { now } from './_lib/time.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const user = await requireUser(request, { active: true });
  if (user instanceof Response) return user;
  const q = await db();
  const sessions = await q(
    `with s as (
       select * from sessions
       where starts_at > $2::timestamptz and starts_at < $2::timestamptz + interval '14 days' and status <> 'cancelled'
     ), ${ROSTER_CTE}
     select s.id, s.place, s.status, s.kind, s.capacity, s.price, s.note,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') as date,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'HH24.MI') as time,
       (select count(*) from roster r where r.session_id = s.id and r.status in ${ACTIVE})::int as booked,
       exists (select 1 from roster r where r.session_id = s.id and r.person_id = $1 and r.status in ${ACTIVE}) as mine,
       exists (select 1 from waitlist w where w.session_id = s.id and w.person_id = $1) as queued,
       (select b.source from bookings b where b.session_id = s.id and b.person_id = $1) as source
     from s
     where not exists (select 1 from group_members gm where gm.group_id = s.group_id and gm.person_id = $1)
     order by s.starts_at`,
    [user.id, now().toISOString()],
  );
  return json({ sessions });
}
