// GET /api/oauth-start?provider=google|facebook[&app=1] -> skickar vidare till Google/Facebook.
// app=1&code_challenge=… används av mobilappen; då skickas en engångskod tillbaka till
// starkmamma://login, som appen byter mot en inloggning med /api/oauth-exchange (PKCE).
import { NONCE_COOKIE, PROVIDERS, Provider, authorizeUrl, configured, makeState } from './_lib/oauth.js';
import { bad } from './_lib/http.js';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const provider = params.get('provider') as Provider;
  if (!PROVIDERS.includes(provider)) return bad('Okänd inloggningstjänst');
  if (!configured(provider)) return bad('Den här inloggningen är inte påslagen än', 503);
  const app = params.get('app') === '1';
  // Mobilappen måste skicka en PKCE-utmaning, så att bara den app som startade inloggningen
  // kan byta resultatet mot en inloggning.
  const challenge = params.get('code_challenge') ?? undefined;
  if (app && !(challenge && /^[A-Za-z0-9_-]{43}$/.test(challenge))) return bad('code_challenge saknas');
  const { state, nonce } = makeState(provider, app, challenge);
  const secure = process.env.DEMO_DB ? '' : '; Secure';
  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl(request, provider, state),
      'set-cookie': `${NONCE_COOKIE}=${nonce}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
      'cache-control': 'no-store',
    },
  });
}
