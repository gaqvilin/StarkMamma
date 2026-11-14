// POST /api/profile {name, phone} -> den inloggade fyller i eller ändrar sitt namn och telefonnummer.
import { csrfBlocked, currentUser, normalizePhone } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, json } from './_lib/http.js';

export async function POST(request: Request) {
  if (csrfBlocked(request)) return bad('Förfrågan nekad', 403);
  const user = await currentUser(request);
  if (!user) return bad('Inte inloggad', 401);
  const input = await body<{ name?: string; phone?: string }>(request);
  const name = (input.name ?? '').trim().replace(/\s+/g, ' ');
  const phone = normalizePhone(input.phone ?? '');
  if (name.length < 2 || name.length > 100) return bad('Skriv ditt för- och efternamn');
  if (!phone) return bad('Skriv ett giltigt mobilnummer');
  const q = await db();
  try {
    await q(`update people set name = $2, phone = $3 where id = $1`, [user.id, name, phone]);
  } catch {
    return bad('Mobilnumret används redan av ett annat konto. Kontakta Emma.', 409);
  }
  return json({ ok: true });
}
export { OPTIONS } from './_lib/http.js';
