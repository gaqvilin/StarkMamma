// PUT /api/groups {id, capacity?, minParticipants?} -> Emma ändrar max och minimiantal för en grupp.
// Max styr bara förslaget och visningen. Anmälan begränsas aldrig, och Emma kan alltid placera fler.
// Kommande pass i gruppen får samma max.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { now } from './_lib/time.js';
export { OPTIONS } from './_lib/http.js';

export async function PUT(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<{ id?: string; capacity?: number; minParticipants?: number }>(request);
  if (!isUuid(b.id)) return bad('Ogiltig grupp');
  const cap = b.capacity === undefined ? null : Math.round(Number(b.capacity));
  const min = b.minParticipants === undefined ? null : Math.round(Number(b.minParticipants));
  if (cap !== null && !(cap >= 1 && cap <= 200)) return bad('Max måste vara mellan 1 och 200');
  if (min !== null && !(min >= 0 && min <= 200)) return bad('Ogiltigt minimiantal');
  const q = await db();
  const rows = await q(
    `update groups set capacity = coalesce($2, capacity), min_participants = coalesce($3, min_participants) where id = $1 returning id`,
    [b.id, cap, min],
  );
  if (!rows.length) return bad('Gruppen finns inte', 404);
  if (cap !== null) {
    await q(`update sessions set capacity = $2 where group_id = $1 and starts_at > $3::timestamptz`, [b.id, cap, now().toISOString()]);
  }
  return json({ ok: true });
}
