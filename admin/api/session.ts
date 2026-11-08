// GET /api/session?id=<uuid> -> passet, deltagarlistan och kön.
import { requireAdmin } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, isUuid, json } from './_lib/http.js';
import { ROSTER_CTE } from './_lib/roster.js';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return bad('Ogiltigt pass');

  const q = await db();
  const [session] = await q(
    `select s.id, s.place, s.capacity, s.status, s.note, s.kind,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') as date,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'HH24.MI') as time
     from sessions s where s.id = $1`,
    [id],
  );
  if (!session) return bad('Passet finns inte', 404);

  const roster = await q(
    `with s as (select * from sessions where id = $1), ${ROSTER_CTE}
     select p.id, p.name, p.phone, r.status, r.source
     from roster r join people p on p.id = r.person_id
     order by (r.status like 'cancelled%'), p.name`,
    [id],
  );
  const queue = await q(
    `select p.id, p.name, p.phone from waitlist w join people p on p.id = w.person_id
     where w.session_id = $1 order by w.created_at`,
    [id],
  );
  return json({ session, roster, queue });
}
