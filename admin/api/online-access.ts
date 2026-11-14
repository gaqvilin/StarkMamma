// POST /api/online-access {programId, personId, action: 'grant' | 'revoke'} -> Emma ger eller tar bort tillgång för hand.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<{ programId?: string; personId?: string; action?: string }>(request);
  if (!isUuid(b.programId) || !isUuid(b.personId)) return bad('Ogiltigt program eller person');
  const q = await db();
  if (b.action === 'grant') {
    await q(`insert into online_access (program_id, person_id, source) values ($1, $2, 'manual') on conflict do nothing`, [b.programId, b.personId]);
  } else if (b.action === 'revoke') {
    await q(`delete from online_access where program_id = $1 and person_id = $2`, [b.programId, b.personId]);
    // Obetald beställning stryks, så att "Jag har swishat" inte kan ge tillgången tillbaka.
    await q(`update charges set status = 'cancelled' where online_program_id = $1 and person_id = $2 and status = 'unpaid'`, [b.programId, b.personId]);
  } else return bad('Okänd åtgärd');
  return json({ ok: true });
}
