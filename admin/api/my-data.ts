// GET /api/my-data -> alla uppgifter som finns sparade om den inloggade (GDPR, rätt till tillgång).
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const q = await db();
  const one = (text: string) => q(text, [user.id]);
  const [person] = await one(`select name, email, phone, status, signed_up_via, created_at, activated_at from people where id = $1`);
  return json({
    person,
    groups: await one(`select g.weekday, g.start_time, g.place, r.name as round from group_members gm join groups g on g.id = gm.group_id join rounds r on r.id = g.round_id where gm.person_id = $1`),
    bookings: await one(`select s.starts_at, s.place, b.source, b.status from bookings b join sessions s on s.id = b.session_id where b.person_id = $1`),
    registrations: await one(`select r.name as round, g.per_week, g.status, g.created_at from registrations g join rounds r on r.id = g.round_id where g.person_id = $1`),
    charges: await one(`select description, amount, status, due_on, created_at from charges where person_id = $1`),
    punch_cards: await one(`select kind, total, remaining, valid_until from punch_cards where person_id = $1`),
    notices: await one(`select n.title, n.created_at, r.read_at, r.acknowledged_at from notice_recipients r join notices n on n.id = r.notice_id where r.person_id = $1`),
    online: await one(`select p.name, a.source, a.granted_at from online_access a join online_programs p on p.id = a.program_id where a.person_id = $1`),
    logins: await one(`select provider, email, created_at from identities where person_id = $1`),
  });
}
