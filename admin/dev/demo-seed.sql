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

-- Onlineträning och bingo.
insert into online_programs (name, description, price, starts_on, ends_on, status)
values ('Online höst 2026', 'Korta, effektiva pass att köra hemma. Ett nytt pass varje vecka, i text och film.', 499, date '2026-11-01', date '2026-12-20', 'open'),
       ('Mammaträning online', 'För dig som vill starta upp träningen hemma efter förlossningen.', 399, date '2026-11-01', date '2026-12-20', 'open');
insert into workouts (program_id, title, body, video_url, duration_min, publish_on, sort)
select p.id, w.title, w.body, w.video, w.min, w.pub, w.sort
from online_programs p, (values
  ('Pass 1: Helkropp med egen kropp', E'Värm upp 5 min med rask gång eller jogg på stället.\n\nKör 5 varv, 45 sek arbete och 15 sek vila:\n- Djupa knäböj\n- Utfallssteg framåt, vartannat ben\n- Burpees\n- Armhävningar\n- V-ups\n\nVila en minut mellan varven.', null, 25, date '2026-11-02', 1),
  ('Pass 2: Träna med mig, 30 min', E'Filmen visar hela passet. Ta fram en matta och en vattenflaska.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 30, date '2026-11-09', 2),
  ('Pass 3: EMOM 35 minuter', E'Sätt en timer på 35 enminutersintervaller.\n\nMinut 1: 25 knäböj\nMinut 2: 15–20 armhävningar\nMinut 3: 10–15 burpees\nMinut 4: 20–25 situps\nMinut 5: 10–15 per sida bulgariska utfall\nMinut 6: 45 sek höga knän\nMinut 7: vila\n\nKör totalt 5 varv.', null, 35, date '2026-11-16', 3)
) as w(title, body, video, min, pub, sort)
where p.name = 'Online höst 2026';
insert into online_access (program_id, person_id, source)
select p.id, x.id, 'paid' from online_programs p, (select id from people where role = 'participant' and status = 'active' order by name limit 18) x
where p.name = 'Online höst 2026';
insert into workout_done (workout_id, person_id)
select w.id, a.person_id from workouts w join online_access a on a.program_id = w.program_id
where w.sort = 1 and abs(hashtext(a.person_id::text)) % 3 <> 0;

insert into challenges (name, description, prize, starts_on, ends_on)
values ('HÖST-bingo', 'Gör alla aktiviteter och bocka av dem med datum. Bara ett kryss per aktivitet.',
        'Två 5-gångerskort på crosstrainingen och en egen stund med Emma', date '2026-11-07', date '2026-11-30');
insert into challenge_tasks (challenge_id, sort, text)
select c.id, t.sort, t.text from challenges c, (values
  (0, 'Promenera minst 8 km eller jogga minst 3 km'), (1, 'Promenera eller spring en ny vandringsled i Halland'),
  (2, 'Simma minst 20 minuter'), (3, 'Cykla minst 10 km'), (4, 'Ta ett höstbad i havet eller en sjö'),
  (5, 'Vila stilla och tyst minst 20 min'), (6, '20 minuter: 25 knäböj, 20 utfall, 15 v-ups, 10 armhävningar, 5 burpees'),
  (7, 'Promenera minst 8 km eller jogga minst 3 km'), (8, '45/15 i 5 varv: knäböj, utfall, burpees, armhävningar, v-ups'),
  (9, 'EMOM 35 minuter'), (10, 'Intervaller: 6–10 x 1 min löpning med 1 min gåvila'), (11, '23 minuters intervaller, 4 varv')
) as t(sort, text) where c.name = 'HÖST-bingo';
insert into challenge_checks (task_id, person_id, done_on)
select t.id, x.id, date '2026-11-08' + (t.sort % 5)
from challenge_tasks t, (select id, row_number() over (order by name) as rn from people where role = 'participant' and status = 'active' order by name limit 12) x
where t.sort < 12 - x.rn
on conflict do nothing;
