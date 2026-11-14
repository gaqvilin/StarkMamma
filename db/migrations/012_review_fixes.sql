-- Rättningar efter säkerhetsgranskningen.

-- Inloggning kan återkallas: tokens bär en version som höjs vid "logga ut överallt" och vid avböjt konto.
alter table people add column token_version integer not null default 0;

-- Telefonnummer används inte för inloggning längre och ska inte kunna "paxas" av någon annan.
alter table people drop constraint if exists people_phone_key;
create index on people (phone);

-- Klippkort kopplas till betalningen, så att en ångrad betalning tar bort ett oanvänt kort.
alter table punch_cards add column charge_id uuid references charges(id) on delete set null;
create unique index punch_cards_one_per_charge on punch_cards (charge_id) where charge_id is not null;

create index on payments (charge_id);

-- Mobilappens Google/Facebook-inloggning: en kortlivad engångskod som byts mot token med PKCE,
-- i stället för att token skickas i en starkmamma://-länk som en annan app kan fånga.
create table oauth_exchanges (
  code_hash text primary key,
  person_id uuid not null references people(id) on delete cascade,
  code_challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
