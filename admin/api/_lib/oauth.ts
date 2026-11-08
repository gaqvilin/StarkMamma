// Inloggning med Google och Facebook (OAuth 2.0, authorization code-flödet på servern).
// Kontot kopplas till en befintlig person via verifierad e-postadress; okända konton
// skapas inte automatiskt, eftersom Emma bestämmer vilka som är deltagare.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type Provider = 'google' | 'facebook';
export const PROVIDERS: Provider[] = ['google', 'facebook'];

const secret = () => process.env.AUTH_SECRET || (process.env.DEMO_DB ? 'demo-secret' : '');
export const NONCE_COOKIE = 'sm_oauth';

export const baseUrl = (request: Request) => process.env.PUBLIC_URL || new URL(request.url).origin;
export const redirectUri = (request: Request) => `${baseUrl(request)}/api/oauth-callback`;
export const APP_REDIRECT = 'starkmamma://login';

export function configured(p: Provider): boolean {
  if (process.env.DEMO_DB) return true;
  return p === 'google'
    ? !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    : !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

interface State {
  p: Provider;
  app: boolean;   // true = mobilappen, svaret går till starkmamma://login
  n: string;      // nonce, jämförs med cookie (skydd mot CSRF)
  exp: number;
}

export function makeState(p: Provider, app: boolean): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ p, app, n: nonce, exp: Date.now() + 10 * 60_000 } satisfies State)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return { state: `${payload}.${sig}`, nonce };
}

export function readState(state: string | null, nonceCookie: string | null): State | null {
  if (!state || !secret()) return null;
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as State;
  if (s.exp < Date.now() || !PROVIDERS.includes(s.p)) return null;
  if (!nonceCookie || nonceCookie !== s.n) return null;
  return s;
}

export function authorizeUrl(request: Request, p: Provider, state: string): string {
  if (process.env.DEMO_DB) {
    // Demoläge: hoppa över leverantören och låtsas att den svarade direkt.
    const as = new URL(request.url).searchParams.get('as') ?? 'starkmammavarberg@gmail.com';
    return `${redirectUri(request)}?code=${encodeURIComponent(`demo:${as}`)}&state=${encodeURIComponent(state)}`;
  }
  if (p === 'google') {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri(request),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    return u.toString();
  }
  const u = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  u.search = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    redirect_uri: redirectUri(request),
    response_type: 'code',
    scope: 'email,public_profile',
    state,
  }).toString();
  return u.toString();
}

export interface ProviderProfile {
  subject: string;
  email: string | null;
  emailVerified: boolean;
}

/** Byter koden mot användarens id och e-post hos leverantören. */
export async function exchange(request: Request, p: Provider, code: string): Promise<ProviderProfile> {
  if (process.env.DEMO_DB && code.startsWith('demo:')) {
    const email = code.slice(5).toLowerCase();
    return { subject: `demo-${p}-${email}`, email, emailVerified: true };
  }
  if (p === 'google') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(request),
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error('Google svarade inte');
    const { id_token } = (await res.json()) as { id_token?: string };
    if (!id_token) throw new Error('Google svarade inte');
    // id_token kommer direkt från Googles token-endpoint över TLS, så innehållet kan läsas utan
    // separat signaturkontroll (OpenID Connect Core 3.1.3.7). aud kontrolleras ändå.
    const claims = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString()) as {
      sub: string; email?: string; email_verified?: boolean; aud: string;
    };
    if (claims.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Fel mottagare för Google-inloggningen');
    return { subject: claims.sub, email: claims.email?.toLowerCase() ?? null, emailVerified: !!claims.email_verified };
  }
  const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
  tokenUrl.search = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    client_secret: process.env.FACEBOOK_APP_SECRET!,
    redirect_uri: redirectUri(request),
    code,
  }).toString();
  const t = await fetch(tokenUrl);
  if (!t.ok) throw new Error('Facebook svarade inte');
  const { access_token } = (await t.json()) as { access_token?: string };
  const me = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,email&access_token=${encodeURIComponent(access_token ?? '')}`);
  if (!me.ok) throw new Error('Facebook svarade inte');
  const profile = (await me.json()) as { id: string; email?: string };
  // Facebook lämnar bara ut bekräftade e-postadresser.
  return { subject: profile.id, email: profile.email?.toLowerCase() ?? null, emailVerified: !!profile.email };
}
