// GET  /api/notices -> skickade notiser
// POST /api/notices {title, body, audience, page?: {heading, text, link?}}
//   audience: 'all' | 'unpaid' | 'group:<uuid>' | 'person:<uuid>'
// Levereras som pushnotis till den som har appen, annars via e-post (se _lib/notify.ts).
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { sendNotice } from './_lib/notify.js';

type Input = { title?: string; body?: string; audience?: string; requireAck?: boolean; page?: { heading?: string; text?: string; link?: string } };

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const q = await db();
  const notices = await q(
    `select n.id, n.title, n.body, n.audience, n.page_heading, n.page_text, n.page_link, n.requires_ack,
       (select count(*) from notice_recipients r where r.notice_id = n.id and r.acknowledged_at is not null)::int as acknowledged,
       to_char(n.created_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as sent_at,
       (select count(*) from notice_recipients r where r.notice_id = n.id)::int as recipients,
       (select count(*) from notice_recipients r where r.notice_id = n.id and r.read_at is not null)::int as read
     from notices n order by n.created_at desc limit 100`,
  );
  return json({ notices });
}

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const input = await body<Input>(request);
  const title = (input.title ?? '').trim();
  const text = (input.body ?? '').trim();
  const audience = input.audience ?? 'all';
  if (!title || !text) return bad('Rubrik och meddelande behövs');
  if (title.length > 120 || text.length > 400) return bad('Notisen är för lång');
  const groupId = audience.startsWith('group:') ? audience.slice(6) : null;
  const personId = audience.startsWith('person:') ? audience.slice(7) : null;
  if (!['all', 'unpaid'].includes(audience) && !isUuid(groupId) && !isUuid(personId)) return bad('Okänd mottagargrupp');

  const page = input.page;
  const heading = page?.heading?.trim() || null;
  const pageText = page?.text?.trim() || null;
  const link = page?.link?.trim() || null;
  if (page && (!heading || !pageText)) return bad('Informationssidan behöver rubrik och text');
  if ((heading?.length ?? 0) > 200 || (pageText?.length ?? 0) > 10000) return bad('Informationssidan är för lång');
  if (link && !/^https:\/\/\S+$/i.test(link)) return bad('Länken måste börja med https://');

  const q = await db();
  const people = await q<{ id: string }>(
    groupId
      ? `select gm.person_id as id from group_members gm join people p on p.id = gm.person_id where gm.group_id = $1 and p.status = 'active'`
      : personId
        ? `select id from people where id = $1`
        : audience === 'unpaid'
          ? `select distinct p.id from charges c join people p on p.id = c.person_id where c.status = 'unpaid' and p.status = 'active'`
          : `select id from people where role = 'participant' and status = 'active'`,
    groupId ? [groupId] : personId ? [personId] : [],
  );
  const n = await sendNotice(
    q,
    { title, body: text, audience, page: heading && pageText ? { heading, text: pageText, link } : null, requiresAck: !!input.requireAck },
    people.map((p) => p.id),
  );
  return json({ id: n.id, recipients: n.recipients }, 201);
}
export { OPTIONS } from './_lib/http.js';
