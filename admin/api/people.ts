// GET  /api/people            -> alla deltagare (aktiva och väntande) med grupper i pågående omgång
// POST /api/people {name, phone?, email?, groupIds?} -> ny deltagare
// PUT  /api/people {id, name, phone?, email?, groupIds} -> uppdatera deltagare och grupper
import { requireTrainer } from './_lib/auth.js';
import { db, Query } from './_lib/db.js';
import { normalizePhone } from './_lib/auth.js';
import { bad, body, isUuid, json } from './_lib/http.js';

type Input = { id?: string; name?: string; phone?: string; email?: string; groupIds?: string[] };

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const q = await db();
  const people = await q(
    `select p.id, p.name, p.phone, p.email, p.status, p.signed_up_via,
       to_char(p.created_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as created,
       coalesce(array_agg(gm.group_id) filter (where gm.group_id is not null), '{}') as group_ids
     from people p left join group_members gm on gm.person_id = p.id
     where p.role = 'participant' and p.status <> 'rejected'
     group by p.id order by p.name`,
  );
  return json({ people });
}

function clean(input: Input) {
  const name = (input.name ?? '').trim();
  const phone = normalizePhone(input.phone ?? '');
  const email = (input.email ?? '').trim().toLowerCase() || null;
  const groupIds = Array.isArray(input.groupIds) ? input.groupIds.filter(isUuid) : [];
  if (!name) return { error: 'Namn saknas' } as const;
  if (name.length > 100 || (email?.length ?? 0) > 254) return { error: 'Namnet eller e-postadressen är för lång' } as const;
  if ((input.phone ?? '').trim() && !phone) return { error: 'Ogiltigt mobilnummer' } as const;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Ogiltig e-postadress' } as const;
  return { name, phone, email, groupIds } as const;
}

async function setGroups(q: Query, personId: string, groupIds: string[]) {
  await q(`delete from group_members where person_id = $1`, [personId]);
  if (groupIds.length) {
    await q(
      `insert into group_members (group_id, person_id) select unnest($2::uuid[]), $1 on conflict do nothing`,
      [personId, groupIds],
    );
  }
}

const conflict = (e: unknown) =>
  /duplicate key|unique/i.test(String((e as Error).message)) ? bad('Telefonnummer eller e-post används redan', 409) : null;

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const c = clean(await body<Input>(request));
  if ('error' in c) return bad(c.error!);
  const q = await db();
  try {
    const [p] = await q<{ id: string }>(
      `insert into people (name, phone, email, status, signed_up_via, activated_at) values ($1, $2, $3, 'active', 'admin', now()) returning id`,
      [c.name, c.phone, c.email],
    );
    await setGroups(q, p.id, c.groupIds);
    return json({ id: p.id }, 201);
  } catch (e) {
    return conflict(e) ?? bad('Kunde inte spara', 500);
  }
}

export async function PUT(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const input = await body<Input>(request);
  if (!isUuid(input.id)) return bad('Ogiltig deltagare');
  const c = clean(input);
  if ('error' in c) return bad(c.error!);
  const q = await db();
  try {
    const rows = await q(`update people set name = $2, phone = $3, email = $4 where id = $1 and role = 'participant' returning id`, [
      input.id, c.name, c.phone, c.email,
    ]);
    if (!rows.length) return bad('Deltagaren finns inte', 404);
    await setGroups(q, input.id, c.groupIds);
    return json({ id: input.id });
  } catch (e) {
    return conflict(e) ?? bad('Kunde inte spara', 500);
  }
}
export { OPTIONS } from './_lib/http.js';
