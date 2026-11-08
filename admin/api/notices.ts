// GET  /api/notices -> skickade notiser
// POST /api/notices {title, body, audience, page?: {heading, text, link?}}
//   audience: 'all' | 'group:<uuid>'
// Notisen sparas med en mottagarlista. Själva leveransen (Expo Push / Web Push, e-post som reserv)
// kopplas på när deltagarappen registrerar push-token; tills dess står den som "väntar".
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';

type Input = { title?: string; body?: string; audience?: string; page?: { heading?: string; text?: string; link?: string } };

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const q = await db();
  const notices = await q(
    `select n.id, n.title, n.body, n.audience, n.page_heading, n.page_text, n.page_link,
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
  if (audience !== 'all' && !isUuid(groupId)) return bad('Okänd mottagargrupp');

  const page = input.page;
  const heading = page?.heading?.trim() || null;
  const pageText = page?.text?.trim() || null;
  const link = page?.link?.trim() || null;
  if (page && (!heading || !pageText)) return bad('Informationssidan behöver rubrik och text');
  if (link && !/^https:\/\/\S+$/i.test(link)) return bad('Länken måste börja med https://');

  const q = await db();
  const [n] = await q<{ id: string }>(
    `insert into notices (title, body, page_heading, page_text, page_link, audience, sent_by)
     values ($1, $2, $3, $4, $5, $6, (select id from people where role = 'trainer' limit 1)) returning id`,
    [title, text, heading, pageText, link, audience],
  );
  const recipients = await q<{ count: number }>(
    groupId
      ? `with ins as (insert into notice_recipients (notice_id, person_id)
           select $1, gm.person_id from group_members gm join people p on p.id = gm.person_id
           where gm.group_id = $2 and p.status = 'active' on conflict do nothing returning 1)
         select count(*)::int as count from ins`
      : `with ins as (insert into notice_recipients (notice_id, person_id)
           select $1, id from people where role = 'participant' and status = 'active' on conflict do nothing returning 1)
         select count(*)::int as count from ins`,
    groupId ? [n.id, groupId] : [n.id],
  );
  return json({ id: n.id, recipients: recipients[0]?.count ?? 0 }, 201);
}
