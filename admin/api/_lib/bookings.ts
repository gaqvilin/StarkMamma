// Regler för pass: återbud, tillgodo-pass, bokning med tillgodo/klippkort/drop-in, kö.
//
// - Ordinarie medlemmar i passets grupp är bokade utan rad i bookings; en rad anger avvikelse.
// - Återbud senast dagen innan (före midnatt svensk tid) ger ett tillgodo-pass i samma omgång.
// - Sena återbud ger inget tillgodo. Extrabokningar som avbokas i tid återbetalas
//   (tillgodo tillbaka, klipp tillbaka, drop-in-avgiften stryks).
// - Tillgodo-pass gäller bara ordinarie pass i samma omgång, inte extrapass.
import type { Query } from './db.js';
import { sendNotice } from './notify.js';
import { ACTIVE, ROSTER_CTE } from './roster.js';

export class RuleError extends Error {}

export interface SessionRow {
  id: string;
  round_id: string | null;
  group_id: string | null;
  capacity: number;
  status: string;
  kind: string;
  price: number | null;
  place: string;
  date: string;
  time: string;
  started: boolean;
  in_time: boolean; // återbud nu ger tillgodo
}

const DEFAULT_DROP_IN = 140;

export async function getSession(q: Query, sessionId: string, now: Date): Promise<SessionRow> {
  const [s] = await q<SessionRow & Record<string, unknown>>(
    `select s.id, s.round_id, s.group_id, s.capacity, s.status, s.kind, s.price, s.place,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') as date,
       to_char(s.starts_at at time zone 'Europe/Stockholm', 'HH24.MI') as time,
       s.starts_at <= $2::timestamptz as started,
       $2::timestamptz < (date_trunc('day', s.starts_at at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm') as in_time
     from sessions s where s.id = $1`,
    [sessionId, now.toISOString()],
  );
  if (!s) throw new RuleError('Passet finns inte');
  return s;
}

export async function activeCount(q: Query, sessionId: string): Promise<number> {
  const [r] = await q<{ n: number }>(
    `with s as (select * from sessions where id = $1), ${ROSTER_CTE}
     select count(*)::int as n from roster where status in ${ACTIVE}`,
    [sessionId],
  );
  return r.n;
}

interface Booking {
  id: string;
  status: string;
  source: string;
  punch_card_id: string | null;
  charge_id: string | null;
}

async function state(q: Query, s: SessionRow, personId: string) {
  const [m] = await q(`select 1 from group_members where group_id = $1 and person_id = $2`, [s.group_id, personId]);
  const [b] = await q<Booking & Record<string, unknown>>(
    `select id, status, source, punch_card_id, charge_id from bookings where session_id = $1 and person_id = $2`,
    [s.id, personId],
  );
  const member = !!m;
  const active = member ? !b || ['booked', 'attending', 'attended'].includes(b.status) : !!b && ['booked', 'attending', 'attended'].includes(b.status);
  return { member, booking: b ?? null, active };
}

async function offerToQueue(q: Query, s: SessionRow) {
  const queue = await q<{ person_id: string }>(`select person_id from waitlist where session_id = $1 order by created_at`, [s.id]);
  if (!queue.length) return;
  const d = new Date(`${s.date}T12:00:00`);
  const day = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'][d.getDay()];
  await sendNotice(
    q,
    {
      title: `Ledig plats ${day} ${s.time}`,
      body: `En plats blev ledig på ${s.place} ${day} ${d.getDate()}/${d.getMonth() + 1} kl ${s.time}. Först att boka får platsen.`,
      audience: `waitlist:${s.id}`,
    },
    queue.map((x) => x.person_id),
  );
}

/** Återbud. `force` används av Emma för att välja i tid eller sent oavsett klockan. */
export async function cancel(
  q: Query,
  sessionId: string,
  personId: string,
  now: Date,
  force?: 'cancelled_in_time' | 'cancelled_late',
): Promise<{ status: string; credit: boolean }> {
  const s = await getSession(q, sessionId, now);
  if (s.started && !force) throw new RuleError('Passet har redan börjat');
  const st = await state(q, s, personId);
  if (!st.active) throw new RuleError('Du är inte bokad på passet');
  const inTime = force ? force === 'cancelled_in_time' : s.in_time;
  const status = inTime ? 'cancelled_in_time' : 'cancelled_late';

  if (st.member) {
    const [b] = await q<{ id: string }>(
      `insert into bookings (session_id, person_id, source, status) values ($1, $2, 'ordinary', $3)
       on conflict (session_id, person_id) do update set status = excluded.status, updated_at = now() returning id`,
      [s.id, personId, status],
    );
    if (inTime && s.round_id) {
      await q(`insert into credits (person_id, round_id, from_booking_id) values ($1, $2, $3) on conflict do nothing`, [
        personId, s.round_id, b.id,
      ]);
    } else {
      await q(`delete from credits where from_booking_id = $1 and used_booking_id is null`, [b.id]);
    }
  } else {
    const b = st.booking!;
    if (inTime) {
      if (b.source === 'credit') await q(`update credits set used_booking_id = null where used_booking_id = $1`, [b.id]);
      if (b.punch_card_id) await q(`update punch_cards set remaining = remaining + 1 where id = $1`, [b.punch_card_id]);
      if (b.charge_id) await q(`update charges set status = 'cancelled' where id = $1 and status = 'unpaid'`, [b.charge_id]);
      await q(`delete from bookings where id = $1`, [b.id]);
    } else {
      await q(`update bookings set status = 'cancelled_late', updated_at = now() where id = $1`, [b.id]);
    }
  }
  if (!s.started) await offerToQueue(q, s);
  return { status, credit: st.member && inTime };
}

/** Ångrar ett återbud på ordinarie pass, om platsen finns kvar och tillgodo-passet inte använts. */
export async function undoCancel(q: Query, sessionId: string, personId: string, now: Date, admin = false) {
  const s = await getSession(q, sessionId, now);
  if (s.started && !admin) throw new RuleError('Passet har redan börjat');
  const st = await state(q, s, personId);
  if (!st.member || !st.booking || st.active) throw new RuleError('Det finns inget återbud att ångra');
  const [credit] = await q<{ used: string | null }>(`select used_booking_id as used from credits where from_booking_id = $1`, [st.booking.id]);
  if (credit?.used) throw new RuleError('Tillgodo-passet är redan använt på ett annat pass');
  if (!admin && (await activeCount(q, s.id)) >= s.capacity) throw new RuleError('Platsen har gått till någon annan');
  await q(`delete from bookings where id = $1`, [st.booking.id]);
}

export async function availableCredits(q: Query, personId: string, roundId: string | null) {
  const [r] = await q<{ n: number }>(
    `select count(*)::int as n from credits where person_id = $1 and used_booking_id is null and ($2::uuid is null or round_id = $2)`,
    [personId, roundId],
  );
  return r.n;
}

export type Source = 'credit' | 'punch_card' | 'drop_in';

/** Bokar en plats på ett pass utöver ordinarie grupp. Emma kan boka även när passet är fullt. */
export async function book(q: Query, sessionId: string, personId: string, source: Source, now: Date, admin = false) {
  const s = await getSession(q, sessionId, now);
  if (s.started && !admin) throw new RuleError('Passet har redan börjat');
  if (s.status === 'cancelled') throw new RuleError('Passet är inställt');
  const st = await state(q, s, personId);
  if (st.active) throw new RuleError('Du är redan bokad på passet');
  if (st.member) return undoCancel(q, sessionId, personId, now, admin);
  if (!admin && (await activeCount(q, s.id)) >= s.capacity) throw new RuleError('Passet är fullt. Ställ dig i kön så får du en notis om en plats blir ledig.');

  let creditId: string | null = null;
  let punchId: string | null = null;
  let chargeId: string | null = null;
  if (source === 'credit') {
    if (s.kind !== 'ordinary') throw new RuleError('Tillgodo-pass gäller bara ordinarie pass');
    const [c] = await q<{ id: string }>(
      `select id from credits where person_id = $1 and round_id = $2 and used_booking_id is null order by created_at limit 1`,
      [personId, s.round_id],
    );
    if (!c) throw new RuleError('Du har inga tillgodo-pass i den här omgången');
    creditId = c.id;
  } else if (source === 'punch_card') {
    const [c] = await q<{ id: string }>(
      `update punch_cards set remaining = remaining - 1
       where id = (select id from punch_cards where person_id = $1 and remaining > 0 and valid_until >= $2::date
                   order by valid_until limit 1)
       returning id`,
      [personId, s.date],
    );
    if (!c) throw new RuleError('Du har inget giltigt klippkort med klipp kvar');
    punchId = c.id;
  } else {
    const [c] = await q<{ id: string }>(
      `insert into charges (person_id, description, amount, due_on, kind, round_id)
       values ($1, $2, $3, $4::date, 'drop_in', $5) returning id`,
      [personId, `Drop-in ${s.date} ${s.time} ${s.place}`, s.price ?? DEFAULT_DROP_IN, s.date, s.round_id],
    );
    chargeId = c.id;
  }
  const [b] = await q<{ id: string }>(
    `insert into bookings (session_id, person_id, source, status, punch_card_id, charge_id)
     values ($1, $2, $3, 'booked', $4, $5)
     on conflict (session_id, person_id) do update set source = excluded.source, status = 'booked',
       punch_card_id = excluded.punch_card_id, charge_id = excluded.charge_id, updated_at = now()
     returning id`,
    [s.id, personId, source, punchId, chargeId],
  );
  if (creditId) await q(`update credits set used_booking_id = $2 where id = $1`, [creditId, b.id]);
  await q(`delete from waitlist where session_id = $1 and person_id = $2`, [s.id, personId]);
  return { bookingId: b.id };
}

export async function setAttendance(q: Query, sessionId: string, personId: string, status: 'attending' | 'attended' | 'no_show', now: Date) {
  const s = await getSession(q, sessionId, now);
  const st = await state(q, s, personId);
  if (!st.member && !st.booking) throw new RuleError('Personen är inte bokad på passet');
  if (st.member) {
    await q(
      `insert into bookings (session_id, person_id, source, status) values ($1, $2, 'ordinary', $3)
       on conflict (session_id, person_id) do update set status = excluded.status, updated_at = now()`,
      [s.id, personId, status],
    );
  } else {
    await q(`update bookings set status = $2, updated_at = now() where id = $1`, [st.booking!.id, status]);
  }
}

export async function joinWaitlist(q: Query, sessionId: string, personId: string, now: Date) {
  const s = await getSession(q, sessionId, now);
  if (s.started) throw new RuleError('Passet har redan börjat');
  const st = await state(q, s, personId);
  if (st.active) throw new RuleError('Du är redan bokad på passet');
  await q(`insert into waitlist (session_id, person_id) values ($1, $2) on conflict do nothing`, [s.id, personId]);
}
