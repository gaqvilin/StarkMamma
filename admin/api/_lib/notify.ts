// Skapar notiser och levererar dem. Leverans: Expo Push (mobilappen) för den som har en
// push-token, annars e-post via Resend om nyckeln finns. Inga sms.
import type { Query } from './db.js';

export interface NoticeInput {
  title: string;
  body: string;
  audience: string;
  page?: { heading: string; text: string; link?: string | null } | null;
  /** Mottagaren måste bekräfta att hon läst. Emma ser vilka som bekräftat. */
  requiresAck?: boolean;
}

/** Skapar en notis till de angivna personerna och försöker leverera den. Returnerar antal mottagare. */
export async function sendNotice(q: Query, n: NoticeInput, personIds: string[]): Promise<{ id: string; recipients: number }> {
  const [row] = await q<{ id: string }>(
    `insert into notices (title, body, page_heading, page_text, page_link, audience, requires_ack, sent_by)
     values ($1, $2, $3, $4, $5, $6, $7, (select id from people where role = 'trainer' limit 1)) returning id`,
    [n.title, n.body, n.page?.heading ?? null, n.page?.text ?? null, n.page?.link ?? null, n.audience, !!n.requiresAck],
  );
  const ids = [...new Set(personIds)];
  if (ids.length) {
    await q(
      `insert into notice_recipients (notice_id, person_id) select $1, unnest($2::uuid[]) on conflict do nothing`,
      [row.id, ids],
    );
    await deliver(q, row.id).catch(() => {});
  }
  return { id: row.id, recipients: ids.length };
}

export async function deliver(q: Query, noticeId: string) {
  if (process.env.DEMO_DB) return; // ingen riktig leverans lokalt
  const [n] = await q<{ title: string; body: string }>(`select title, body from notices where id = $1`, [noticeId]);
  const tokens = await q<{ person_id: string; token: string }>(
    `select t.person_id, t.token from notice_recipients r join push_tokens t on t.person_id = r.person_id
     where r.notice_id = $1 and t.kind = 'expo' and r.delivered_via is null`,
    [noticeId],
  );
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(batch.map((t) => ({ to: t.token, title: n.title, body: n.body, sound: 'default', data: { noticeId } }))),
    });
    if (res.ok) {
      await q(`update notice_recipients set delivered_via = 'expo' where notice_id = $1 and person_id = any($2::uuid[])`, [
        noticeId,
        batch.map((t) => t.person_id),
      ]);
    }
  }
  if (!process.env.RESEND_API_KEY) return;
  const rest = await q<{ person_id: string; email: string }>(
    `select r.person_id, p.email from notice_recipients r join people p on p.id = r.person_id
     where r.notice_id = $1 and r.delivered_via is null and p.email is not null`,
    [noticeId],
  );
  for (const r of rest) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'StarkMamma <no-reply@starkmamma.com>',
        to: r.email,
        subject: n.title,
        text: `${n.body}\n\nÖppna StarkMamma-appen för mer information.`,
      }),
    });
    if (res.ok) await q(`update notice_recipients set delivered_via = 'email' where notice_id = $1 and person_id = $2`, [noticeId, r.person_id]);
  }
}

/** Skickar notisen igen till de mottagare som inte har bekräftat. Returnerar hur många. */
export async function remindUnacknowledged(q: Query, noticeId: string): Promise<number> {
  const rows = await q<{ person_id: string }>(
    `update notice_recipients set delivered_via = null, reminded_at = now()
     where notice_id = $1 and acknowledged_at is null returning person_id`,
    [noticeId],
  );
  if (rows.length) await deliver(q, noticeId).catch(() => {});
  return rows.length;
}
