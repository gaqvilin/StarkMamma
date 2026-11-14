// POST /api/auth-start {email} -> skickar en engångskod till e-postadressen.
// Finns det inget konto skapas det först när koden har verifierats.
import { hashCode, newCode, parseEmail } from './_lib/auth.js';
import { db, tx } from './_lib/db.js';
import { bad, body, json } from './_lib/http.js';
import { sendCode } from './_lib/send.js';

export async function POST(request: Request) {
  const input = await body<{ email?: string; identifier?: string }>(request);
  const email = parseEmail(input.email ?? input.identifier);
  if (!email) return bad('Skriv din e-postadress');

  const q = await db();
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const code = newCode();
  const [person] = await q<{ id: string }>(`select id from people where lower(email) = $1`, [email]);
  // Gränserna kontrolleras och koden sparas i en och samma sats under ett lås per adress, så att
  // samtidiga anrop inte kan skicka fler mejl än tillåtet. Per IP: högst 20 koder i timmen.
  const [, rows] = await tx([
    { text: `select pg_advisory_xact_lock(hashtext($1))`, params: [`login:${email}`] },
    {
      text: `insert into login_codes (person_id, email, code_hash, channel, expires_at, ip)
             select $1, $2, $3, 'email', now() + interval '10 minutes', $4
             where not exists (select 1 from login_codes where email = $2 and created_at > now() - interval '30 seconds')
               and (select count(*) from login_codes where email = $2 and created_at > now() - interval '1 hour') < 6
               and ($4::text is null or (select count(*) from login_codes where ip = $4 and created_at > now() - interval '1 hour') < 20)
             returning id`,
      params: [person?.id ?? null, email, hashCode(email, code), ip],
    },
  ]);
  if (!rows.length) return bad('Vänta en liten stund innan du ber om en ny kod', 429);
  let channel: string;
  try {
    channel = await sendCode({ email }, code);
  } catch (e) {
    await q(`delete from login_codes where id = $1`, [rows[0].id]);
    return bad((e as Error).message, 503);
  }
  return json(channel === 'demo' ? { sent: true, demoCode: code } : { sent: true });
}
export { OPTIONS } from './_lib/http.js';
