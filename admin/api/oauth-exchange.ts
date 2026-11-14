// POST /api/oauth-exchange {code, verifier} -> mobilappen byter engångskoden från Google/Facebook-
// inloggningen mot en token. Koden gäller i 5 minuter, en gång, och bara med rätt PKCE-verifierare.
import { createHash } from 'node:crypto';
import { USER_SELECT, issueToken } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function POST(request: Request) {
  const b = await body<{ code?: string; verifier?: string }>(request);
  if (typeof b.code !== 'string' || typeof b.verifier !== 'string' || b.verifier.length < 43 || b.verifier.length > 128)
    return bad('Ogiltig inloggning', 400);
  const challenge = createHash('sha256').update(b.verifier).digest('base64url');
  const q = await db();
  const [row] = await q<{ person_id: string }>(
    `update oauth_exchanges set used_at = now()
     where code_hash = $1 and code_challenge = $2 and used_at is null and expires_at > now()
     returning person_id`,
    [createHash('sha256').update(b.code).digest('hex'), challenge],
  );
  if (!row) return bad('Inloggningen har gått ut. Försök igen.', 401);
  const [user] = await q(`${USER_SELECT} where id = $1`, [row.person_id]);
  return json({ token: await issueToken(row.person_id), user });
}
