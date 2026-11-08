// GET /api/oauth-callback?code&state -> loggar in och skickar tillbaka till admin eller appen.
import { issueToken, sessionCookie } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { APP_REDIRECT, NONCE_COOKIE, exchange, readState } from './_lib/oauth.js';

const NOT_FOUND = 'Vi hittar inget konto med den e-postadressen. Be Emma lägga till dig, eller logga in med mobilnummer.';

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
    if (!profile.email || !profile.emailVerified) return fail(NOT_FOUND);
    [person] = await q<{ id: string }>(`select id from people where lower(email) = $1`, [profile.email]);
    if (!person) return fail(NOT_FOUND);
    await q(
      `insert into identities (provider, subject, person_id, email) values ($1, $2, $3, $4) on conflict do nothing`,
      [state.p, profile.subject, person.id, profile.email],
    );
  }

  const token = issueToken(person.id);
  return state.app
    ? redirect(`${APP_REDIRECT}?token=${encodeURIComponent(token)}`)
    : redirect('/', [sessionCookie(token)]);
}
