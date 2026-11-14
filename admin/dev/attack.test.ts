// Försök att bryta systemet: förfalskad inloggning, åtkomst till andras data, ogiltig indata,
// samtidiga anrop (dubbelbokning, dubbla betalningar) och kantfall i tid.
import { beforeAll, describe, expect, it } from 'vitest';

process.env.DEMO_DB = '1';
process.env.FAKE_NOW = '2026-11-14T10:00:00Z';

type Mod = Record<string, (r: Request) => Promise<Response>>;
const mods: Record<string, Mod> = {};
const m = async (name: string) => (mods[name] ??= await import(`../api/${name}.ts`));
async function raw(name: string, method: string, headers: Record<string, string>, body?: string, query = '') {
  const res = await (await m(name))[method](new Request(`http://localhost/api/${name}${query}`, { method, headers, body }));
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}
async function call(name: string, method: string, auth: { cookie?: string; token?: string }, data?: unknown, query = '') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth.cookie) headers.cookie = auth.cookie;
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  return raw(name, method, headers, data === undefined ? undefined : JSON.stringify(data), query);
}
async function login(email: string) {
  const s1 = await call('auth-start', 'POST', {}, { email });
  const s2 = await call('auth-verify', 'POST', {}, { email, code: s1.data.demoCode });
  return { cookie: s2.headers.get('set-cookie')!.split(';')[0], token: s2.data.token as string, id: s2.data.user.id as string };
}

let emma: { cookie: string; token: string; id: string };
let anna: { cookie: string; token: string; id: string };
let ebba: { cookie: string; token: string; id: string };

beforeAll(async () => {
  emma = await login('starkmammavarberg@gmail.com');
  anna = await login('anna.berg@example.com');
  ebba = await login('ebba.berg@example.com');
});

describe('förfalskad inloggning', () => {
  it('ändrad token, annan persons id i token och utgången token nekas', async () => {
    const [id, exp, sig] = anna.token.split('.');
    const forged = [emma.id, exp, sig].join('.');
    expect((await call('me', 'GET', { token: forged })).data.user).toBeNull();
    expect((await call('week', 'GET', { token: forged }, undefined, '?from=2026-11-16')).status).toBe(401);
    expect((await call('me', 'GET', { token: `${id}.${Number(exp) + 999}.${sig}` })).data.user).toBeNull();
    expect((await call('me', 'GET', { token: `${id}.1.${sig}` })).data.user).toBeNull();
    expect((await call('me', 'GET', { token: 'skräp' })).data.user).toBeNull();
    expect((await call('me', 'GET', { cookie: 'sm_session=a.b.c' })).data.user).toBeNull();
  });

  it('engångskoden går inte att gissa: spärras efter 5 fel, även med rätt kod efteråt', async () => {
    const email = 'gissare@example.com';
    const s1 = await call('auth-start', 'POST', {}, { email });
    const wrong = s1.data.demoCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await call('auth-verify', 'POST', {}, { email, code: wrong })).status).toBe(401);
    expect((await call('auth-verify', 'POST', {}, { email, code: s1.data.demoCode })).status).toBe(401);
  });

  it('kod för en adress fungerar inte för en annan', async () => {
    const s1 = await call('auth-start', 'POST', {}, { email: 'kod.a@example.com' });
    expect((await call('auth-verify', 'POST', {}, { email: 'kod.b@example.com', code: s1.data.demoCode })).status).toBe(401);
  });

  it('avböjt konto kommer inte in', async () => {
    const x = await login('avbojd@example.com');
    await call('people-activate', 'POST', emma, { id: x.id, action: 'reject' });
    const s1 = await call('auth-start', 'POST', {}, { email: 'avbojd@example.com' }).catch(() => null);
    await new Promise((r) => setTimeout(r, 0));
    expect((await call('my-schedule', 'GET', x)).status).toBe(403);
    void s1;
  });

  it('cookie från annan webbplats (CSRF) nekas för ändringar', async () => {
    const r = await raw('notices', 'POST', { cookie: emma.cookie, origin: 'https://ond.example.com', 'content-type': 'text/plain' },
      JSON.stringify({ audience: 'all', title: 'Hackad', body: 'Hej' }));
    expect(r.status).toBe(403);
  });
});

describe('andras data', () => {
  it('en deltagare kan inte kalla Emmas endpoints', async () => {
    for (const [name, method, data] of [
      ['people', 'GET', undefined], ['charges', 'GET', undefined], ['rounds', 'GET', undefined],
      ['booking', 'POST', { sessionId: anna.id, personId: anna.id, action: 'add', source: 'drop_in' }],
      ['charges-pay', 'POST', { id: anna.id }], ['people-activate', 'POST', { id: anna.id, action: 'activate' }],
      ['groups', 'PUT', { id: anna.id, capacity: 99 }], ['notice', 'GET', undefined], ['online', 'GET', undefined],
    ] as const) {
      expect((await call(name, method, anna, data, name === 'notice' ? `?id=${anna.id}` : '')).status, name).toBe(403);
    }
  });

  it('man kan inte bekräfta eller läsa någon annans notis, eller swisha någon annans betalning', async () => {
    const sent = await call('notices', 'POST', emma, { audience: `person:${anna.id}`, title: 'Bara till Anna', body: 'Privat', requireAck: true });
    expect((await call('my-notices', 'POST', ebba, { id: sent.data.id, acknowledge: true })).status).toBe(404);
    expect((await call('my-notices', 'GET', ebba)).data.notices.some((x: { id: string }) => x.id === sent.data.id)).toBe(false);
    const c = (await call('charges', 'POST', emma, { personId: anna.id, description: 'Test', amount: 100 })).data.id;
    expect((await call('my-charges', 'POST', ebba, { id: c })).status).toBe(404);
  });
});

describe('ogiltig indata', () => {
  it('SQL-injektion i fält behandlas som text', async () => {
    const evil = "x'); drop table people; --";
    const r = await call('people', 'POST', emma, { name: evil, email: 'evil@example.com' });
    expect(r.status).toBe(201);
    expect((await call('people', 'GET', emma)).data.people.find((p: { name: string }) => p.name === evil)).toBeTruthy();
    expect((await call('week', 'GET', emma, undefined, "?from=2026-11-16'--")).status).toBe(400);
  });

  it('farliga länkar och trasig JSON nekas', async () => {
    const page = (link: string) => call('notices', 'POST', emma, { audience: 'all', title: 'x', body: 'y', page: { heading: 'h', text: 't', link } });
    expect((await page('javascript:alert(1)')).status).toBe(400);
    expect((await page('https://ok.example.com')).status).toBe(201);
    expect((await raw('notices', 'POST', { cookie: emma.cookie, 'content-type': 'application/json' }, '{trasig')).status).toBe(400);
  });

  it('negativa belopp, orimliga max och för långa texter nekas', async () => {
    expect((await call('charges', 'POST', emma, { personId: anna.id, description: 'x', amount: -500 })).status).toBe(400);
    expect((await call('profile', 'POST', anna, { name: 'A'.repeat(5000), phone: '0701234567' })).status).toBe(400);
    expect((await call('notices', 'POST', emma, { audience: 'all', title: 'x', body: 'y', page: { heading: 'h', text: 'x'.repeat(50000) } })).status).toBe(400);
    expect((await call('online', 'POST', emma, { name: 'x', description: 'y'.repeat(50000), price: 1 })).status).toBe(400);
  });

  it('ogiltiga id ger 400, inte serverfel', async () => {
    expect((await call('session', 'GET', emma, undefined, '?id=inte-ett-id')).status).toBe(400);
    expect((await call('my-booking', 'POST', anna, { sessionId: '00000000-0000-0000-0000-000000000000', action: 'cancel' })).status).toBe(400);
    expect((await call('my-booking', 'POST', anna, { sessionId: 42, action: 'cancel' })).status).toBe(400);
  });
});

describe('samtidiga anrop', () => {
  it('sista platsen kan inte dubbelbokas när många bokar exakt samtidigt', async () => {
    const people = (await call('people', 'GET', emma)).data.people.filter((p: { status: string }) => p.status === 'active');
    const sessions = (await call('week', 'GET', emma, undefined, '?from=2026-11-30')).data.sessions;
    const s = sessions.find((x: { booked: number; capacity: number }) => x.capacity - x.booked >= 1);
    const free = s.capacity - s.booked;
    // Logga in fler deltagare som inte går i gruppen och låt dem boka samtidigt.
    const used = new Set(['anna.berg@example.com', 'ebba.berg@example.com']);
    const outsiders = people.filter((p: { group_ids: string[]; email: string | null }) => !p.group_ids.includes(s.group_id) && p.email?.endsWith('@example.com') && !used.has(p.email!)).slice(0, free + 4);
    const tokens: string[] = [];
    for (const p of outsiders) tokens.push((await login(p.email)).token);
    expect(tokens.length).toBe(free + 4);
    const results = await Promise.all(tokens.map((token) => call('my-booking', 'POST', { token }, { sessionId: s.id, action: 'book', source: 'drop_in' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(free);
    const after = (await call('week', 'GET', emma, undefined, '?from=2026-11-30')).data.sessions.find((x: { id: string }) => x.id === s.id);
    expect(after.booked).toBe(after.capacity);
    // Ingen drop-in-avgift för dem som inte fick plats
    const charges = (await call('charges', 'GET', emma, undefined, '?status=unpaid')).data.charges.filter((c: { description: string }) => c.description.startsWith('Drop-in 2026-'));
    expect(charges.filter((c: { description: string }) => c.description.includes(after.date)).length).toBe(free);
  });

  it('dubbelklick på bekräfta ger inte dubbla betalningskrav', async () => {
    const rounds = (await call('rounds', 'GET', emma)).data.rounds;
    const round = rounds.find((r: { registration_opens_at: string | null }) => r.registration_opens_at);
    const regs = (await call('registrations', 'GET', emma, undefined, `?roundId=${round.id}`)).data;
    const r = regs.registrations.find((x: { status: string }) => x.status === 'pending');
    const d = { decisions: [{ id: r.id, groupIds: regs.suggestion[r.id].groupIds.filter(Boolean) }] };
    await Promise.all([call('registrations-confirm', 'POST', emma, d), call('registrations-confirm', 'POST', emma, d)]);
    const all = (await call('charges', 'GET', emma, undefined, '?status=all')).data.charges.filter((c: { person_id: string; description: string }) => c.person_id === r.person_id && c.description.startsWith(round.name));
    expect(all.length).toBeLessThanOrEqual(2); // ett krav, eller två vid delbetalning — aldrig dubbelt
    const kinds = new Set(all.map((c: { description: string }) => c.description));
    expect(kinds.size).toBe(all.length);
  });

  it('dubbelklick på köp av onlineprogram ger bara en betalning', async () => {
    const p = (await call('online', 'POST', emma, { name: 'Dubbelköp', price: 100 })).data.id;
    const rs = await Promise.all([1, 2, 3].map(() => call('my-online', 'POST', ebba, { programId: p, action: 'buy' })));
    expect(new Set(rs.map((r) => r.data.chargeId)).size).toBe(1);
  });

  it('samma tillgodo-pass kan inte användas två gånger samtidigt', async () => {
    const sched = (await call('my-schedule', 'GET', anna)).data;
    const mine = sched.sessions.filter((s: { ordinary: boolean; my_status: string; in_time: boolean }) => s.ordinary && s.my_status === 'booked' && s.in_time);
    await call('my-booking', 'POST', anna, { sessionId: mine[mine.length - 1].id, action: 'cancel' });
    const credits = (await call('my-schedule', 'GET', anna)).data.credits;
    const options = (await call('bookable', 'GET', anna)).data.sessions.filter((s: { booked: number; capacity: number; mine: boolean; kind: string }) => s.booked < s.capacity && !s.mine && s.kind === 'ordinary');
    const rs = await Promise.all(options.slice(0, credits + 2).map((s: { id: string }) => call('my-booking', 'POST', anna, { sessionId: s.id, action: 'book', source: 'credit' })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(credits);
    expect((await call('my-schedule', 'GET', anna)).data.credits).toBe(0);
  });
});

describe('tid och regler', () => {
  it('man kan inte avboka eller boka ett pass som redan börjat', async () => {
    const s = (await call('my-schedule', 'GET', anna)).data.sessions[0];
    process.env.FAKE_NOW = new Date(new Date(`${s.date}T${s.time.replace('.', ':')}:00+01:00`).getTime() + 10 * 60000).toISOString();
    const r = await call('my-booking', 'POST', anna, { sessionId: s.id, action: 'cancel' });
    process.env.FAKE_NOW = '2026-11-14T10:00:00Z';
    expect(r.status).toBe(400);
  });

  it('pass i en omgång över sommartidens slut och början får rätt klockslag', async () => {
    const round = (await call('round', 'GET', emma)).data.round;
    const rounds = (await call('rounds', 'GET', emma)).data.rounds;
    const r = await call('rounds', 'POST', emma, {
      name: 'Över sommartid', firstMonday: '2027-03-22', weeks: 2, copyFromRoundId: rounds.find((x: { name: string }) => x.name === round.name).id,
      prices: [{ per_week: 1, price: 699 }],
    });
    expect(r.status).toBe(201);
    const before = (await call('week', 'GET', emma, undefined, '?from=2027-03-22')).data.sessions;
    const after = (await call('week', 'GET', emma, undefined, '?from=2027-03-29')).data.sessions;
    expect(before.map((s: { time: string }) => s.time)).toEqual(after.map((s: { time: string }) => s.time));
    expect(before[0].time).toBe('12.00');
  });
});
