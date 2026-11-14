// Google/Facebook-inloggning i demoläge (leverantören simuleras).
import { describe, expect, it } from 'vitest';

process.env.DEMO_DB = '1';

import { createHash, randomBytes } from 'node:crypto';

const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');

async function flow(provider: string, as: string, opts: { app?: boolean; dropNonce?: boolean } = {}) {
  const start = await import('../api/oauth-start');
  const cb = await import('../api/oauth-callback');
  const r1 = await start.GET(new Request(`http://localhost/api/oauth-start?provider=${provider}&as=${encodeURIComponent(as)}${opts.app ? `&app=1&code_challenge=${challenge}` : ''}`));
  expect(r1.status).toBe(302);
  const nonce = r1.headers.get('set-cookie')!.split(';')[0];
  const r2 = await cb.GET(new Request(r1.headers.get('location')!, { headers: { cookie: opts.dropNonce ? '' : nonce } }));
  expect(r2.status).toBe(302);
  return r2;
}

describe('inloggning med Google och Facebook', () => {
  it('Emma loggar in med Google och kommer till admin', async () => {
    const r = await flow('google', 'StarkMammaVarberg@gmail.com');
    expect(r.headers.get('location')).toBe('/');
    const cookie = r.headers.getSetCookie().find((c) => c.startsWith('sm_session='))!.split(';')[0];
    const me = await import('../api/me');
    const res = await me.GET(new Request('http://localhost/api/me', { headers: { cookie } }));
    expect((await res.json()).user.role).toBe('trainer');
  });

  it('mobilappen får en engångskod (ingen token i länken) som bara kan bytas med rätt PKCE-verifierare', async () => {
    const r = await flow('google', 'starkmammavarberg@gmail.com', { app: true });
    const loc = r.headers.get('location')!;
    expect(loc).toMatch(/^starkmamma:\/\/login\?code=/);
    expect(loc).not.toContain('token');
    const code = new URL(loc.replace('starkmamma://', 'https://x/')).searchParams.get('code')!;
    const ex = await import('../api/oauth-exchange');
    const post = (v: string) => ex.POST(new Request('http://localhost/api/oauth-exchange', { method: 'POST', body: JSON.stringify({ code, verifier: v }) }));
    expect((await post(randomBytes(32).toString('base64url'))).status).toBe(401); // fel verifierare (annan app)
    const ok = await post(verifier);
    expect(ok.status).toBe(200);
    expect((await ok.json()).user.role).toBe('trainer');
    expect((await post(verifier)).status).toBe(401); // bara en gång
  });

  it('mobilappen måste skicka PKCE-utmaning', async () => {
    const start = await import('../api/oauth-start');
    expect((await start.GET(new Request('http://localhost/api/oauth-start?provider=google&app=1'))).status).toBe(400);
  });

  it('Emmas konto kopplas inte automatiskt till ett Facebook-konto via e-post', async () => {
    const r = await flow('facebook', 'starkmammavarberg@gmail.com');
    expect(decodeURIComponent(r.headers.get('location')!)).toContain('Logga in med din e-post och en kod');
  });

  it('okänd e-post får ett nytt konto med namnet ifyllt, som väntar på aktivering', async () => {
    const r = await flow('google', 'helt.ny@example.com');
    expect(r.headers.get('location')).toBe('/');
    const cookie = r.headers.getSetCookie().find((c) => c.startsWith('sm_session='))!.split(';')[0];
    const me = await import('../api/me');
    const user = (await (await me.GET(new Request('http://localhost/api/me', { headers: { cookie } }))).json()).user;
    expect(user).toMatchObject({ name: 'Demo Person', status: 'pending', needs_profile: true });
  });

  it('utan nonce-cookie nekas inloggningen (skydd mot förfalskade anrop)', async () => {
    const r = await flow('google', 'starkmammavarberg@gmail.com', { dropNonce: true });
    expect(r.headers.get('location')).toMatch(/login_error/);
    expect(r.headers.getSetCookie().some((c) => c.startsWith('sm_session=') && !c.includes('Max-Age=0'))).toBe(false);
  });

  it('okänd tjänst avvisas', async () => {
    const start = await import('../api/oauth-start');
    expect((await start.GET(new Request('http://localhost/api/oauth-start?provider=myspace'))).status).toBe(400);
  });
});
