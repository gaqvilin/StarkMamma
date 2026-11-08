// POST /api/login {password} -> sätter inloggningscookie.  GET /api/login -> { admin }.
import { checkPassword, isAdmin, sessionCookie } from './_lib/auth.js';
import { bad, body, json } from './_lib/http.js';

export async function GET(request: Request) {
  return json({ admin: isAdmin(request) });
}

export async function POST(request: Request) {
  const { password } = await body<{ password?: string }>(request);
  if (!checkPassword(password)) return bad('Fel lösenord', 401);
  return json({ admin: true }, 200, { 'set-cookie': sessionCookie() });
}
