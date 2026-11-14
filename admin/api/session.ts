// GET /api/session?id=<uuid> -> passet, deltagarlistan och kön.
// PUT /api/session {id, date?, time?, place?, cancelled?, note?, notify?} -> flytta, byt lokal eller ställ in.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { sendNotice } from './_lib/notify.js';
import { ROSTER_CTE } from './_lib/roster.js';

const ROSTER = ROSTER_CTE;

export async function GET(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return bad('Ogiltigt pass');

  const q = await db();
  const [session] = await q(
    `select s.id, s.place, s.capacity, s.status, s.note, s.kind, s.group_id,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') as date,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'HH24.MI') as time
     from sessions s where s.id = $1`,
    [id],
  );
  if (!session) return bad('Passet finns inte', 404);

  const roster = await q(
    `with s as (select * from sessions where id = $1), ${ROSTER_CTE}
     select p.id, p.name, p.phone, r.status, r.source
     from roster r join people p on p.id = r.person_id
     order by (r.status like 'cancelled%'), p.name`,
    [id],
  );
  const queue = await q(
    `select p.id, p.name, p.phone from waitlist w join people p on p.id = w.person_id
     where w.session_id = $1 order by w.created_at`,
    [id],
  );
  const [notice] = await q<{ id: string }>(
    `select n.id, n.title, n.requires_ack,
       to_char(n.created_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24.MI') as sent_at,
       (select count(*) from notice_recipients r where r.notice_id = n.id)::int as recipients,
       (select count(*) from notice_recipients r where r.notice_id = n.id and r.acknowledged_at is not null)::int as acknowledged,
       coalesce((select json_agg(p.name order by p.name) from notice_recipients r join people p on p.id = r.person_id
                 where r.notice_id = n.id and r.acknowledged_at is null), '[]') as missing
     from notices n where n.audience = $1 and n.requires_ack order by n.created_at desc limit 1`,
    [`session:${id}`],
  );
  return json({ session, roster, queue, notice: notice ?? null });
}

type Update = { id?: string; date?: string; time?: string; place?: string; cancelled?: boolean; note?: string; notify?: boolean };

export async function PUT(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const u = await body<Update>(request);
  if (!isUuid(u.id)) return bad('Ogiltigt pass');
  if (u.date && !/^\d{4}-\d{2}-\d{2}$/.test(u.date)) return bad('Ogiltigt datum');
  if (u.time && !/^\d{1,2}[.:]\d{2}$/.test(u.time)) return bad('Ogiltig tid');
  if (u.place !== undefined && !u.place.trim()) return bad('Lokal saknas');
  const q = await db();
  const [before] = await q<{ date: string; time: string; place: string; status: string }>(
    `select to_char(starts_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') as date,
            to_char(starts_at at time zone 'Europe/Stockholm', 'HH24.MI') as time, place, status
     from sessions where id = $1`,
    [u.id],
  );
  if (!before) return bad('Passet finns inte', 404);
  const date = u.date ?? before.date;
  const time = (u.time ?? before.time).replace(':', '.');
  const place = u.place?.trim() ?? before.place;
  const moved = date !== before.date || time !== before.time;
  const status = u.cancelled === true ? 'cancelled' : u.cancelled === false ? (moved || before.status === 'moved' ? 'moved' : 'planned') : moved ? 'moved' : before.status;
  await q(
    `update sessions set
       original_starts_at = case when $5 and original_starts_at is null then starts_at else original_starts_at end,
       starts_at = (($2::date) + ($3::time)) at time zone 'Europe/Stockholm',
       place = $4, status = $6, note = coalesce($7, note)
     where id = $1`,
    [u.id, date, time.replace('.', ':'), place, moved, status, u.note?.trim() || null],
  );

  let notified = 0;
  if (u.notify) {
    const people = await q<{ person_id: string }>(
      `with s as (select * from sessions where id = $1), ${ROSTER} select person_id from roster where status in ('booked', 'attending')`,
      [u.id],
    );
    const label = `${Number(before.date.slice(8))}/${Number(before.date.slice(5, 7))} ${before.time}`;
    const title = status === 'cancelled' ? `Inställt pass ${label}` : moved ? `Ändrad tid: passet ${label}` : `Ändrad lokal ${label}`;
    const text =
      status === 'cancelled'
        ? `Passet ${label} är tyvärr inställt.${u.note ? ' ' + u.note : ''}`
        : `Passet körs ${Number(date.slice(8))}/${Number(date.slice(5, 7))} kl ${time} i ${place}.${u.note ? ' ' + u.note : ''}`;
    // Inställda och flyttade pass kräver att deltagarna bekräftar att de sett beskedet.
    notified = (
      await sendNotice(q, { title, body: text, audience: `session:${u.id}`, requiresAck: true }, people.map((p) => p.person_id))
    ).recipients;
  }
  return json({ ok: true, notified });
}
export { OPTIONS } from './_lib/http.js';
