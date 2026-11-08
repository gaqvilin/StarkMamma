// POST /api/auth-verify {email, code} -> loggar in. Nya e-postadresser får ett konto som
// väntar på att Emma aktiverar det. Webben får en cookie; mobilappen använder token i svaret.
import { USER_SELECT, User, hashCode, issueToken, parseEmail, sessionCookie } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, json } from './_lib/http.js';
import { findOrCreateByEmail } from './_lib/signup.js';

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const input = await body<{ email?: string; identifier?: string; code?: string }>(request);
  const email = parseEmail(input.email ?? input.identifier);
  const code = (input.code ?? '').replace(/\D/g, '');
  if (!email || code.length !== 6) return bad('Fel kod');

  const q = await db();
  const [row] = await q<{ id: string; code_hash: string; attempts: number }>(
    `select id, code_hash, attempts from login_codes
     where email = $1 and used_at is null and expires_at > now()
     order by created_at desc limit 1`,
    [email],
  );
  if (!row || row.attempts >= MAX_ATTEMPTS) return bad('Koden har gått ut. Be om en ny.', 401);
  if (row.code_hash !== hashCode(email, code)) {
    await q(`update login_codes set attempts = attempts + 1 where id = $1`, [row.id]);
    return bad('Fel kod', 401);
  }
  await q(`update login_codes set used_at = now() where id = $1`, [row.id]);

  const person = await findOrCreateByEmail(q, email, 'email');
  const [user] = await q<User & Record<string, unknown>>(`${USER_SELECT} where id = $1`, [person.id]);
  if (user.status === 'rejected') return bad('Kontot är inte aktivt. Kontakta Emma.', 403);
  const token = issueToken(person.id);
  return json({ token, user }, 200, { 'set-cookie': sessionCookie(token) });
}
