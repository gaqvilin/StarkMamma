-- Vardagsdrift: ny omgång med förtur, bokningar med klippkort, betalningar kopplade till anmälan.
alter table rounds add column previous_round_id uuid references rounds(id) on delete set null;
alter table sessions add column original_starts_at timestamptz;      -- satt när ett pass flyttas
alter table bookings add column punch_card_id uuid references punch_cards(id) on delete set null;
alter table bookings add column charge_id uuid references charges(id) on delete set null;
alter table registrations add column assigned_group_ids uuid[];
alter table charges add column registration_id uuid references registrations(id) on delete set null;
create index on bookings (person_id);
create index on group_members (person_id);
create index on charges (person_id, status);
