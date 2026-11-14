-- Skydd mot dubbletter vid samtidiga anrop, och index för vanliga uppslag.
create unique index charges_one_unpaid_online on charges (online_program_id, person_id)
  where status = 'unpaid' and online_program_id is not null;
create index on notice_recipients (person_id);
create index on credits (person_id) where used_booking_id is null;
create index on online_access (person_id);
create index on sessions (round_id);
alter table login_codes add column if not exists ip text;
create index on login_codes (ip, created_at desc);

-- Onlineträning: tillgång direkt när deltagaren meddelat att hon swishat ('reported'),
-- och 'paid' när Emma sett betalningen.
alter table online_access drop constraint if exists online_access_source_check;
alter table online_access add constraint online_access_source_check check (source in ('paid', 'manual', 'reported'));
