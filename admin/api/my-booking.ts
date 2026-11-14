// POST /api/my-booking {sessionId, action, source?}
//   action: 'cancel' (återbud) | 'undo' (ångra återbud) | 'attend' (jag kommer) |
//           'book' (med source 'credit' | 'punch_card' | 'drop_in') | 'queue' | 'unqueue'
import { requireUser } from './_lib/auth.js';
import { RuleError, Source, book, cancel, joinWaitlist, setAttendance, undoCancel } from './_lib/bookings.js';
import { db } from './_lib/db.js';
import { guard } from './_lib/guard.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { now } from './_lib/time.js';
export { OPTIONS } from './_lib/http.js';

export async function POST(request: Request) {
  const user = await requireUser(request, { active: true });
  if (user instanceof Response) return user;
  const b = await body<{ sessionId?: string; action?: string; source?: Source }>(request);
  if (!isUuid(b.sessionId)) return bad('Ogiltigt pass');
  const q = await db();
  const t = now();
  return guard(async () => {
    switch (b.action) {
      case 'cancel':
        return json(await cancel(q, b.sessionId!, user.id, t));
      case 'undo':
        await undoCancel(q, b.sessionId!, user.id, t);
        return json({ ok: true });
      case 'attend':
        await setAttendance(q, b.sessionId!, user.id, 'attending', t);
        return json({ ok: true });
      case 'book':
        if (!['credit', 'punch_card', 'drop_in'].includes(b.source ?? '')) throw new RuleError('Välj hur du vill betala passet');
        return json(await book(q, b.sessionId!, user.id, b.source!, t));
      case 'queue':
        await joinWaitlist(q, b.sessionId!, user.id, t);
        return json({ ok: true });
      case 'unqueue':
        await q(`delete from waitlist where session_id = $1 and person_id = $2`, [b.sessionId, user.id]);
        return json({ ok: true });
      default:
        throw new RuleError('Okänd åtgärd');
    }
  });
}
