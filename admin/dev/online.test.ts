// Onlineträning och utmaningar (bingo).
import { beforeAll, describe, expect, it } from 'vitest';

process.env.DEMO_DB = '1';
process.env.FAKE_NOW = '2026-11-14T10:00:00Z';

type Mod = Record<string, (r: Request) => Promise<Response>>;
const mods: Record<string, Mod> = {};
const m = async (name: string) => (mods[name] ??= await import(`../api/${name}.ts`));
async function call(name: string, method: string, auth: { cookie?: string; token?: string }, data?: unknown, query = '') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth.cookie) headers.cookie = auth.cookie;
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  const res = await (await m(name))[method](new Request(`http://localhost/api/${name}${query}`, { method, headers, body: data ? JSON.stringify(data) : undefined }));
  return { status: res.status, data: await res.json(), headers: res.headers };
}
async function login(email: string) {
  const s1 = await call('auth-start', 'POST', {}, { email });
  const s2 = await call('auth-verify', 'POST', {}, { email, code: s1.data.demoCode, client: 'app' });
  return { cookie: s2.headers.get('set-cookie')!.split(';')[0], token: s2.data.token as string };
}

let emma: { cookie: string };
let anna: { token: string };
let lisa: { token: string };
let programId = '';
let annaId = '';

beforeAll(async () => {
  emma = await login('starkmammavarberg@gmail.com');
  anna = await login('anna.berg@example.com');
  lisa = await login('anna.ek@example.com');
  annaId = (await call('me', 'GET', anna)).data.user.id;
});

describe('onlineträning', () => {
  it('Emma skapar ett program med pass i text och film', async () => {
    const p = await call('online', 'POST', emma, { name: 'Online höst 2026', price: 499, startsOn: '2026-11-01', endsOn: '2026-12-20' });
    expect(p.status).toBe(201);
    programId = p.data.id;
    expect((await call('workouts', 'POST', emma, { programId, title: 'Tomt pass' })).status).toBe(400);
    expect((await call('workouts', 'POST', emma, { programId, title: 'Fel länk', videoUrl: 'http://x' })).status).toBe(400);
    expect((await call('workouts', 'POST', emma, { programId, title: 'Pass 1: Ben', body: '3 varv: 20 knäböj, 15 utfall', publishOn: '2026-11-10' })).status).toBe(201);
    expect((await call('workouts', 'POST', emma, { programId, title: 'Pass 2: Träna med mig', videoUrl: 'https://www.youtube.com/watch?v=abc', durationMin: 30, publishOn: '2026-11-12' })).status).toBe(201);
    expect((await call('workouts', 'POST', emma, { programId, title: 'Pass 3: Kommer snart', body: 'Hemligt', publishOn: '2026-11-20' })).status).toBe(201);
  });

  it('utan tillgång ser man bara erbjudandet, inte passen', async () => {
    const r = await call('my-online', 'GET', anna);
    expect(r.data.workouts.filter((w: { program_id: string }) => w.program_id === programId)).toHaveLength(0);
    expect(r.data.offers.find((o: { id: string }) => o.id === programId)).toMatchObject({ price: 499, ordered: false });
  });

  it('köp skapar en betalning, och när Emma markerar den betald får man tillgång', async () => {
    const buy = await call('my-online', 'POST', anna, { programId, action: 'buy' });
    expect(buy.status).toBe(201);
    expect((await call('my-online', 'POST', anna, { programId, action: 'buy' })).data.chargeId).toBe(buy.data.chargeId); // ingen dubbel betalning
    expect((await call('my-online', 'GET', anna)).data.offers.find((o: { id: string }) => o.id === programId).ordered).toBe(true);

    await call('charges-pay', 'POST', emma, { id: buy.data.chargeId, method: 'swish' });
    const r = await call('my-online', 'GET', anna);
    expect(r.data.programs.map((p: { id: string }) => p.id)).toContain(programId);
    const mine = r.data.workouts.filter((w: { program_id: string }) => w.program_id === programId);
    expect(mine.map((w: { title: string }) => w.title)).toEqual(['Pass 2: Träna med mig', 'Pass 1: Ben']); // pass 3 inte publicerat än
    expect(r.data.upcoming.n).toBeGreaterThanOrEqual(1);
  });

  it('man bockar av pass, och Emma ser hur många som gjort dem', async () => {
    const ofProgram = async (who: { token: string }) =>
      (await call('my-online', 'GET', who)).data.workouts.filter((x: { program_id: string }) => x.program_id === programId);
    const w = (await ofProgram(anna))[1];
    expect((await call('my-online', 'POST', anna, { workoutId: w.id, action: 'done' })).status).toBe(200);
    expect((await ofProgram(anna))[1].done).toBe(true);
    expect((await call('my-online', 'POST', lisa, { workoutId: w.id, action: 'done' })).status).toBe(403); // utan tillgång
    const detail = await call('online-program', 'GET', emma, undefined, `?id=${programId}`);
    expect(detail.data.workouts.find((x: { id: string }) => x.id === w.id).done).toBe(1);
    expect(detail.data.members.find((x: { id: string }) => x.id === annaId)).toMatchObject({ source: 'paid', done: 1 });
  });

  it('"Jag har swishat" ger tillgång direkt; Emma bekräftar eller tar bort den', async () => {
    const lisaId = (await call('me', 'GET', lisa)).data.user.id;
    const buy = await call('my-online', 'POST', lisa, { programId, action: 'buy' });
    const count = async () =>
      (await call('my-online', 'GET', lisa)).data.workouts.filter((x: { program_id: string }) => x.program_id === programId).length;
    expect(await count()).toBe(0);
    expect((await call('my-charges', 'POST', lisa, { id: buy.data.chargeId })).data.access).toBe(true);
    expect(await count()).toBe(2);
    let member = (await call('online-program', 'GET', emma, undefined, `?id=${programId}`)).data.members.find((x: { id: string }) => x.id === lisaId);
    expect(member.source).toBe('reported');
    await call('charges-pay', 'POST', emma, { id: buy.data.chargeId, method: 'swish' });
    member = (await call('online-program', 'GET', emma, undefined, `?id=${programId}`)).data.members.find((x: { id: string }) => x.id === lisaId);
    expect(member.source).toBe('paid');
    await call('charges-pay', 'POST', emma, { id: buy.data.chargeId, undo: true }); // pengarna kom inte
    expect(await count()).toBe(0);
  });

  it('Emma kan ge och ta bort tillgång för hand', async () => {
    const lisaId = (await call('me', 'GET', lisa)).data.user.id;
    const count = async () =>
      (await call('my-online', 'GET', lisa)).data.workouts.filter((x: { program_id: string }) => x.program_id === programId).length;
    await call('online-access', 'POST', emma, { programId, personId: lisaId, action: 'grant' });
    expect(await count()).toBe(2);
    await call('online-access', 'POST', emma, { programId, personId: lisaId, action: 'revoke' });
    expect(await count()).toBe(0);
  });

  it('deltagare kommer inte åt Emmas sidor för onlineträning', async () => {
    expect((await call('online', 'GET', anna)).status).toBe(403);
    expect((await call('workouts', 'POST', anna, { programId, title: 'x', body: 'y' })).status).toBe(403);
  });
});

describe('bingo', () => {
  let challengeId = '';

  it('Emma skapar en bingobricka', async () => {
    const r = await call('challenges', 'POST', emma, {
      name: 'HÖST-bingo', prize: '5-gångerskort', startsOn: '2026-11-10', endsOn: '2026-11-30',
      tasks: ['Promenera 8 km', 'Simma 20 minuter', 'Höstbad'],
    });
    expect(r.status).toBe(201);
    challengeId = r.data.id;
  });

  it('deltagaren bockar av rutor med datum; utlottning bara bland fulla brickor', async () => {
    const mine = await call('my-challenges', 'GET', anna);
    const tasks = mine.data.tasks.filter((t: { challenge_id: string }) => t.challenge_id === challengeId);
    expect(tasks).toHaveLength(3);
    expect((await call('challenges', 'POST', emma, { id: challengeId, action: 'draw' })).status).toBe(400);
    await call('my-challenges', 'POST', anna, { taskId: tasks[0].id, done: true, date: '2026-11-11' });
    await call('my-challenges', 'POST', anna, { taskId: tasks[1].id, done: true, date: '2026-01-01' }); // före start -> idag
    await call('my-challenges', 'POST', lisa, { taskId: tasks[0].id, done: true });
    const after = (await call('my-challenges', 'GET', anna)).data.tasks.filter((t: { challenge_id: string }) => t.challenge_id === challengeId);
    expect(after.map((t: { done_on: string | null }) => t.done_on)).toEqual(['2026-11-11', '2026-11-14', null]);
    await call('my-challenges', 'POST', anna, { taskId: tasks[2].id, done: true });

    const detail = await call('challenges', 'GET', emma, undefined, `?id=${challengeId}`);
    expect(detail.data.progress[0]).toMatchObject({ name: 'Anna Berg', done: 3 });
    const draw = await call('challenges', 'POST', emma, { id: challengeId, action: 'draw' });
    expect(draw.data.winner.name).toBe('Anna Berg');
    expect((await call('my-notices', 'GET', anna)).data.notices[0].title).toBe('Du har vunnit!');
    expect((await call('challenges', 'POST', emma, { id: challengeId, action: 'draw' })).status).toBe(400); // ingen annan har full bricka
  });
});
