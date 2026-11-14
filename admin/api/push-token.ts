// POST /api/push-token {token, kind: 'expo' | 'webpush'} -> sparar mobilens push-adress för den inloggade.
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const b = await body<{ token?: string; kind?: string }>(request);
  const kind = b.kind === 'webpush' ? 'webpush' : 'expo';
  const token = (b.token ?? '').trim();
  if (!token || token.length > 2000) return bad('Ogiltig token');
  if (kind === 'expo' && !/^Expo(nent)?PushToken\[.+\]$/.test(token)) return bad('Ogiltig token');
  const q = await db();
  await q(
    `insert into push_tokens (person_id, kind, token) values ($1, $2, $3)
     on conflict (token) do update set person_id = excluded.person_id, kind = excluded.kind`,
    [user.id, kind, token],
  );
  return json({ ok: true });
}
