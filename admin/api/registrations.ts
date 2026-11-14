// GET /api/registrations?roundId= -> anmälningar till en omgång med förslag på fördelning.
import { allocate } from './_lib/allocate.js';
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, isUuid, json } from './_lib/http.js';

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const roundId = new URL(request.url).searchParams.get('roundId');
  if (!isUuid(roundId)) return bad('Välj omgång');
  const q = await db();
  const [round] = await q<{ id: string; name: string; previous_round_id: string | null }>(
    `select id, name, previous_round_id,
       to_char(registration_opens_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as registration_opens_at,
       to_char(priority_until at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as priority_until
     from rounds where id = $1`,
    [roundId],
  );
  if (!round) return bad('Omgången finns inte', 404);
  const groups = await q<{ id: string; capacity: number; filled: number }>(
    `select g.id, g.weekday, to_char(g.start_time, 'HH24.MI') as time, g.place, g.capacity, g.min_participants,
       (select count(*) from group_members gm where gm.group_id = g.id)::int as filled
     from groups g where g.round_id = $1 order by g.weekday, g.start_time`,
    [roundId],
  );
  const regs = await q<{ id: string; priority: boolean; created_at: string; per_week: number; status: string; choices: never }>(
    `select r.id, r.per_week, r.status, r.installments, r.friend_name, r.assigned_group_ids,
       to_char(r.created_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI.SS') as created_at,
       p.id as person_id, p.name, p.email, p.phone, p.status as account_status,
       exists (select 1 from group_members gm join groups g on g.id = gm.group_id
               where gm.person_id = p.id and g.round_id = rd.previous_round_id) as existing,
       (exists (select 1 from group_members gm join groups g on g.id = gm.group_id
                where gm.person_id = p.id and g.round_id = rd.previous_round_id)
        and (rd.priority_until is null or r.created_at <= rd.priority_until)) as priority,
       coalesce((select json_agg(json_build_object('slot', c.slot, 'rank', c.rank, 'group_id', c.group_id) order by c.slot, c.rank)
                 from registration_choices c where c.registration_id = r.id), '[]') as choices
     from registrations r join people p on p.id = r.person_id join rounds rd on rd.id = r.round_id
     where r.round_id = $1 and r.status <> 'withdrawn'
     order by r.created_at`,
    [roundId],
  );
  const pending = regs.filter((r) => r.status === 'pending');
  const { allocations, fill } = allocate(groups, pending);
  const suggestion = Object.fromEntries(allocations.map((a) => [a.id, a]));
  return json({ round, groups, registrations: regs, suggestion, fill });
}
export { OPTIONS } from './_lib/http.js';
