// POST /api/booking {sessionId, personId, action, source?} -> Emma ändrar en persons bokning på ett pass.
//   action: 'cancel_in_time' | 'cancel_late' | 'restore' | 'attended' | 'no_show' | 'add' | 'queue_remove'
//   add: source 'credit' | 'punch_card' | 'drop_in' (Emma kan lägga till även när passet är fullt)
import { requireTrainer } from './_lib/auth.js';
import { RuleError, Source, book, cancel, setAttendance, undoCancel } from './_lib/bookings.js';
import { db } from './_lib/db.js';
import { guard } from './_lib/guard.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { now } from './_lib/time.js';

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<{ sessionId?: string; personId?: string; action?: string; source?: Source }>(request);
  if (!isUuid(b.sessionId) || !isUuid(b.personId)) return bad('Ogiltigt pass eller person');
  const q = await db();
  const t = now();
  return guard(async () => {
    switch (b.action) {
      case 'cancel_in_time':
      case 'cancel_late':
        return json(await cancel(q, b.sessionId!, b.personId!, t, b.action === 'cancel_in_time' ? 'cancelled_in_time' : 'cancelled_late'));
      case 'restore':
        await undoCancel(q, b.sessionId!, b.personId!, t, true);
        return json({ ok: true });
      case 'attended':
      case 'no_show':
        await setAttendance(q, b.sessionId!, b.personId!, b.action, t);
        return json({ ok: true });
      case 'add':
        if (!['credit', 'punch_card', 'drop_in'].includes(b.source ?? '')) throw new RuleError('Välj hur passet betalas');
        return json(await book(q, b.sessionId!, b.personId!, b.source!, t, true));
      case 'queue_remove':
        await q(`delete from waitlist where session_id = $1 and person_id = $2`, [b.sessionId, b.personId]);
        return json({ ok: true });
      default:
        throw new RuleError('Okänd åtgärd');
    }
  });
}
