// Inloggning med Google eller Facebook i den riktiga appen. Öppnar inloggningen i en säker
// webbläsarruta; servern (/api/oauth-start och /api/oauth-callback) skickar tillbaka
// en token till starkmamma://login. Kontot kopplas via e-postadressen, så Emma blir tränare.
import * as WebBrowser from 'expo-web-browser';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type OAuthResult = { token: string } | { error: string } | { cancelled: true };

export async function signInWith(provider: 'google' | 'facebook'): Promise<OAuthResult> {
  const res = await WebBrowser.openAuthSessionAsync(
    `${API_URL}/api/oauth-start?provider=${provider}&app=1`,
    'starkmamma://login',
  );
  if (res.type !== 'success') return { cancelled: true };
  const params = new URL(res.url).searchParams;
  const token = params.get('token');
  return token ? { token } : { error: params.get('error') ?? 'Inloggningen misslyckades' };
}
