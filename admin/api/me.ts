// GET /api/me -> den inloggade personen och rollen ('trainer' = Emma, 'participant' = deltagare).
import { currentUser } from './_lib/auth.js';
import { json } from './_lib/http.js';

export async function GET(request: Request) {
  return json({ user: await currentUser(request) });
}
export { OPTIONS } from './_lib/http.js';
