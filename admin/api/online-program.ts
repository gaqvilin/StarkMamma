// GET /api/online-program?id= -> programmet, alla pass (med hur många som gjort dem) och vilka som har tillgång.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, isUuid, json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return bad('Ogiltigt program');
  const q = await db();
  const [program] = await q(
    `select id, name, description, price, status, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on
     from online_programs where id = $1`,
    [id],
  );
  if (!program) return bad('Programmet finns inte', 404);
  const workouts = await q(
    `select w.id, w.title, w.body, w.video_url, w.duration_min, w.sort, to_char(w.publish_on, 'YYYY-MM-DD') as publish_on,
       (select count(*) from workout_done d where d.workout_id = w.id)::int as done
     from workouts w where w.program_id = $1 order by w.publish_on nulls first, w.sort, w.created_at`,
    [id],
  );
  const members = await q(
    `select p.id, p.name, p.email, p.phone, a.source, to_char(a.granted_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') as granted_on,
       (select count(*) from workout_done d join workouts w on w.id = d.workout_id where d.person_id = p.id and w.program_id = $1)::int as done
     from online_access a join people p on p.id = a.person_id where a.program_id = $1 order by p.name`,
    [id],
  );
  const waiting = await q(
    `select c.id as charge_id, p.id, p.name, p.phone, c.amount, c.reported_paid_at is not null as reported
     from charges c join people p on p.id = c.person_id
     where c.online_program_id = $1 and c.status = 'unpaid' order by c.created_at`,
    [id],
  );
  return json({ program, workouts, members, waiting });
}
