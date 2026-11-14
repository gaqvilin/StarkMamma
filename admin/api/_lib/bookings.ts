// Regler för pass: återbud, tillgodo-pass, bokning med tillgodo/klippkort/drop-in, kö.
//
// - Ordinarie medlemmar i passets grupp är bokade utan rad i bookings; en rad anger avvikelse.
// - Återbud senast dagen innan (före midnatt svensk tid) ger ett tillgodo-pass i samma omgång.
// - Sena återbud ger inget tillgodo. Extrabokningar som avbokas i tid återbetalas
//   (tillgodo tillbaka, klipp tillbaka, drop-in-avgiften stryks).
// - Tillgodo-pass gäller bara ordinarie pass i samma omgång, inte extrapass.
import { tx, type Query } from './db.js';
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
      // Ta bort bokningen först och återbetala bara om det var just detta anrop som tog bort den,
      // så att två samtidiga avbokningar inte ger dubbel återbetalning.
      const [gone] = await q<{ punch_card_id: string | null; charge_id: string | null; source: string }>(
        `delete from bookings where id = $1 and status in ('booked', 'attending', 'attended') returning punch_card_id, charge_id, source`,
        [b.id],
      );
      if (!gone) throw new RuleError('Du är inte bokad på passet');
      if (gone.source === 'credit') await q(`update credits set used_booking_id = null where used_booking_id = $1`, [b.id]);
      if (gone.punch_card_id) await q(`update punch_cards set remaining = remaining + 1 where id = $1`, [gone.punch_card_id]);
      if (gone.charge_id) await q(`update charges set status = 'cancelled' where id = $1 and status = 'unpaid'`, [gone.charge_id]);
    } else {
      await q(`update bookings set status = 'cancelled_late', updated_at = now() where id = $1`, [b.id]);
    }
  }
  if (!s.started) await offerToQueue(q, s);
  return { status, credit: st.member && inTime };
}

/**
 * Tar en plats på passet under ett lås per pass, så att två samtidiga bokningar aldrig kan
 * ta samma sista plats. `admin` hoppar över max (Emma har sista ordet).
 * Returnerar bookings-radens id, eller null om passet var fullt.
 */
async function claimSpot(sessionId: string, personId: string, source: string, admin: boolean): Promise<string | null> {
  const [, rows] = await tx([
    { text: `select pg_advisory_xact_lock(hashtext($1))`, params: [sessionId] },
    {
      text: `with s as (select * from sessions where id = $1), ${ROSTER_CTE},
         ins as (
           insert into bookings (session_id, person_id, source, status)
           select $1, $2, $3, 'booked'
           where $4 or (select count(*) from roster where status in ${ACTIVE}) < (select capacity from s)
           on conflict (session_id, person_id) do update
             set source = excluded.source, status = 'booked', punch_card_id = null, charge_id = null, updated_at = now()
             where bookings.status not in ${ACTIVE}
           returning id)
         select id from ins`,
      params: [sessionId, personId, source, admin],
    },
  ]);
  return (rows[0]?.id as string) ?? null;
}

/** Ångrar ett återbud på ordinarie pass, om platsen finns kvar och tillgodo-passet inte använts. */
export async function undoCancel(q: Query, sessionId: string, personId: string, now: Date, admin = false) {
  const s = await getSession(q, sessionId, now);
  if (s.started && !admin) throw new RuleError('Passet har redan börjat');
  const st = await state(q, s, personId);
  if (!st.member || !st.booking || st.active) throw new RuleError('Det finns inget återbud att ångra');
  const [credit] = await q<{ used: string | null }>(`select used_booking_id as used from credits where from_booking_id = $1`, [st.booking.id]);
  if (credit?.used) throw new RuleError('Tillgodo-passet är redan använt på ett annat pass');
  const [, rows] = await tx([
    { text: `select pg_advisory_xact_lock(hashtext($1))`, params: [sessionId] },
    {
      text: `with s as (select * from sessions where id = $1), ${ROSTER_CTE},
         del as (
           delete from bookings where id = $2
             and ($3 or (select count(*) from roster where status in ${ACTIVE}) < (select capacity from s))
           returning id)
         select id from del`,
      params: [sessionId, st.booking.id, admin],
    },
  ]);
  if (!rows.length) throw new RuleError('Platsen har gått till någon annan');
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

  if (source === 'credit' && s.kind !== 'ordinary') throw new RuleError('Tillgodo-pass gäller bara ordinarie pass');

  // 1. Säkra platsen först (under lås), 2. dra tillgodo/klipp eller skapa avgift.
  // Går steg 2 inte att genomföra släpps platsen igen.
  const bookingId = await claimSpot(s.id, personId, source, admin);
  if (!bookingId) throw new RuleError('Passet är fullt. Ställ dig i kön så får du en notis om en plats blir ledig.');
  const release = async (msg: string) => {
    await q(`delete from bookings where id = $1`, [bookingId]);
    throw new RuleError(msg);
  };

  if (source === 'credit') {
    const [c] = await q<{ id: string }>(
      `update credits set used_booking_id = $3
       where id = (select id from credits where person_id = $1 and round_id = $2 and used_booking_id is null
                   order by created_at limit 1 for update skip locked)
         and used_booking_id is null
       returning id`,
      [personId, s.round_id, bookingId],
    );
    if (!c) await release('Du har inga tillgodo-pass kvar i den här omgången');
  } else if (source === 'punch_card') {
    const [c] = await q<{ id: string }>(
      `update punch_cards set remaining = remaining - 1
       where id = (select id from punch_cards where person_id = $1 and remaining > 0 and valid_until >= $2::date
                   order by valid_until limit 1 for update skip locked)
         and remaining > 0
       returning id`,
      [personId, s.date],
    );
    if (!c) await release('Du har inget giltigt klippkort med klipp kvar');
    await q(`update bookings set punch_card_id = $2 where id = $1`, [bookingId, c.id]);
  } else {
    const [c] = await q<{ id: string }>(
      `insert into charges (person_id, description, amount, due_on, kind, round_id)
       values ($1, $2, $3, $4::date, 'drop_in', $5) returning id`,
      [personId, `Drop-in ${s.date} ${s.time} ${s.place}`, s.price ?? DEFAULT_DROP_IN, s.date, s.round_id],
    );
    await q(`update bookings set charge_id = $2 where id = $1`, [bookingId, c.id]);
  }
  await q(`delete from waitlist where session_id = $1 and person_id = $2`, [s.id, personId]);
  return { bookingId };
}

export async function setAttendance(q: Query, sessionId: string, personId: string, status: 'attending' | 'attended' | 'no_show', now: Date) {
  const s = await getSession(q, sessionId, now);
  const st = await state(q, s, personId);
  if (!st.member && !st.booking) throw new RuleError('Personen är inte bokad på passet');
  // Efter ett återbud går det inte att bara säga "jag kommer": då skulle man behålla både platsen
  // och tillgodo-passet. Ett återbud ångras via undoCancel, som tar bort tillgodo-passet och
  // kontrollerar att platsen finns kvar.
  if (st.booking && st.booking.status.startsWith('cancelled')) {
    if (status === 'attending') throw new RuleError('Du har lämnat återbud. Ångra återbudet först.');
    const [credit] = await q<{ used: string | null }>(`select used_booking_id as used from credits where from_booking_id = $1`, [st.booking.id]);
    if (credit?.used) throw new RuleError('Tillgodo-passet är redan använt på ett annat pass');
    await q(`delete from credits where from_booking_id = $1`, [st.booking.id]);
  }
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
