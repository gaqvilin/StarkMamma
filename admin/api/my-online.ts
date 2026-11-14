// GET  /api/my-online -> mina onlineprogram med de pass som publicerats, samt program som går att köpa.
// POST /api/my-online {programId, action: 'buy'} -> skapar en betalning; tillgången kommer när Emma markerat den betald.
// POST /api/my-online {workoutId, action: 'done' | 'undo'} -> bocka av ett pass.
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { now } from './_lib/time.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const user = await requireUser(request, { active: true });
  if (user instanceof Response) return user;
  const q = await db();
  const today = now().toISOString().slice(0, 10);
  const mine = await q<{ id: string }>(
    `select p.id, p.name, p.description, to_char(p.starts_on, 'YYYY-MM-DD') as starts_on, to_char(p.ends_on, 'YYYY-MM-DD') as ends_on
     from online_access a join online_programs p on p.id = a.program_id where a.person_id = $1 order by p.created_at desc`,
    [user.id],
  );
  const workouts = mine.length
    ? await q(
        `select w.id, w.program_id, w.title, w.body, w.video_url, w.duration_min, to_char(w.publish_on, 'YYYY-MM-DD') as publish_on,
           exists (select 1 from workout_done d where d.workout_id = w.id and d.person_id = $1) as done
         from workouts w where w.program_id = any($2::uuid[]) and (w.publish_on is null or w.publish_on <= $3::date)
         order by w.publish_on desc nulls last, w.sort desc, w.created_at desc`,
        [user.id, mine.map((m) => m.id), today],
      )
    : [];
  const upcoming = mine.length
    ? await q<{ n: number; next: string | null }>(
        `select count(*)::int as n, to_char(min(publish_on), 'YYYY-MM-DD') as next from workouts
         where program_id = any($1::uuid[]) and publish_on > $2::date`,
        [mine.map((m) => m.id), today],
      )
    : [{ n: 0, next: null }];
  const offers = await q(
    `select p.id, p.name, p.description, p.price, to_char(p.starts_on, 'YYYY-MM-DD') as starts_on, to_char(p.ends_on, 'YYYY-MM-DD') as ends_on,
       exists (select 1 from charges c where c.online_program_id = p.id and c.person_id = $1 and c.status = 'unpaid') as ordered
     from online_programs p
     where p.status = 'open' and (p.ends_on is null or p.ends_on >= $2::date)
       and not exists (select 1 from online_access a where a.program_id = p.id and a.person_id = $1)
     order by p.starts_on nulls last`,
    [user.id, today],
  );
  return json({ programs: mine, workouts, upcoming: upcoming[0], offers });
}

export async function POST(request: Request) {
  const user = await requireUser(request, { active: true });
  if (user instanceof Response) return user;
  const b = await body<{ programId?: string; workoutId?: string; action?: string }>(request);
  const q = await db();
  if (b.action === 'buy') {
    if (!isUuid(b.programId)) return bad('Ogiltigt program');
    const [p] = await q<{ name: string; price: number }>(`select name, price from online_programs where id = $1 and status = 'open'`, [b.programId]);
    if (!p) return bad('Programmet går inte att köpa just nu');
    const [has] = await q(`select 1 from online_access where program_id = $1 and person_id = $2`, [b.programId, user.id]);
    if (has) return bad('Du har redan tillgång');
    const [existing] = await q<{ id: string }>(
      `select id from charges where online_program_id = $1 and person_id = $2 and status = 'unpaid'`,
      [b.programId, user.id],
    );
    if (existing) return json({ chargeId: existing.id });
    if (p.price === 0) {
      await q(`insert into online_access (program_id, person_id, source) values ($1, $2, 'paid') on conflict do nothing`, [b.programId, user.id]);
      return json({ access: true });
    }
    const [c] = await q<{ id: string }>(
      `insert into charges (person_id, description, amount, kind, online_program_id) values ($1, $2, $3, 'online', $4) returning id`,
      [user.id, p.name, p.price, b.programId],
    );
    return json({ chargeId: c.id }, 201);
  }
  if (b.action === 'done' || b.action === 'undo') {
    if (!isUuid(b.workoutId)) return bad('Ogiltigt pass');
    const [ok] = await q(
      `select 1 from workouts w join online_access a on a.program_id = w.program_id and a.person_id = $2 where w.id = $1`,
      [b.workoutId, user.id],
    );
    if (!ok) return bad('Du har inte tillgång till passet', 403);
    if (b.action === 'done') await q(`insert into workout_done (workout_id, person_id) values ($1, $2) on conflict do nothing`, [b.workoutId, user.id]);
    else await q(`delete from workout_done where workout_id = $1 and person_id = $2`, [b.workoutId, user.id]);
    return json({ ok: true });
  }
  return bad('Okänd åtgärd');
}
