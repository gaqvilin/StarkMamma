// Vardagsdrift: återbud och tillgodo, bokning, kö, flyttade pass, betalningar, ny omgång och anmälan.
import { beforeAll, describe, expect, it } from 'vitest';

process.env.DEMO_DB = '1';
process.env.FAKE_NOW = '2026-11-14T10:00:00Z'; // lördag 14/11

type Mod = Record<string, (r: Request) => Promise<Response>>;
const mods: Record<string, Mod> = {};
const m = async (name: string) => (mods[name] ??= await import(`../api/${name}.ts`));

async function call(name: string, method: string, auth: { cookie?: string; token?: string }, data?: unknown, query = '') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth.cookie) headers.cookie = auth.cookie;
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  const res = await (await m(name))[method](
    new Request(`http://localhost/api/${name}${query}`, { method, headers, body: data ? JSON.stringify(data) : undefined }),
  );
  return { status: res.status, data: res.status === 204 ? null : await res.json(), headers: res.headers };
}

async function login(email: string) {
  const s1 = await call('auth-start', 'POST', {}, { email });
  const s2 = await call('auth-verify', 'POST', {}, { email, code: s1.data.demoCode, client: 'app' });
  return { cookie: s2.headers.get('set-cookie')!.split(';')[0], token: s2.data.token as string };
}

let emma: { cookie: string };
let sara: { token: string };
let saraId = '';
let groups: { id: string; weekday: number; time: string; place: string; capacity: number; members: number }[] = [];
let roundId = '';

const week = async (from: string) => (await call('week', 'GET', emma, undefined, `?from=${from}`)).data.sessions as {
  id: string; date: string; time: string; group_id: string; booked: number; capacity: number; queue: number; status: string;
}[];

beforeAll(async () => {
  emma = await login('starkmammavarberg@gmail.com');
  const r = await call('round', 'GET', emma);
  groups = r.data.groups;
  roundId = r.data.round.id;
  const tis1845 = groups.find((g) => g.weekday === 2 && g.time === '18.45')!;
  const created = await call('people', 'POST', emma, { name: 'Sara Test', email: 'sara@example.com', phone: '0709990000', groupIds: [tis1845.id] });
  saraId = created.data.id;
  sara = await login('sara@example.com');
});

describe('återbud och tillgodo', () => {
  it('Saras schema visar hennes ordinarie tisdagspass', async () => {
    const r = await call('my-schedule', 'GET', sara);
    expect(r.status).toBe(200);
    expect(r.data.sessions[0]).toMatchObject({ date: '2026-11-17', time: '18.45', ordinary: true, my_status: 'booked', in_time: true });
    expect(r.data.credits).toBe(0);
  });

  it('återbud dagen innan ger ett tillgodo-pass, och kan ångras', async () => {
    const s = (await call('my-schedule', 'GET', sara)).data.sessions[0];
    const c = await call('my-booking', 'POST', sara, { sessionId: s.id, action: 'cancel' });
    expect(c.data).toEqual({ status: 'cancelled_in_time', credit: true });
    expect((await call('my-schedule', 'GET', sara)).data.credits).toBe(1);
    expect((await call('my-booking', 'POST', sara, { sessionId: s.id, action: 'undo' })).status).toBe(200);
    expect((await call('my-schedule', 'GET', sara)).data.credits).toBe(0);
  });

  it('sent återbud samma dag ger inget tillgodo', async () => {
    const s = (await call('my-schedule', 'GET', sara)).data.sessions[0];
    process.env.FAKE_NOW = '2026-11-17T12:00:00Z'; // tisdag, samma dag som passet
    const c = await call('my-booking', 'POST', sara, { sessionId: s.id, action: 'cancel' });
    process.env.FAKE_NOW = '2026-11-14T10:00:00Z';
    expect(c.data).toEqual({ status: 'cancelled_late', credit: false });
    expect((await call('my-schedule', 'GET', sara)).data.credits).toBe(0);
  });
});

describe('boka extra pass', () => {
  it('tillgodo-passet används på ett annat pass med ledig plats och kommer tillbaka vid återbud i tid', async () => {
    const all = (await call('my-schedule', 'GET', sara)).data.sessions;
    await call('my-booking', 'POST', sara, { sessionId: all[1].id, action: 'cancel' }); // tis 24/11 -> tillgodo
    const options = (await call('bookable', 'GET', sara)).data.sessions as { id: string; booked: number; capacity: number; kind: string }[];
    const free = options.find((o) => o.booked < o.capacity && o.kind === 'ordinary')!;
    expect((await call('my-booking', 'POST', sara, { sessionId: free.id, action: 'book', source: 'credit' })).status).toBe(200);
    expect((await call('my-schedule', 'GET', sara)).data.credits).toBe(0);
    expect((await call('my-booking', 'POST', sara, { sessionId: free.id, action: 'cancel' })).data.status).toBe('cancelled_in_time');
    expect((await call('my-schedule', 'GET', sara)).data.credits).toBe(1);
  });

  it('fullt pass går inte att boka, men man kan ställa sig i kö och får notis när en plats blir ledig', async () => {
    const options = (await call('bookable', 'GET', sara)).data.sessions as { id: string; booked: number; capacity: number }[];
    let full = options.find((o) => o.booked >= o.capacity);
    if (!full) {
      // Fyll ett pass med drop-in från Emma så att testet alltid har ett fullt pass.
      const target = options[0];
      const people = (await call('people', 'GET', emma)).data.people as { id: string }[];
      for (const p of people.slice(0, target.capacity)) await call('booking', 'POST', emma, { sessionId: target.id, personId: p.id, action: 'add', source: 'drop_in' });
      full = target;
    }
    const r = await call('my-booking', 'POST', sara, { sessionId: full.id, action: 'book', source: 'drop_in' });
    expect(r.status).toBe(400);
    expect(r.data.error).toContain('fullt');
    expect((await call('my-booking', 'POST', sara, { sessionId: full.id, action: 'queue' })).status).toBe(200);

    const detail = await call('session', 'GET', emma, undefined, `?id=${full.id}`);
    const someone = detail.data.roster.find((x: { status: string }) => !x.status.startsWith('cancelled'));
    await call('booking', 'POST', emma, { sessionId: full.id, personId: someone.id, action: 'cancel_in_time' });
    const notices = (await call('my-notices', 'GET', sara)).data.notices;
    expect(notices[0].title).toMatch(/^Ledig plats/);
    expect((await call('my-booking', 'POST', sara, { sessionId: full.id, action: 'book', source: 'drop_in' })).status).toBe(200);
    const charges = (await call('my-charges', 'GET', sara)).data.charges;
    expect(charges.find((c: { description: string }) => c.description.startsWith('Drop-in'))).toMatchObject({ amount: 140, status: 'unpaid' });
  });

  it('10-kort skapas när Emma markerar köpet som betalt, och ett klipp dras vid bokning', async () => {
    const c = await call('charges', 'POST', emma, { personId: saraId, description: '10-kort', amount: 1200, kind: 'punch_card' });
    const paid = await call('charges-pay', 'POST', emma, { id: c.data.id, method: 'swish' });
    expect(paid.data.receipt_number).toBeGreaterThan(0);
    expect((await call('my-schedule', 'GET', sara)).data.punch).toBe(10);
    const options = (await call('bookable', 'GET', sara)).data.sessions as { id: string; booked: number; capacity: number; mine: boolean }[];
    const free = options.find((o) => o.booked < o.capacity && !o.mine)!;
    expect((await call('my-booking', 'POST', sara, { sessionId: free.id, action: 'book', source: 'punch_card' })).status).toBe(200);
    expect((await call('my-schedule', 'GET', sara)).data.punch).toBe(9);
  });
});

describe('Emma ändrar pass', () => {
  it('flyttar ett pass och meddelar deltagarna', async () => {
    const sessions = await week('2026-11-30');
    const s = sessions.find((x) => x.time === '18.45' && x.date === '2026-12-01')!; // Saras tisdag
    const r = await call('session', 'PUT', emma, { id: s.id, date: '2026-12-02', time: '18.00', place: 'Ladan', notify: true });
    expect(r.data.notified).toBeGreaterThan(0);
    const after = (await week('2026-11-30')).find((x) => x.id === s.id)!;
    expect(after).toMatchObject({ date: '2026-12-02', time: '18.00', status: 'moved' });
    expect((await call('my-notices', 'GET', sara)).data.notices[0].title).toBe('Ändrad tid: passet 1/12 18.45');
  });

  it('ställer in ett pass', async () => {
    const s = (await week('2026-12-07'))[0];
    await call('session', 'PUT', emma, { id: s.id, cancelled: true, note: 'Emma är sjuk.', notify: true });
    expect((await week('2026-12-07'))[0].status).toBe('cancelled');
  });

  it('deltagare kan inte ändra pass', async () => {
    const s = (await week('2026-12-07'))[1];
    expect((await call('session', 'PUT', sara, { id: s.id, cancelled: true })).status).toBe(403);
  });
});

describe('bekräftelse av viktiga notiser', () => {
  it('inställt pass kräver bekräftelse, och Emma ser vem som bekräftat', async () => {
    const s = (await week('2026-12-07')).find((x) => x.date === '2026-12-08' && x.time === '18.45')!; // Saras tisdag
    const put = await call('session', 'PUT', emma, { id: s.id, cancelled: true, notify: true });
    const total = put.data.notified;
    expect(total).toBeGreaterThan(1);

    const n = (await call('my-notices', 'GET', sara)).data.notices[0];
    expect(n).toMatchObject({ title: 'Inställt pass 8/12 18.45', requires_ack: true, acknowledged: false });

    let detail = await call('session', 'GET', emma, undefined, `?id=${s.id}`);
    expect(detail.data.notice).toMatchObject({ recipients: total, acknowledged: 0 });
    expect(detail.data.notice.missing).toContain('Sara Test');
    expect(detail.data.notice.missing_people).toContainEqual({ name: 'Sara Test', phone: '0709990000' });

    expect((await call('my-notices', 'POST', sara, { id: n.id, acknowledge: true })).status).toBe(200);
    expect((await call('my-notices', 'GET', sara)).data.notices[0].acknowledged).toBe(true);

    detail = await call('session', 'GET', emma, undefined, `?id=${s.id}`);
    expect(detail.data.notice.acknowledged).toBe(1);
    expect(detail.data.notice.missing).not.toContain('Sara Test');

    const list = await call('notice', 'GET', emma, undefined, `?id=${n.id}`);
    const saraRow = list.data.recipients.find((r: { name: string }) => r.name === 'Sara Test');
    expect(saraRow.acknowledged_at).toBeTruthy();
    expect((await call('notice', 'POST', emma, { id: n.id, action: 'remind' })).data.reminded).toBe(total - 1);
  });

  it('Emma kan kräva bekräftelse på information om ett event', async () => {
    const r = await call('notices', 'POST', emma, {
      audience: 'all', title: 'AdventsMYS 29/11', body: 'Läs om årets tradition.', requireAck: true,
      page: { heading: 'AdventsFYS & AdventsMYS', text: 'Pass i Ladan och fika i gymmet.' },
    });
    expect(r.status).toBe(201);
    const history = (await call('notices', 'GET', emma)).data.notices;
    expect(history[0]).toMatchObject({ title: 'AdventsMYS 29/11', requires_ack: true, acknowledged: 0 });
    const n = (await call('my-notices', 'GET', sara)).data.notices[0];
    expect(n.requires_ack).toBe(true);
    await call('my-notices', 'POST', sara, { id: n.id, acknowledge: true });
    expect((await call('notices', 'GET', emma)).data.notices[0].acknowledged).toBe(1);
  });

  it('vanliga notiser kräver ingen bekräftelse', async () => {
    await call('notices', 'POST', emma, { audience: 'all', title: 'Hej', body: 'Bara info.' });
    expect((await call('my-notices', 'GET', sara)).data.notices[0].requires_ack).toBe(false);
  });
});

describe('ny omgång och anmälan', () => {
  let newRoundId = '';

  it('Emma skapar nästa omgång med samma grupper och ett uppehållsvecka', async () => {
    const r = await call('rounds', 'POST', emma, {
      name: 'Testomgång v 1–8 2027', firstMonday: '2027-01-04', weeks: 8, skipWeeks: [8], copyFromRoundId: roundId,
      prices: [{ per_week: 1, price: 699 }, { per_week: 2, price: 1299, first_installment: 699 }, { per_week: 3, price: 1799, first_installment: 699 }],
      payDeadline: '2026-12-22', installmentDeadline: '2027-01-22',
      registrationOpensAt: '2026-11-14T08:00', priorityUntil: '2026-11-15T20:00',
    });
    expect(r.status).toBe(201);
    expect(r.data.sessions).toBe(70); // 10 grupper x 7 veckor (v 8 hoppas över)
    newRoundId = r.data.id;
  });

  it('under förturen kan bara nuvarande deltagare anmäla sig', async () => {
    const outsider = await login('ny.kund@example.com');
    await call('profile', 'POST', outsider, { name: 'Ny Kund', phone: '0708887766' });
    const info = await call('my-registration', 'GET', outsider);
    expect(info.data.round).toMatchObject({ phase: 'priority', eligible: false });
    const g = info.data.groups[0].id;
    expect((await call('my-registration', 'POST', outsider, { roundId: newRoundId, perWeek: 1, choices: [[g]] })).status).toBe(400);

    const mine = await call('my-registration', 'GET', sara);
    expect(mine.data.round.eligible).toBe(true);
    const tis = mine.data.groups.find((x: { weekday: number; time: string }) => x.weekday === 2 && x.time === '18.45').id;
    const tor = mine.data.groups.find((x: { weekday: number; time: string }) => x.weekday === 4 && x.time === '18.45').id;
    const man = mine.data.groups.find((x: { weekday: number; time: string }) => x.weekday === 1 && x.time === '18.45').id;
    expect((await call('my-registration', 'POST', sara, { roundId: newRoundId, perWeek: 2, choices: [[tis, man], [tis]] })).status).toBe(400);
    expect((await call('my-registration', 'POST', sara, { roundId: newRoundId, perWeek: 2, choices: [[tis, man], [tor]], installments: true })).status).toBe(201);
  });

  it('Emma ser hur många som sökt varje pass i första och andra hand', async () => {
    const regs = await call('registrations', 'GET', emma, undefined, `?roundId=${newRoundId}`);
    const tis = regs.data.groups.find((g: { weekday: number; time: string }) => g.weekday === 2 && g.time === '18.45');
    const man = regs.data.groups.find((g: { weekday: number; time: string }) => g.weekday === 1 && g.time === '18.45');
    expect(regs.data.demand[tis.id]).toEqual({ first: 1, second: 0 });
    expect(regs.data.demand[man.id]).toEqual({ first: 0, second: 1 });
  });

  it('max styr förslaget men begränsar inte anmälan, och Emma kan placera fler än max', async () => {
    const regs = await call('registrations', 'GET', emma, undefined, `?roundId=${newRoundId}`);
    const tis = regs.data.groups.find((g: { weekday: number; time: string }) => g.weekday === 2 && g.time === '18.45');
    expect((await call('groups', 'PUT', emma, { id: tis.id, capacity: 0 })).status).toBe(400);
    expect((await call('groups', 'PUT', emma, { id: tis.id, capacity: 1 })).status).toBe(200);
    const after = await call('registrations', 'GET', emma, undefined, `?roundId=${newRoundId}`);
    const saraReg = after.data.registrations.find((r: { email: string }) => r.email === 'sara@example.com');
    expect(after.data.groups.find((g: { id: string }) => g.id === tis.id).capacity).toBe(1);
    expect(after.data.suggestion[saraReg.id].groupIds).toContain(tis.id); // en plats kvar, Sara får den
    expect((await call('groups', 'PUT', emma, { id: tis.id, capacity: 16 })).status).toBe(200);
  });

  it('efter förturen kan nya anmäla sig, och Emma bekräftar enligt förslaget', async () => {
    process.env.FAKE_NOW = '2026-11-16T10:00:00Z';
    const outsider = await login('ny.kund2@example.com');
    await call('profile', 'POST', outsider, { name: 'Ny Kund Två', phone: '0708887755' });
    const info = await call('my-registration', 'GET', outsider);
    expect(info.data.round.phase).toBe('open');
    const fre = info.data.groups.find((x: { weekday: number }) => x.weekday === 5).id;
    expect((await call('my-registration', 'POST', outsider, { roundId: newRoundId, perWeek: 1, choices: [[fre]] })).status).toBe(201);
    process.env.FAKE_NOW = '2026-11-14T10:00:00Z';

    const regs = await call('registrations', 'GET', emma, undefined, `?roundId=${newRoundId}`);
    expect(regs.data.registrations).toHaveLength(2);
    const saraReg = regs.data.registrations.find((r: { email: string }) => r.email === 'sara@example.com');
    expect(saraReg.priority).toBe(true);
    const decisions = regs.data.registrations.map((r: { id: string }) => ({ id: r.id, groupIds: regs.data.suggestion[r.id].groupIds.filter(Boolean) }));
    const conf = await call('registrations-confirm', 'POST', emma, { decisions });
    expect(conf.data).toEqual({ confirmed: 2, waitlisted: 0 });

    const charges = (await call('my-charges', 'GET', sara)).data.charges as { description: string; amount: number }[];
    const parts = charges.filter((c) => c.description.startsWith('Testomgång v 1–8 2027'));
    expect(parts.map((c) => c.amount).sort()).toEqual([600, 699]);
    expect((await call('my-notices', 'GET', sara)).data.notices[0].title).toBe('Din plats är bekräftad');

    const me = await call('me', 'GET', outsider);
    expect(me.data.user.status).toBe('active'); // bekräftelsen aktiverar kontot
  });
});

describe('betalningar och notiser', () => {
  it('Emma ser obetalda, markerar betalt och kan ångra', async () => {
    const unpaid = (await call('charges', 'GET', emma, undefined, '?status=unpaid')).data.charges;
    expect(unpaid.length).toBeGreaterThan(0);
    const id = unpaid[0].id;
    await call('charges-pay', 'POST', emma, { id, method: 'bank' });
    expect((await call('charges', 'GET', emma, undefined, '?status=paid')).data.charges.some((c: { id: string }) => c.id === id)).toBe(true);
    await call('charges-pay', 'POST', emma, { id, undo: true });
    expect((await call('charges', 'GET', emma, undefined, '?status=unpaid')).data.charges.some((c: { id: string }) => c.id === id)).toBe(true);
  });

  it('deltagaren meddelar att hon swishat, och Emma ser det överst', async () => {
    const mine = (await call('my-charges', 'GET', sara)).data.charges.filter((c: { status: string }) => c.status === 'unpaid');
    const c = mine[mine.length - 1];
    expect((await call('my-charges', 'POST', sara, { id: c.id })).status).toBe(200);
    expect((await call('my-charges', 'GET', sara)).data.charges.find((x: { id: string }) => x.id === c.id).reported).toBe(true);
    const unpaid = (await call('charges', 'GET', emma, undefined, '?status=unpaid')).data.charges;
    expect(unpaid[0]).toMatchObject({ id: c.id });
    expect(unpaid[0].reported_at).toBeTruthy();
    const other = await login('annan.person@example.com');
    expect((await call('my-charges', 'POST', other, { id: c.id })).status).toBe(404); // inte hennes betalning
  });

  it('påminnelse till alla som inte betalat, och deltagaren kan markera notisen som läst', async () => {
    const r = await call('notices', 'POST', emma, { title: 'Påminnelse', body: 'Betala senast på tisdag.', audience: 'unpaid' });
    expect(r.data.recipients).toBeGreaterThan(0);
    const n = (await call('my-notices', 'GET', sara)).data.notices[0];
    expect(n).toMatchObject({ title: 'Påminnelse', read: false });
    await call('my-notices', 'POST', sara, { id: n.id });
    expect((await call('my-notices', 'GET', sara)).data.notices[0].read).toBe(true);
  });

  it('mobilen registrerar push-token', async () => {
    expect((await call('push-token', 'POST', sara, { token: 'ExponentPushToken[abc123]' })).status).toBe(200);
    expect((await call('push-token', 'POST', sara, { token: 'fel' })).status).toBe(400);
  });

  it('appen kan göra CORS-förfrågan', async () => {
    const res = await (await m('my-schedule')).OPTIONS(new Request('http://localhost/api/my-schedule', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
  });
});
