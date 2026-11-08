// Röktest av API:et mot demodatabasen (PGlite). Kör: npm test
import { beforeAll, describe, expect, it } from 'vitest';

process.env.DEMO_DB = '1';

let cookie = '';
let token = '';
const call = async (mod: Record<string, (r: Request) => Promise<Response>>, method: string, url: string, data?: unknown) => {
  const res = await mod[method](
    new Request(`http://localhost${url}`, {
      method,
      headers: { cookie, 'content-type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }),
  );
  return { status: res.status, data: await res.json(), headers: res.headers };
};

async function loginAs(identifier: string) {
  const start = await import('../api/auth-start');
  const verify = await import('../api/auth-verify');
  const s1 = await call(start, 'POST', '/api/auth-start', { identifier });
  const s2 = await call(verify, 'POST', '/api/auth-verify', { identifier, code: s1.data.demoCode });
  token = s2.data.token;
  return s2.headers.get('set-cookie')!.split(';')[0];
}

describe('admin-API', () => {
  beforeAll(async () => {
    cookie = await loginAs('starkmammavarberg@gmail.com');
  });

  it('Emma är inloggad som tränare, både med cookie och Bearer-token', async () => {
    const me = await import('../api/me');
    expect((await call(me, 'GET', '/api/me')).data.user.role).toBe('trainer');
    const res = await me.GET(new Request('http://localhost/api/me', { headers: { authorization: `Bearer ${token}` } }));
    expect((await res.json()).user.role).toBe('trainer');
  });

  it('en ny kod kan inte begäras direkt igen', async () => {
    const start = await import('../api/auth-start');
    const r = await call(start, 'POST', '/api/auth-start', { identifier: 'StarkMammaVarberg@gmail.com' });
    expect(r.status).toBe(429);
  });

  it('en deltagare loggar in men kommer inte åt admin', async () => {
    const people = await import('../api/people');
    const start = await import('../api/auth-start');
    const verify = await import('../api/auth-verify');
    const me = await import('../api/me');
    const week = await import('../api/week');
    await call(people, 'POST', '/api/people', { name: 'Deltagar Test', phone: '+46 70 999 88 77' });
    const saved = cookie;

    const s1 = await call(start, 'POST', '/api/auth-start', { identifier: '070-999 88 77' });
    const wrongCode = s1.data.demoCode === '000000' ? '111111' : '000000';
    expect((await call(verify, 'POST', '/api/auth-verify', { identifier: '0709998877', code: wrongCode })).status).toBe(401);
    const ok = await call(verify, 'POST', '/api/auth-verify', { identifier: '0709998877', code: s1.data.demoCode });
    expect(ok.data.user.role).toBe('participant');
    expect((await call(verify, 'POST', '/api/auth-verify', { identifier: '0709998877', code: s1.data.demoCode })).status).toBe(401);

    cookie = ok.headers.get('set-cookie')!.split(';')[0];
    expect((await call(me, 'GET', '/api/me')).data.user.role).toBe('participant');
    expect((await call(week, 'GET', '/api/week?from=2026-11-09')).status).toBe(403);
    cookie = saved;
  });

  it('okänt nummer får samma svar men ingen kod', async () => {
    const start = await import('../api/auth-start');
    const r = await call(start, 'POST', '/api/auth-start', { identifier: '0701112233' });
    expect(r.status).toBe(200);
    expect(r.data.demoCode).toBeUndefined();
  });

  it('kräver inloggning', async () => {
    const week = await import('../api/week');
    const saved = cookie;
    cookie = '';
    expect((await call(week, 'GET', '/api/week?from=2026-11-09')).status).toBe(401);
    cookie = saved;
  });

  it('visar veckans pass med beläggning', async () => {
    const week = await import('../api/week');
    const r = await call(week, 'GET', '/api/week?from=2026-11-09');
    expect(r.status).toBe(200);
    expect(r.data.sessions).toHaveLength(10);
    expect(r.data.sessions[0]).toMatchObject({ date: '2026-11-09', time: '12.00', place: 'Gymmet' });
    expect(r.data.sessions.some((s: { cancelled: number }) => s.cancelled > 0)).toBe(true);
  });

  it('flyttade pass v 47 ligger på onsdag', async () => {
    const week = await import('../api/week');
    const r = await call(week, 'GET', '/api/week?from=2026-11-16');
    const moved = r.data.sessions.filter((s: { status: string }) => s.status === 'moved');
    expect(moved).toHaveLength(4);
    expect(new Set(moved.map((s: { date: string }) => s.date))).toEqual(new Set(['2026-11-18']));
  });

  it('skapar en deltagare och lägger henne i en grupp', async () => {
    const round = await import('../api/round');
    const people = await import('../api/people');
    const { data } = await call(round, 'GET', '/api/round');
    const g = data.groups[0];
    const created = await call(people, 'POST', '/api/people', { name: 'Test Testsson', phone: '070-000 00 01', groupIds: [g.id] });
    expect(created.status).toBe(201);
    const after = await call(round, 'GET', '/api/round');
    expect(after.data.groups[0].members).toBe(g.members + 1);
    const dup = await call(people, 'POST', '/api/people', { name: 'Kopia', phone: '0700000001' });
    expect(dup.status).toBe(409);
  });

  it('skickar en notis med informationssida till en grupp', async () => {
    const round = await import('../api/round');
    const notices = await import('../api/notices');
    const { data } = await call(round, 'GET', '/api/round');
    const g = data.groups[1];
    const r = await call(notices, 'POST', '/api/notices', {
      title: 'Ändrad lokal', body: 'Vi kör i Gymmet ikväll.', audience: `group:${g.id}`,
      page: { heading: 'Ändrad lokal', text: 'Rena inomhusskor.', link: 'https://www.starkmamma.com' },
    });
    expect(r.status).toBe(201);
    expect(r.data.recipients).toBe(g.members);
    const list = await call(notices, 'GET', '/api/notices');
    expect(list.data.notices[0].title).toBe('Ändrad lokal');
  });
});
