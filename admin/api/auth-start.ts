// POST /api/auth-start {identifier} -> skickar en engångskod via sms eller e-post.
// Svaret är detsamma oavsett om personen finns, så att det inte går att lista medlemmar.
import { hashCode, newCode, parseIdentifier } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, json } from './_lib/http.js';
import { sendCode } from './_lib/send.js';

export async function POST(request: Request) {
  const { identifier } = await body<{ identifier?: string }>(request);
  const id = parseIdentifier(identifier);
  if (!id) return bad('Skriv ditt mobilnummer eller din e-postadress');

  const q = await db();
  const [person] = await q<{ id: string; phone: string | null; email: string | null }>(
    'phone' in id
      ? `select id, phone, email from people where regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $1`
      : `select id, phone, email from people where lower(email) = $1`,
    ['phone' in id ? id.phone : id.email],
  );
  if (!person) return json({ sent: true });

  const [recent] = await q(
    `select 1 from login_codes where person_id = $1 and created_at > now() - interval '30 seconds'`,
    [person.id],
  );
  if (recent) return bad('Vänta en liten stund innan du ber om en ny kod', 429);

  const code = newCode();
  const target = 'phone' in id ? { phone: person.phone } : { email: person.email };
  const channel = await sendCode(target, code);
  await q(
    `insert into login_codes (person_id, code_hash, channel, expires_at) values ($1, $2, $3, now() + interval '10 minutes')`,
    [person.id, hashCode(person.id, code), 'phone' in id ? 'sms' : 'email'],
  );
  return json(channel === 'demo' ? { sent: true, demoCode: code } : { sent: true });
}
