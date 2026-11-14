// POST /api/logout {everywhere?: boolean} -> loggar ut. Med everywhere slutar alla inloggningar gälla.
import { clearCookie, currentUser, revokeTokens } from './_lib/auth.js';
import { body, json } from './_lib/http.js';

export async function POST(request: Request) {
  const { everywhere } = await body<{ everywhere?: boolean }>(request);
  if (everywhere) {
    const user = await currentUser(request);
    if (user) await revokeTokens(user.id);
  }
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
export { OPTIONS } from './_lib/http.js';
