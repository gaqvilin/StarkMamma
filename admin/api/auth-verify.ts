// POST /api/auth-verify {identifier, code} -> loggar in.
// Webben får en cookie; mobilappen använder token i svaret som Bearer-token.
import { hashCode, issueToken, parseIdentifier, sessionCookie } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, json } from './_lib/http.js';

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const input = await body<{ identifier?: string; code?: string }>(request);
  const id = parseIdentifier(input.identifier);
  const code = (input.code ?? '').replace(/\D/g, '');
  if (!id || code.length !== 6) return bad('Fel kod');

  const q = await db();
  const [row] = await q<{ code_id: string; person_id: string; code_hash: string; attempts: number; name: string; role: string }>(
    `select c.id as code_id, c.person_id, c.code_hash, c.attempts, p.name, p.role
     from people p join login_codes c on c.person_id = p.id
     where ${'phone' in id ? `regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g') = $1` : `lower(p.email) = $1`}
       and c.used_at is null and c.expires_at > now()
     order by c.created_at desc limit 1`,
    ['phone' in id ? id.phone : id.email],
  );
  if (!row || row.attempts >= MAX_ATTEMPTS) return bad('Koden har gått ut. Be om en ny.', 401);
  if (row.code_hash !== hashCode(row.person_id, code)) {
    await q(`update login_codes set attempts = attempts + 1 where id = $1`, [row.code_id]);
    return bad('Fel kod', 401);
  }
  await q(`update login_codes set used_at = now() where id = $1`, [row.code_id]);
  const token = issueToken(row.person_id);
  return json({ token, user: { id: row.person_id, name: row.name, role: row.role } }, 200, { 'set-cookie': sessionCookie(token) });
}
