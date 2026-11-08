// GET /api/auth-providers -> vilka inloggningstjänster som är påslagna.
import { PROVIDERS, configured } from './_lib/oauth.js';
import { json } from './_lib/http.js';

export async function GET() {
  return json({ providers: PROVIDERS.filter(configured) });
}
