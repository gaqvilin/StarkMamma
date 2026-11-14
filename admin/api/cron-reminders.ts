// GET /api/cron-reminders (Vercel Cron, varje dag 16.00 UTC) -> skickar
//  1. "Kommer du imorgon?" till alla som är bokade på morgondagens pass och inte svarat,
//  2. påminnelse om betalningar som förfaller om 2 dagar.
// Skyddas med CRON_SECRET (Vercel skickar den som Bearer-token).
import { db } from './_lib/db.js';
import { bad, json } from './_lib/http.js';
import { sendNotice } from './_lib/notify.js';
import { ROSTER_CTE } from './_lib/roster.js';
import { now } from './_lib/time.js';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return bad('Nekad', 401);
  const q = await db();
  const t = now().toISOString();
  const sessions = await q<{ id: string; time: string; place: string }>(
    `select id, to_char(starts_at at time zone 'Europe/Stockholm', 'HH24.MI') as time, place from sessions
     where status <> 'cancelled'
       and (starts_at at time zone 'Europe/Stockholm')::date = (($1::timestamptz at time zone 'Europe/Stockholm')::date + 1)`,
    [t],
  );
  let reminders = 0;
  for (const s of sessions) {
    const people = await q<{ person_id: string }>(
      `with s as (select * from sessions where id = $1), ${ROSTER_CTE}
       select r.person_id from roster r join people p on p.id = r.person_id where r.status = 'booked' and p.status = 'active'`,
      [s.id],
    );
    const tip = s.place === 'Gymmet' ? 'Rena inomhusskor, handduk och vattenflaska.' : 'Vi kör i Ladan, klä dig i lager.';
    reminders += (
      await sendNotice(
        q,
        { title: `Imorgon kl ${s.time} i ${s.place}`, body: `Tryck "Jag kommer" i appen, eller lämna återbud. ${tip}`, audience: `session:${s.id}` },
        people.map((p) => p.person_id),
      )
    ).recipients;
  }
  const due = await q<{ person_id: string; description: string; amount: number }>(
    `select person_id, description, amount from charges
     where status = 'unpaid' and due_on = (($1::timestamptz at time zone 'Europe/Stockholm')::date + 2)`,
    [t],
  );
  for (const c of due) {
    await sendNotice(
      q,
      { title: 'Påminnelse om betalning', body: `${c.description}, ${c.amount} kr, ska vara betald om två dagar. Betala enkelt under Betala i appen.`, audience: `person:${c.person_id}` },
      [c.person_id],
    );
  }
  return json({ sessions: sessions.length, reminders, payments: due.length });
}
