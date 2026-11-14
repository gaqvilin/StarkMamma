// Inloggning med Google eller Facebook i den riktiga appen. Öppnar inloggningen i en säker
// webbläsarruta. Servern skickar tillbaka en kortlivad engångskod till starkmamma://login, och
// appen byter den mot en inloggning med PKCE: bara appen som startade inloggningen har den
// hemliga verifieraren, så en annan app som fångar länken kan inte använda koden.
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, api } from './api';

export type OAuthResult = { token: string } | { error: string } | { cancelled: true };

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function signInWith(provider: 'google' | 'facebook'): Promise<OAuthResult> {
  const verifier = base64url(Crypto.getRandomBytes(32));
  const challenge = (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 })
  ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await WebBrowser.openAuthSessionAsync(
    `${API_URL}/api/oauth-start?provider=${provider}&app=1&code_challenge=${challenge}`,
    'starkmamma://login',
  );
  if (res.type !== 'success') return { cancelled: true };
  const params = new URL(res.url).searchParams;
  const code = params.get('code');
  if (!code) return { error: params.get('error') ?? 'Inloggningen misslyckades' };
  try {
    const r = await api<{ token: string }>('oauth-exchange', { method: 'POST', body: { code, verifier } });
    return { token: r.token };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
