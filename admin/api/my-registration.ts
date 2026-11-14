// GET  /api/my-registration -> omgången som har anmälan öppen (eller snart öppnar) och den egna anmälan.
// POST /api/my-registration {roundId, perWeek, choices: [[förstahand, andrahand?], ...], friendName?, installments?}
//
// Förtur: fram till priority_until kan bara de som tränar i föregående omgång anmäla sig.
// Därefter kan alla anmäla sig, även konton som väntar på aktivering (bekräftelsen aktiverar kontot).
// Anmälningstiden sätts av databasen med mikrosekunder och avgör ordningen vid fördelningen.
import { requireUser } from './_lib/auth.js';
import { db, Query } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { now } from './_lib/time.js';
export { OPTIONS } from './_lib/http.js';

async function openRound(q: Query, personId: string, t: string) {
  const [round] = await q<{ id: string; phase: 'not_open' | 'priority' | 'open'; existing: boolean }>(
    `select r.id, r.name, to_char(r.starts_on, 'YYYY-MM-DD') as starts_on, to_char(r.ends_on, 'YYYY-MM-DD') as ends_on,
       to_char(r.registration_opens_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as opens_at,
       to_char(r.priority_until at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as priority_until,
       to_char(r.pay_deadline, 'YYYY-MM-DD') as pay_deadline, r.info,
       case when r.registration_opens_at > $2::timestamptz then 'not_open'
            when r.priority_until is not null and r.priority_until > $2::timestamptz then 'priority'
            else 'open' end as phase,
       exists (select 1 from group_members gm join groups g on g.id = gm.group_id
               where gm.person_id = $1 and g.round_id = r.previous_round_id) as existing
     from rounds r
     where r.registration_opens_at is not null and r.status <> 'closed' and r.starts_on > ($2::timestamptz)::date
     order by r.starts_on limit 1`,
    [personId, t],
  );
  return round ?? null;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const q = await db();
  const round = await openRound(q, user.id, now().toISOString());
  if (!round) return json({ round: null, registration: null });
  const groups = await q(
    `select g.id, g.weekday, to_char(g.start_time, 'HH24.MI') as time, g.place from groups g where g.round_id = $1 order by g.weekday, g.start_time`,
    [round.id],
  );
  const prices = await q(`select per_week, price, first_installment from price_tiers where round_id = $1 order by per_week`, [round.id]);
  const [registration] = await q(
    `select r.id, r.per_week, r.installments, r.friend_name, r.status, r.assigned_group_ids,
       to_char(r.created_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI.SS') as created_at,
       coalesce((select json_agg(json_build_object('slot', c.slot, 'rank', c.rank, 'group_id', c.group_id) order by c.slot, c.rank)
                 from registration_choices c where c.registration_id = r.id), '[]') as choices
     from registrations r where r.round_id = $1 and r.person_id = $2 and r.status <> 'withdrawn'`,
    [round.id, user.id],
  );
  const eligible = round.phase === 'open' || (round.phase === 'priority' && round.existing);
  return json({ round: { ...round, eligible }, groups, prices, registration: registration ?? null });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.needs_profile) return bad('Fyll i namn och mobilnummer först');
  if (user.status === 'rejected') return bad('Kontot är inte aktivt', 403);
  const b = await body<{ roundId?: string; perWeek?: number; choices?: string[][]; friendName?: string; installments?: boolean }>(request);
  const q = await db();
  const round = await openRound(q, user.id, now().toISOString());
  if (!round || round.id !== b.roundId) return bad('Anmälan är inte öppen för den här omgången');
  if (round.phase === 'not_open') return bad('Anmälan har inte öppnat än');
  if (round.phase === 'priority' && !round.existing) return bad('Just nu har de som redan tränar förtur. Anmälan öppnar för nya snart.');

  const perWeek = Number(b.perWeek);
  if ((b.friendName ?? '').length > 100) return bad('Namnet är för långt');
  const choices = Array.isArray(b.choices) ? b.choices : [];
  if (![1, 2, 3].includes(perWeek) || choices.length !== perWeek) return bad('Välj ett pass för varje gång i veckan');
  const [tier] = await q<{ first_installment: number | null }>(`select first_installment from price_tiers where round_id = $1 and per_week = $2`, [round.id, perWeek]);
  if (!tier) return bad('Det alternativet finns inte i den här omgången');
  const valid = new Set(
    (await q<{ id: string }>(`select id from groups where round_id = $1`, [round.id])).map((g) => g.id),
  );
  const rows: [number, number, string][] = [];
  const firsts = new Set<string>();
  choices.forEach((pair, slot) => {
    (Array.isArray(pair) ? pair : []).slice(0, 2).forEach((gid, rank) => {
      if (isUuid(gid) && valid.has(gid)) rows.push([slot, rank + 1, gid]);
    });
    if (pair?.[0]) firsts.add(pair[0]);
  });
  if (firsts.size !== perWeek || rows.filter((r) => r[1] === 1).length !== perWeek) return bad('Välj olika förstahandsval för varje pass');
  const installments = !!b.installments && perWeek > 1 && !!tier.first_installment;

  const [reg] = await q<{ id: string; status: string }>(
    `insert into registrations (round_id, person_id, per_week, installments, friend_name)
     values ($1, $2, $3, $4, $5)
     on conflict (round_id, person_id) do update set per_week = excluded.per_week, installments = excluded.installments,
       friend_name = excluded.friend_name,
       status = case when registrations.status = 'withdrawn' then 'pending' else registrations.status end
     returning id, status`,
    [round.id, user.id, perWeek, installments, (b.friendName ?? '').trim().slice(0, 100) || null],
  );
  if (reg.status === 'confirmed') return bad('Din plats är redan bekräftad. Kontakta Emma om du vill ändra.');
  await q(`delete from registration_choices where registration_id = $1`, [reg.id]);
  for (const [slot, rank, gid] of rows) {
    await q(`insert into registration_choices (registration_id, slot, rank, group_id) values ($1, $2, $3, $4)`, [reg.id, slot, rank, gid]);
  }
  return json({ id: reg.id }, 201);
}
