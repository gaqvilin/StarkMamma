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
