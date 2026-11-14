// GET  /api/notice?id= -> en skickad notis med alla mottagare: levererad, läst och bekräftad.
// POST /api/notice {id, action: 'remind'} -> skickar notisen igen till dem som inte bekräftat.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { remindUnacknowledged } from './_lib/notify.js';
export { OPTIONS } from './_lib/http.js';

const fmt = (col: string) => `to_char(${col} at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI')`;

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return bad('Ogiltig notis');
  const q = await db();
  const [notice] = await q(
    `select id, title, body, audience, requires_ack, page_heading, ${fmt('created_at')} as sent_at from notices where id = $1`,
    [id],
  );
  if (!notice) return bad('Notisen finns inte', 404);
  const recipients = await q(
    `select p.id, p.name, p.phone, r.delivered_via, ${fmt('r.read_at')} as read_at,
       ${fmt('r.acknowledged_at')} as acknowledged_at, ${fmt('r.reminded_at')} as reminded_at
     from notice_recipients r join people p on p.id = r.person_id
     where r.notice_id = $1
     order by (r.acknowledged_at is not null), (r.read_at is not null), p.name`,
    [id],
  );
  return json({ notice, recipients });
}

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<{ id?: string; action?: string }>(request);
  if (!isUuid(b.id) || b.action !== 'remind') return bad('Ogiltig åtgärd');
  const q = await db();
  return json({ reminded: await remindUnacknowledged(q, b.id!) });
}
