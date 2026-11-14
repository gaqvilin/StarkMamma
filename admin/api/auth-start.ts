// POST /api/auth-start {email} -> skickar en engångskod till e-postadressen.
// Finns det inget konto skapas det först när koden har verifierats.
import { hashCode, newCode, parseEmail } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, json } from './_lib/http.js';
import { sendCode } from './_lib/send.js';

export async function POST(request: Request) {
  const input = await body<{ email?: string; identifier?: string }>(request);
  const email = parseEmail(input.email ?? input.identifier);
  if (!email) return bad('Skriv din e-postadress');

  const q = await db();
  // Begränsa per IP-adress också, så att ingen kan få oss att skicka mängder av mejl till olika adresser.
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  if (ip) {
    const [perIp] = await q<{ n: number }>(
      `select count(*)::int as n from login_codes where ip = $1 and created_at > now() - interval '1 hour'`,
      [ip],
    );
    if (perIp.n >= 20) return bad('För många försök. Vänta en stund och försök igen.', 429);
  }
  const [recent] = await q(`select 1 from login_codes where email = $1 and created_at > now() - interval '30 seconds'`, [email]);
  if (recent) return bad('Vänta en liten stund innan du ber om en ny kod', 429);
  const [hourly] = await q<{ n: number }>(
    `select count(*)::int as n from login_codes where email = $1 and created_at > now() - interval '1 hour'`,
    [email],
  );
  if (hourly.n >= 6) return bad('För många försök. Vänta en stund och försök igen.', 429);

  const code = newCode();
  const channel = await sendCode({ email }, code);
  const [person] = await q<{ id: string }>(`select id from people where lower(email) = $1`, [email]);
  await q(
    `insert into login_codes (person_id, email, code_hash, channel, expires_at, ip) values ($1, $2, $3, 'email', now() + interval '10 minutes', $4)`,
    [person?.id ?? null, email, hashCode(email, code), ip],
  );
  return json(channel === 'demo' ? { sent: true, demoCode: code } : { sent: true });
}
export { OPTIONS } from './_lib/http.js';
