// Google/Facebook-inloggning i demoläge (leverantören simuleras).
import { describe, expect, it } from 'vitest';

process.env.DEMO_DB = '1';

async function flow(provider: string, as: string, opts: { app?: boolean; dropNonce?: boolean } = {}) {
  const start = await import('../api/oauth-start');
  const cb = await import('../api/oauth-callback');
  const r1 = await start.GET(new Request(`http://localhost/api/oauth-start?provider=${provider}&as=${encodeURIComponent(as)}${opts.app ? '&app=1' : ''}`));
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

  it('mobilappen får en token via starkmamma://login', async () => {
    const r = await flow('facebook', 'starkmammavarberg@gmail.com', { app: true });
    expect(r.headers.get('location')).toMatch(/^starkmamma:\/\/login\?token=/);
  });

  it('okänd e-post får ett tydligt fel och inget konto skapas', async () => {
    const r = await flow('google', 'okand@example.com');
    expect(r.headers.get('location')).toMatch(/^\/\?login_error=/);
    expect(decodeURIComponent(r.headers.get('location')!)).toContain('Be Emma lägga till dig');
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
