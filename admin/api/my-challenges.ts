// GET  /api/my-challenges -> pågående och nyss avslutade utmaningar med rutor och mina avbockningar.
// POST /api/my-challenges {taskId, done: boolean, date?} -> bocka av (med datum) eller ångra en ruta.
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { now } from './_lib/time.js';
export { OPTIONS } from './_lib/http.js';

const VISIBLE = `(c.program_id is null or exists (select 1 from online_access a where a.program_id = c.program_id and a.person_id = $1))`;

export async function GET(request: Request) {
  const user = await requireUser(request, { active: true });
  if (user instanceof Response) return user;
  const q = await db();
  const today = now().toISOString().slice(0, 10);
  const challenges = await q<{ id: string }>(
    `select c.id, c.name, c.description, c.prize, to_char(c.starts_on, 'YYYY-MM-DD') as starts_on, to_char(c.ends_on, 'YYYY-MM-DD') as ends_on,
       $2::date between c.starts_on and c.ends_on as active,
       exists (select 1 from challenge_winners w where w.challenge_id = c.id and w.person_id = $1) as won
     from challenges c
     where ${VISIBLE} and c.starts_on <= $2::date and c.ends_on >= $2::date - 14
     order by c.starts_on desc`,
    [user.id, today],
  );
  const tasks = challenges.length
    ? await q(
        `select t.id, t.challenge_id, t.sort, t.text, to_char(k.done_on, 'YYYY-MM-DD') as done_on
         from challenge_tasks t left join challenge_checks k on k.task_id = t.id and k.person_id = $1
         where t.challenge_id = any($2::uuid[]) order by t.sort`,
        [user.id, challenges.map((c) => c.id)],
      )
    : [];
  return json({ challenges, tasks });
}

export async function POST(request: Request) {
  const user = await requireUser(request, { active: true });
  if (user instanceof Response) return user;
  const b = await body<{ taskId?: string; done?: boolean; date?: string }>(request);
  if (!isUuid(b.taskId)) return bad('Ogiltig ruta');
  const q = await db();
  const today = now().toISOString().slice(0, 10);
  const [t] = await q<{ active: boolean; starts_on: string }>(
    `select $3::date between c.starts_on and c.ends_on as active, to_char(c.starts_on, 'YYYY-MM-DD') as starts_on
     from challenge_tasks t join challenges c on c.id = t.challenge_id where t.id = $2 and ${VISIBLE}`,
    [user.id, b.taskId, today],
  );
  if (!t) return bad('Rutan finns inte', 404);
  if (!t.active) return bad('Utmaningen är inte igång');
  if (b.done) {
    const date = b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.date >= t.starts_on && b.date <= today ? b.date : today;
    await q(
      `insert into challenge_checks (task_id, person_id, done_on) values ($1, $2, $3::date)
       on conflict (task_id, person_id) do update set done_on = excluded.done_on`,
      [b.taskId, user.id, date],
    );
  } else {
    await q(`delete from challenge_checks where task_id = $1 and person_id = $2`, [b.taskId, user.id]);
  }
  return json({ ok: true });
}
