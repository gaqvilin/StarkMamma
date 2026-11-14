// GET  /api/challenges[?id=] -> alla utmaningar, eller en med rutor och allas framsteg
// POST /api/challenges {name, description?, prize?, startsOn, endsOn, tasks: string[], programId?} -> ny utmaning (bingo)
// POST /api/challenges {id, action: 'draw'} -> lottar en vinnare bland dem som klarat alla rutor
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { sendNotice } from './_lib/notify.js';
export { OPTIONS } from './_lib/http.js';

const fields = `c.id, c.name, c.description, c.prize, c.program_id,
  to_char(c.starts_on, 'YYYY-MM-DD') as starts_on, to_char(c.ends_on, 'YYYY-MM-DD') as ends_on,
  (select count(*) from challenge_tasks t where t.challenge_id = c.id)::int as tasks`;

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id');
  const q = await db();
  if (!id) {
    const challenges = await q(
      `select ${fields},
         (select count(distinct k.person_id) from challenge_checks k join challenge_tasks t on t.id = k.task_id where t.challenge_id = c.id)::int as participants
       from challenges c order by c.starts_on desc`,
    );
    return json({ challenges });
  }
  if (!isUuid(id)) return bad('Ogiltig utmaning');
  const [challenge] = await q(`select ${fields} from challenges c where c.id = $1`, [id]);
  if (!challenge) return bad('Utmaningen finns inte', 404);
  const tasks = await q(
    `select t.id, t.sort, t.text, (select count(*) from challenge_checks k where k.task_id = t.id)::int as done
     from challenge_tasks t where t.challenge_id = $1 order by t.sort`,
    [id],
  );
  const progress = await q(
    `select p.id, p.name, p.phone, count(*)::int as done, to_char(max(k.done_on), 'YYYY-MM-DD') as last_on,
       exists (select 1 from challenge_winners w where w.challenge_id = $1 and w.person_id = p.id) as winner
     from challenge_checks k join challenge_tasks t on t.id = k.task_id join people p on p.id = k.person_id
     where t.challenge_id = $1 group by p.id order by count(*) desc, max(k.created_at)`,
    [id],
  );
  return json({ challenge, tasks, progress });
}

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<{ id?: string; action?: string; name?: string; description?: string; prize?: string; startsOn?: string; endsOn?: string; tasks?: string[]; programId?: string }>(request);
  const q = await db();

  if (b.action === 'draw') {
    if (!isUuid(b.id)) return bad('Ogiltig utmaning');
    const [c] = await q<{ name: string; tasks: number }>(
      `select name, (select count(*) from challenge_tasks where challenge_id = $1)::int as tasks from challenges where id = $1`,
      [b.id],
    );
    if (!c) return bad('Utmaningen finns inte', 404);
    const [winner] = await q<{ id: string; name: string }>(
      `select p.id, p.name from people p
       where (select count(*) from challenge_checks k join challenge_tasks t on t.id = k.task_id
              where t.challenge_id = $1 and k.person_id = p.id) = $2
         and not exists (select 1 from challenge_winners w where w.challenge_id = $1 and w.person_id = p.id)
       order by random() limit 1`,
      [b.id, c.tasks],
    );
    if (!winner) return bad('Ingen har fyllt hela brickan, eller så har alla redan vunnit');
    await q(`insert into challenge_winners (challenge_id, person_id) values ($1, $2)`, [b.id, winner.id]);
    await sendNotice(q, { title: 'Du har vunnit!', body: `Grattis, du vann i utlottningen i ${c.name}. Emma hör av sig om vinsten.`, audience: `person:${winner.id}` }, [winner.id]);
    return json({ winner });
  }

  const name = (b.name ?? '').trim();
  const tasks = (b.tasks ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (!name) return bad('Namn saknas');
  if (name.length > 120 || (b.description ?? '').length > 5000 || (b.prize ?? '').length > 300 || tasks.some((t) => t.length > 300))
    return bad('Någon text är för lång');
  if (!b.startsOn || !b.endsOn || !/^\d{4}-\d{2}-\d{2}$/.test(b.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(b.endsOn) || b.endsOn < b.startsOn)
    return bad('Ange start- och slutdatum');
  if (tasks.length < 1 || tasks.length > 30) return bad('Lägg till 1–30 rutor');
  if (b.programId && !isUuid(b.programId)) return bad('Ogiltigt program');
  const [c] = await q<{ id: string }>(
    `insert into challenges (name, description, prize, starts_on, ends_on, program_id) values ($1, $2, $3, $4::date, $5::date, $6) returning id`,
    [name, b.description?.trim() || null, b.prize?.trim() || null, b.startsOn, b.endsOn, b.programId || null],
  );
  for (const [i, t] of tasks.entries()) {
    await q(`insert into challenge_tasks (challenge_id, sort, text) values ($1, $2, $3)`, [c.id, i, t]);
  }
  return json({ id: c.id }, 201);
}
