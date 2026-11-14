-- PÅHITTAD demodata för lokal utveckling (npm run dev:demo). Körs aldrig mot Neon.

insert into people (name, phone, email)
select f.n || ' ' || l.n,
       '07' || lpad(((f.i * 7919 + l.i * 104729) % 100000000)::text, 8, '0'),
       lower(translate(f.n || '.' || l.n, 'åäöéÅÄÖÉ ', 'aaoeAAOE')) || '@example.com'
from unnest(array['Anna','Sara','Maria','Johanna','Lisa','Karin','Elin','Frida','Malin','Hanna','Ida','Klara',
                  'Sofia','Emma','Linnea','Petra','Jenny','Therese','Camilla','Helena','Maja','Ebba','Moa','Josefin'])
       with ordinality as f(n, i)
cross join unnest(array['Berg','Lind','Ek','Holm','Strand','Sjö','Dahl'])
       with ordinality as l(n, i)
where (f.i + l.i) % 3 <> 0
limit 115;

-- Fördela deltagarna i grupperna: varje grupp fylls till kapacitet minus 0–3 platser.
with g as (
  select id, capacity - ((row_number() over (order by weekday, start_time))::int % 4) as fill,
         row_number() over (order by weekday, start_time) as gi
  from groups
), slots as (
  select g.id as group_id, g.gi, s as slot from g, generate_series(1, g.fill) s
), numbered as (
  select group_id, row_number() over (order by gi, slot) as k from slots
), p as (
  select id, row_number() over (order by name) as pi, count(*) over () as total from people where role = 'participant'
)
insert into group_members (group_id, person_id)
select n.group_id, p.id from numbered n join p on p.pi = ((n.k * 37) % p.total) + 1
on conflict do nothing;

-- Vecka 46: några återbud i tid, och svar "kommer" på måndagens pass.
insert into bookings (session_id, person_id, source, status)
select s.id, gm.person_id, 'ordinary',
       case when (abs(hashtext(s.id::text || gm.person_id::text)) % 9) = 0 then 'cancelled_in_time'
            when to_char(s.starts_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') = '2026-11-09'
                 and (abs(hashtext(gm.person_id::text)) % 4) <> 0 then 'attending'
            else 'booked' end
from sessions s join group_members gm on gm.group_id = s.group_id
where s.starts_at >= timestamp '2026-11-09' at time zone 'Europe/Stockholm'
  and s.starts_at < timestamp '2026-11-16' at time zone 'Europe/Stockholm';
delete from bookings where status = 'booked';

-- Kö på två fulla pass.
insert into waitlist (session_id, person_id)
select s.id, p.id
from (select id from sessions where place = 'Ladan'
        and starts_at >= timestamp '2026-11-09' at time zone 'Europe/Stockholm' order by starts_at limit 2) s
cross join (select id from people where role = 'participant' order by name desc limit 2) p
on conflict do nothing;

insert into notices (title, body, audience, page_heading, page_text, created_at)
values ('Välkommen till CT-omgång v 45–51!', 'Lämna återbud senast dagen innan så får du passet tillgodo.', 'all', null, null, timestamp '2026-11-01 09:00'),
       ('AdventsFYS & AdventsMYS sön 29/11', 'Vår årliga tradition är tillbaka. Tryck för att läsa mer.', 'all', 'AdventsFYS & AdventsMYS',
        'Söndag 29/11 kl 16.00 till cirka 17.30. Pass i Ladan, sedan fika i gymmet. 280 kr inklusive tröja och fika.', timestamp '2026-10-17 14:00');
insert into notice_recipients (notice_id, person_id, read_at)
select n.id, p.id, case when abs(hashtext(p.id::text)) % 3 = 0 then null else n.created_at + interval '1 hour' end
from notices n cross join people p where p.role = 'participant';

-- Tre personer som registrerat sig själva och väntar på aktivering.
insert into people (name, phone, email, status, signed_up_via, created_at) values
  ('Lovisa Wik', '0705550101', 'lovisa.wik@example.com', 'pending', 'facebook', timestamp '2026-11-07 20:14'),
  ('Nora Falk', '0705550102', 'nora.falk@example.com', 'pending', 'google', timestamp '2026-11-08 07:42'),
  ('Tove Sand', null, 'tove.sand@example.com', 'pending', 'email', timestamp '2026-11-08 11:05');

-- Betalningar för pågående omgång: de flesta har betalat.
insert into charges (person_id, description, amount, due_on, kind, round_id, status)
select distinct on (gm.person_id) gm.person_id, 'CT-omgång v 45–51 2026, 1 gång/vecka', 699, date '2026-10-27', 'round', g.round_id,
       case when abs(hashtext(gm.person_id::text)) % 7 = 0 then 'unpaid' else 'paid' end
from group_members gm join groups g on g.id = gm.group_id;
insert into payments (charge_id, amount, method, paid_at)
select id, amount, 'swish', timestamp '2026-10-25 12:00' from charges where status = 'paid';

-- Nästa omgång med anmälan öppen och ett antal anmälningar.
insert into rounds (program_id, name, starts_on, ends_on, registration_opens_at, priority_until, pay_deadline, installment_deadline, status, previous_round_id)
select program_id, 'CT-omgång v 2–8 2027', date '2027-01-11', date '2027-02-28',
       timestamp '2026-11-13 08:00' at time zone 'Europe/Stockholm', timestamp '2026-11-14 20:00' at time zone 'Europe/Stockholm',
       date '2026-12-22', date '2027-01-22', 'open', id
from rounds where name = 'CT-omgång v 45–51 2026';
insert into price_tiers (round_id, per_week, price, first_installment)
select n.id, t.per_week, t.price, t.first_installment from rounds n join price_tiers t on t.round_id = (select id from rounds where name = 'CT-omgång v 45–51 2026')
where n.name = 'CT-omgång v 2–8 2027';
insert into groups (round_id, weekday, start_time, place, capacity, min_participants)
select n.id, g.weekday, g.start_time, g.place, g.capacity, g.min_participants
from rounds n join groups g on g.round_id = n.previous_round_id where n.name = 'CT-omgång v 2–8 2027';
insert into registrations (round_id, person_id, per_week, created_at, friend_name)
select n.id, p.id, case when p.rn % 5 = 0 then 2 else 1 end,
       timestamp '2026-11-13 08:00' at time zone 'Europe/Stockholm' + (p.rn * interval '37 seconds'),
       case when p.rn = 3 then 'Hanna Holm' end
from rounds n, (select id, row_number() over (order by name) as rn from people where role = 'participant' and status = 'active') p
where n.name = 'CT-omgång v 2–8 2027' and p.rn <= 40;
-- Förstahandsval: personens nuvarande grupp i motsvarande ny grupp; andrahand: nästa grupp samma dag.
insert into registration_choices (registration_id, slot, rank, group_id)
select r.id, s.slot, 1, ng.id
from registrations r
join rounds n on n.id = r.round_id
cross join lateral generate_series(0, r.per_week - 1) as s(slot)
join lateral (
  select og.weekday, og.start_time from group_members gm join groups og on og.id = gm.group_id
  where gm.person_id = r.person_id and og.round_id = n.previous_round_id limit 1
) cur on true
join lateral (
  select g.id from groups g where g.round_id = n.id
  order by (g.weekday = cur.weekday and g.start_time = cur.start_time) desc, abs(g.weekday - cur.weekday - s.slot * 2), g.start_time
  offset s.slot limit 1
) ng on true
where n.name = 'CT-omgång v 2–8 2027'
on conflict do nothing;
insert into registration_choices (registration_id, slot, rank, group_id)
select c.registration_id, c.slot, 2, alt.id
from registration_choices c join groups g on g.id = c.group_id
join lateral (select id from groups x where x.round_id = g.round_id and x.weekday = g.weekday and x.id <> g.id order by x.start_time desc limit 1) alt on true
where c.rank = 1
on conflict do nothing;
