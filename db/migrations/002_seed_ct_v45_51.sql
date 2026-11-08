-- Grunddata: Emma, crosstraining och omgången v 45–51 2026 enligt infobladet.

insert into people (name, email, role) values ('Emma Ekstedt', 'starkmammavarberg@gmail.com', 'trainer');

insert into programs (name) values ('Crosstraining'), ('Mammaträning med bebis');

with p as (select id from programs where name = 'Crosstraining')
insert into rounds (program_id, name, starts_on, ends_on, pay_deadline, installment_deadline, status)
select id, 'CT-omgång v 45–51 2026', date '2026-11-02', date '2026-12-20', date '2026-10-27', date '2026-11-27', 'running' from p;

insert into price_tiers (round_id, per_week, price, first_installment)
select r.id, t.per_week, t.price, t.first_installment
from rounds r, (values (1, 699, null::int), (2, 1299, 699), (3, 1799, 699)) as t(per_week, price, first_installment)
where r.name = 'CT-omgång v 45–51 2026';

insert into groups (round_id, weekday, start_time, place, capacity)
select r.id, g.weekday, g.t::time, g.place, g.capacity
from rounds r, (values
  (1, '12:00', 'Gymmet', 16), (1, '17:30', 'Ladan', 20), (1, '18:45', 'Gymmet', 16),
  (2, '06:15', 'Gymmet', 16), (2, '17:30', 'Gymmet', 16), (2, '18:45', 'Gymmet', 16),
  (4, '16:20', 'Gymmet', 16), (4, '17:30', 'Ladan', 20), (4, '18:45', 'Ladan', 20),
  (5, '06:15', 'Gymmet', 16)
) as g(weekday, t, place, capacity)
where r.name = 'CT-omgång v 45–51 2026';

-- Ett tillfälle per grupp och vecka (7 veckor), med undantagen från infobladet:
-- v 47 körs tors- och fredagspassen onsdag 18/11, v 51 körs fredagspasset onsdag 16/12.
insert into sessions (round_id, group_id, starts_at, place, capacity, status, note)
select g.round_id, g.id,
  ((case
     when w = 2 and g.weekday in (4, 5) then date '2026-11-18'
     when w = 6 and g.weekday = 5 then date '2026-12-16'
     else date '2026-11-02' + (w * 7 + g.weekday - 1)
   end) + g.start_time) at time zone 'Europe/Stockholm',
  g.place, g.capacity,
  case when (w = 2 and g.weekday in (4, 5)) or (w = 6 and g.weekday = 5) then 'moved' else 'planned' end,
  case
    when w = 2 and g.weekday = 4 then 'Flyttat från torsdag v 47'
    when w = 2 and g.weekday = 5 then 'Flyttat från fredag v 47'
    when w = 6 and g.weekday = 5 then 'Flyttat från fredag v 51'
  end
from groups g, generate_series(0, 6) as w;
