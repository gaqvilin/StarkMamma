// POST /api/logout
import { clearCookie } from './_lib/auth.js';
import { json } from './_lib/http.js';

export async function POST() {
  return json({ admin: false }, 200, { 'set-cookie': clearCookie() });
}
