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
  const s1 = await call(start, 'POST', '/api/auth-start', { email: identifier });
  const s2 = await call(verify, 'POST', '/api/auth-verify', { email: identifier, code: s1.data.demoCode });
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
    const r = await call(start, 'POST', '/api/auth-start', { email: 'StarkMammaVarberg@gmail.com' });
    expect(r.status).toBe(429);
  });

  it('en ny person registrerar sig själv, fyller i profil och aktiveras av Emma', async () => {
    const start = await import('../api/auth-start');
    const verify = await import('../api/auth-verify');
    const me = await import('../api/me');
    const profile = await import('../api/profile');
    const people = await import('../api/people');
    const activate = await import('../api/people-activate');
    const week = await import('../api/week');
    const round = await import('../api/round');
    const emma = cookie;

    const s1 = await call(start, 'POST', '/api/auth-start', { email: 'Ny.Person@Example.com' });
    const wrongCode = s1.data.demoCode === '000000' ? '111111' : '000000';
    expect((await call(verify, 'POST', '/api/auth-verify', { email: 'ny.person@example.com', code: wrongCode })).status).toBe(401);
    const ok = await call(verify, 'POST', '/api/auth-verify', { email: 'ny.person@example.com', code: s1.data.demoCode });
    expect(ok.data.user).toMatchObject({ role: 'participant', status: 'pending', needs_profile: true });
    expect((await call(verify, 'POST', '/api/auth-verify', { email: 'ny.person@example.com', code: s1.data.demoCode })).status).toBe(401);

    cookie = ok.headers.get('set-cookie')!.split(';')[0];
    expect((await call(profile, 'POST', '/api/profile', { name: 'N', phone: '070' })).status).toBe(400);
    expect((await call(profile, 'POST', '/api/profile', { name: 'Ny Person', phone: '+46 70 999 88 77' })).status).toBe(200);
    expect((await call(me, 'GET', '/api/me')).data.user).toMatchObject({ status: 'pending', needs_profile: false, phone: '0709998877' });
    expect((await call(week, 'GET', '/api/week?from=2026-11-09')).status).toBe(403);

    cookie = emma;
    const list = await call(people, 'GET', '/api/people');
    const pending = list.data.people.find((p: { email: string }) => p.email === 'ny.person@example.com');
    expect(pending.status).toBe('pending');
    const g = (await call(round, 'GET', '/api/round')).data.groups[2];
    expect((await call(activate, 'POST', '/api/people-activate', { id: pending.id, action: 'activate', groupIds: [g.id] })).status).toBe(200);

    cookie = ok.headers.get('set-cookie')!.split(';')[0];
    expect((await call(me, 'GET', '/api/me')).data.user.status).toBe('active');
    cookie = emma;
    const after = (await call(round, 'GET', '/api/round')).data.groups[2];
    expect(after.members).toBe(g.members + 1);
  });

  it('ogiltig e-post avvisas', async () => {
    const start = await import('../api/auth-start');
    expect((await call(start, 'POST', '/api/auth-start', { email: '0701112233' })).status).toBe(400);
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
    const created = await call(people, 'POST', '/api/people', { name: 'Test Testsson', phone: '070-000 00 01', email: 'test@example.com', groupIds: [g.id] });
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
