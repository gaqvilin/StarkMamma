// Film hos Bunny Stream: uppladdning, signerade länkar och åtkomst. Bunnys API simuleras.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

process.env.DEMO_DB = '1';
process.env.FAKE_NOW = '2026-11-14T10:00:00Z';
process.env.BUNNY_LIBRARY_ID = '12345';
process.env.BUNNY_API_KEY = 'api-key';
process.env.BUNNY_TOKEN_KEY = 'token-key';

let bunnyStatus = 3;
const realFetch = globalThis.fetch;
const calls: { url: string; init?: RequestInit }[] = [];
beforeAll(() => {
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.endsWith('/library/12345/videos') && init?.method === 'POST') return new Response(JSON.stringify({ guid: 'vid-1' }), { status: 200 });
    if (u.endsWith('/library/12345/videos/vid-1')) return new Response(JSON.stringify({ status: bunnyStatus }), { status: 200 });
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

type Mod = Record<string, (r: Request) => Promise<Response>>;
const m = async (name: string) => (await import(`../api/${name}.ts`)) as Mod;
async function call(name: string, method: string, auth: { cookie?: string; token?: string }, data?: unknown, query = '') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth.cookie) headers.cookie = auth.cookie;
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  const res = await (await m(name))[method](new Request(`http://localhost/api/${name}${query}`, { method, headers, body: data ? JSON.stringify(data) : undefined }));
  return { status: res.status, data: await res.json(), headers: res.headers };
}
async function login(email: string) {
  const s1 = await call('auth-start', 'POST', {}, { email });
  const s2 = await call('auth-verify', 'POST', {}, { email, code: s1.data.demoCode });
  return { cookie: s2.headers.get('set-cookie')!.split(';')[0], token: s2.data.token as string, id: s2.data.user.id as string };
}

describe('film hos Bunny Stream', () => {
  let emma: Awaited<ReturnType<typeof login>>;
  let anna: Awaited<ReturnType<typeof login>>;
  let ebba: Awaited<ReturnType<typeof login>>;
  let workoutId = '';

  beforeAll(async () => {
    emma = await login('starkmammavarberg@gmail.com');
    anna = await login('anna.berg@example.com');
    ebba = await login('ebba.berg@example.com');
    const p = (await call('online', 'POST', emma, { name: 'Filmprogram', price: 0 })).data.id;
    workoutId = (await call('workouts', 'POST', emma, { programId: p, title: 'Filmpass', body: 'Se filmen.' })).data.id;
    await call('online-access', 'POST', emma, { programId: p, personId: anna.id, action: 'grant' });
  });

  it('Emma får uppladdningsuppgifter med korrekt signatur', async () => {
    const r = await call('video-upload', 'POST', emma, { workoutId });
    expect(r.status).toBe(200);
    expect(r.data.endpoint).toBe('https://video.bunnycdn.com/tusupload');
    const { AuthorizationSignature, AuthorizationExpire, VideoId, LibraryId } = r.data.headers;
    expect(VideoId).toBe('vid-1');
    expect(LibraryId).toBe('12345');
    expect(AuthorizationSignature).toBe(createHash('sha256').update(`12345api-key${AuthorizationExpire}vid-1`).digest('hex'));
    // API-nyckeln skickas aldrig till webbläsaren
    expect(JSON.stringify(r.data)).not.toContain('api-key');
  });

  it('deltagare kan inte ladda upp', async () => {
    expect((await call('video-upload', 'POST', anna, { workoutId })).status).toBe(403);
  });

  it('filmen spelas först när Bunny är klar med komprimeringen', async () => {
    bunnyStatus = 3;
    expect((await call('video-play', 'GET', anna, undefined, `?workoutId=${workoutId}`)).status).toBe(409);
    bunnyStatus = 4;
    const r = await call('video-play', 'GET', anna, undefined, `?workoutId=${workoutId}`);
    expect(r.status).toBe(200);
    const u = new URL(r.data.url);
    expect(u.host).toBe('iframe.mediadelivery.net');
    expect(u.pathname).toBe('/embed/12345/vid-1');
    const expires = u.searchParams.get('expires')!;
    expect(u.searchParams.get('token')).toBe(createHash('sha256').update(`token-keyvid-1${expires}`).digest('hex'));
    expect(Number(expires)).toBeGreaterThan(Date.now() / 1000);
    expect(Number(expires)).toBeLessThan(Date.now() / 1000 + 5 * 3600); // slutar gälla efter några timmar
  });

  it('den som saknar tillgång får ingen länk', async () => {
    expect((await call('video-play', 'GET', ebba, undefined, `?workoutId=${workoutId}`)).status).toBe(403);
  });

  it('listan i appen visar att passet har film men lämnar inte ut länken', async () => {
    const r = await call('my-online', 'GET', anna);
    const w = r.data.workouts.find((x: { id: string }) => x.id === workoutId);
    expect(w.has_video).toBe(true);
    expect(JSON.stringify(w)).not.toContain('vid-1');
  });

  it('när Emma ändrar texten finns filmen kvar', async () => {
    const detail = (await call('online-program', 'GET', emma, undefined, `?id=${(await call('online', 'GET', emma)).data.programs.find((p: { name: string }) => p.name === 'Filmprogram').id}`)).data;
    const w = detail.workouts.find((x: { id: string }) => x.id === workoutId);
    expect(w).toMatchObject({ video_provider: 'bunny', video_status: 'ready' });
    await call('workouts', 'POST', emma, { id: workoutId, programId: detail.program.id, title: 'Filmpass (nytt namn)', body: '' });
    expect((await call('video-play', 'GET', anna, undefined, `?workoutId=${workoutId}`)).status).toBe(200);
  });
});
