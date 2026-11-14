// GET /api/my-schedule -> den inloggades kommande pass (ordinarie och extra), tillgodo-pass och klippkort.
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { json } from './_lib/http.js';
import { now } from './_lib/time.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const user = await requireUser(request, { active: true });
  if (user instanceof Response) return user;
  const q = await db();
  const t = now().toISOString();
  const sessions = await q(
    `select s.id, s.place, s.status, s.note, s.kind,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') as date,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'HH24.MI') as time,
       $2::timestamptz < (date_trunc('day', s.starts_at at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm') as in_time,
       gm.person_id is not null as ordinary,
       coalesce(b.status, 'booked') as my_status, b.source
     from sessions s
     left join group_members gm on gm.group_id = s.group_id and gm.person_id = $1
     left join bookings b on b.session_id = s.id and b.person_id = $1
     where s.starts_at > $2::timestamptz - interval '2 hours'
       and s.starts_at < $2::timestamptz + interval '42 days'
       and (gm.person_id is not null or (b.id is not null and b.status in ('booked', 'attending', 'cancelled_late')))
     order by s.starts_at`,
    [user.id, t],
  );
  const [extra] = await q<{ credits: number; punch: number; punch_valid: string | null }>(
    `select
       (select count(*) from credits c join rounds r on r.id = c.round_id
        where c.person_id = $1 and c.used_booking_id is null and r.ends_on >= ($2::timestamptz at time zone 'Europe/Stockholm')::date)::int as credits,
       coalesce((select sum(remaining) from punch_cards where person_id = $1 and valid_until >= ($2::timestamptz at time zone 'Europe/Stockholm')::date), 0)::int as punch,
       (select to_char(max(valid_until), 'YYYY-MM-DD') from punch_cards where person_id = $1 and remaining > 0) as punch_valid`,
    [user.id, t],
  );
  return json({ user, sessions, ...extra });
}
