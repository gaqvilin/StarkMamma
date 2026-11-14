// GET  /api/my-notices -> den inloggades notiser (nyast först) med eventuell informationssida.
// POST /api/my-notices {id, acknowledge?} -> markera som läst, eller bekräfta att man läst (om notisen kräver det).
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const q = await db();
  const notices = await q(
    `select n.id, n.title, n.body, n.page_heading, n.page_text, n.page_link, r.read_at is not null as read,
       n.requires_ack, r.acknowledged_at is not null as acknowledged,
       to_char(n.created_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as sent_at
     from notice_recipients r join notices n on n.id = r.notice_id
     where r.person_id = $1 order by n.created_at desc limit 100`,
    [user.id],
  );
  return json({ notices });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id, acknowledge } = await body<{ id?: string; acknowledge?: boolean }>(request);
  if (!isUuid(id)) return bad('Ogiltig notis');
  const q = await db();
  const rows = await q(
    `update notice_recipients set read_at = coalesce(read_at, now()),
       acknowledged_at = case when $3 then coalesce(acknowledged_at, now()) else acknowledged_at end
     where notice_id = $1 and person_id = $2 returning 1`,
    [id, user.id, !!acknowledge],
  );
  return rows.length ? json({ ok: true }) : bad('Notisen finns inte', 404);
}
