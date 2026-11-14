// POST /api/people-activate {id, action: 'activate' | 'reject', groupIds?} -> Emma aktiverar eller avböjer
// ett nytt konto. Vid aktivering kan grupper väljas direkt, och personen får en notis.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const input = await body<{ id?: string; action?: string; groupIds?: string[] }>(request);
  if (!isUuid(input.id)) return bad('Ogiltigt konto');
  if (input.action !== 'activate' && input.action !== 'reject') return bad('Okänd åtgärd');
  const q = await db();

  if (input.action === 'reject') {
    const rows = await q(`update people set status = 'rejected' where id = $1 and role = 'participant' returning id`, [input.id]);
    return rows.length ? json({ ok: true }) : bad('Kontot finns inte', 404);
  }

  const [p] = await q<{ name: string; phone: string | null }>(
    `select name, phone from people where id = $1 and role = 'participant'`,
    [input.id],
  );
  if (!p) return bad('Kontot finns inte', 404);
  if (!p.name) return bad('Personen har inte fyllt i sitt namn än');
  await q(`update people set status = 'active', activated_at = now() where id = $1`, [input.id]);
  const groupIds = Array.isArray(input.groupIds) ? input.groupIds.filter(isUuid) : [];
  if (groupIds.length) {
    await q(`insert into group_members (group_id, person_id) select unnest($2::uuid[]), $1 on conflict do nothing`, [input.id, groupIds]);
  }
  const [n] = await q<{ id: string }>(
    `insert into notices (title, body, audience, sent_by)
     values ('Ditt konto är aktiverat', 'Välkommen till StarkMamma! Nu kan du se dina pass, lämna återbud och boka.', $1,
             (select id from people where role = 'trainer' limit 1)) returning id`,
    [`person:${input.id}`],
  );
  await q(`insert into notice_recipients (notice_id, person_id) values ($1, $2)`, [n.id, input.id]);
  return json({ ok: true });
}
export { OPTIONS } from './_lib/http.js';
