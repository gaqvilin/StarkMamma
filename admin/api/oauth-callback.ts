// GET /api/oauth-callback?code&state -> loggar in och skickar tillbaka till admin eller appen.
import { createHash, randomBytes } from 'node:crypto';
import { issueToken, sessionCookie } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { APP_REDIRECT, NONCE_COOKIE, exchange, readState } from './_lib/oauth.js';
import { findOrCreateByEmail } from './_lib/signup.js';

const NO_EMAIL = 'Vi fick ingen e-postadress från kontot. Logga in med din e-post och en kod i stället.';

function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  headers.append('set-cookie', `${NONCE_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0`);
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const nonce = (request.headers.get('cookie') || '')
    .split(';').map((c) => c.trim()).find((c) => c.startsWith(`${NONCE_COOKIE}=`))?.slice(NONCE_COOKIE.length + 1) ?? null;
  const state = readState(params.get('state'), nonce);
  const fail = (msg: string, app = state?.app) =>
    redirect(app ? `${APP_REDIRECT}?error=${encodeURIComponent(msg)}` : `/?login_error=${encodeURIComponent(msg)}`);

  if (!state) return fail('Inloggningen tog för lång tid eller avbröts. Försök igen.', false);
  const code = params.get('code');
  if (!code) return fail('Inloggningen avbröts.');

  let profile;
  try {
    profile = await exchange(request, state.p, code);
  } catch {
    return fail('Det gick inte att logga in just nu. Försök igen.');
  }

  const q = await db();
  let [person] = await q<{ id: string }>(
    `select person_id as id from identities where provider = $1 and subject = $2`,
    [state.p, profile.subject],
  );
  if (!person) {
    if (!profile.email || !profile.emailVerified) return fail(NO_EMAIL);
    // Emmas konto kopplas aldrig automatiskt till ett Facebook-konto via e-post: Facebook anger
    // inte uttryckligen att adressen är verifierad. Hon loggar in med e-post och kod i stället.
    if (state.p === 'facebook') {
      const [owner] = await q<{ role: string }>(`select role from people where lower(email) = $1`, [profile.email]);
      if (owner?.role === 'trainer') return fail('Logga in med din e-post och en kod.');
    }
    person = await findOrCreateByEmail(q, profile.email, state.p, profile.name);
    await q(
      `insert into identities (provider, subject, person_id, email) values ($1, $2, $3, $4) on conflict do nothing`,
      [state.p, profile.subject, person.id, profile.email],
    );
  }
  const [{ status }] = await q<{ status: string }>(`select status from people where id = $1`, [person.id]);
  if (status === 'rejected') return fail('Kontot är inte aktivt. Kontakta Emma.');

  if (state.app) {
    // Ingen token i länken: en kortlivad engångskod som bara kan bytas av appen som har PKCE-verifieraren.
    const exchangeCode = randomBytes(32).toString('base64url');
    await q(
      `insert into oauth_exchanges (code_hash, person_id, code_challenge, expires_at) values ($1, $2, $3, now() + interval '5 minutes')`,
      [createHash('sha256').update(exchangeCode).digest('hex'), person.id, state.c],
    );
    return redirect(`${APP_REDIRECT}?code=${encodeURIComponent(exchangeCode)}`);
  }
  return redirect('/', [sessionCookie(await issueToken(person.id))]);
}
