// Film hos Bunny Stream (bunny.net). Bunny kodar om filmen till flera upplösningar och spelar den
// adaptivt, alltså komprimerat för mobilen. Uppspelning sker via en signerad länk som slutar
// gälla efter en stund, så att bara den som har tillgång kan se filmen.
//
// Miljövariabler: BUNNY_LIBRARY_ID, BUNNY_API_KEY (Stream-bibliotekets API-nyckel) och
// BUNNY_TOKEN_KEY (Token Authentication Key under bibliotekets Security-inställningar).
// Formaten nedan följer Bunnys dokumentation och kontrolleras mot ett riktigt konto vid driftsättning.
import { createHash } from 'node:crypto';

const API = 'https://video.bunnycdn.com';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const videoConfigured = () => !!(process.env.BUNNY_LIBRARY_ID && process.env.BUNNY_API_KEY && process.env.BUNNY_TOKEN_KEY);

/** Skapar en tom film hos Bunny och returnerar dess id. */
export async function createVideo(title: string): Promise<string> {
  const res = await fetch(`${API}/library/${process.env.BUNNY_LIBRARY_ID}/videos`, {
    method: 'POST',
    headers: { AccessKey: process.env.BUNNY_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ title: title.slice(0, 200) }),
  });
  if (!res.ok) throw new Error('Bunny svarade inte');
  const { guid } = (await res.json()) as { guid?: string };
  if (!guid) throw new Error('Bunny svarade inte');
  return guid;
}

/** Uppgifter för att ladda upp filen direkt från Emmas webbläsare till Bunny (TUS), utan att gå via vår server. */
export function uploadAuth(videoId: string, ttlSeconds = 6 * 3600) {
  const expire = Math.floor(Date.now() / 1000) + ttlSeconds;
  const lib = process.env.BUNNY_LIBRARY_ID!;
  return {
    endpoint: `${API}/tusupload`,
    headers: {
      AuthorizationSignature: sha256(`${lib}${process.env.BUNNY_API_KEY}${expire}${videoId}`),
      AuthorizationExpire: String(expire),
      VideoId: videoId,
      LibraryId: lib,
    },
  };
}

/** Signerad länk till Bunnys spelare, giltig i ttlSeconds. */
export function playUrl(videoId: string, ttlSeconds = 4 * 3600) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = sha256(`${process.env.BUNNY_TOKEN_KEY}${videoId}${expires}`);
  return `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_LIBRARY_ID}/${videoId}?token=${token}&expires=${expires}&autoplay=true&responsive=true`;
}

/** Status hos Bunny: 0–3 = laddas upp eller kodas om, 4 = klar, 5–6 = fel. */
export async function videoStatus(videoId: string): Promise<'processing' | 'ready' | 'failed'> {
  const res = await fetch(`${API}/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}`, {
    headers: { AccessKey: process.env.BUNNY_API_KEY!, accept: 'application/json' },
  });
  if (!res.ok) return 'processing';
  const { status } = (await res.json()) as { status?: number };
  return status === 4 ? 'ready' : status === 5 || status === 6 ? 'failed' : 'processing';
}
