-- StarkMamma: grundschema för version 1 (Neon Postgres).
-- Belopp lagras i hela kronor. Tider lagras som timestamptz (Europe/Stockholm i appen).

create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text unique,
  role text not null default 'participant' check (role in ('participant', 'trainer')),
  health_note text,                       -- känslig uppgift: frivillig, bara synlig för tränaren
  health_note_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  kind text not null check (kind in ('expo', 'webpush')),
  token text not null unique,             -- ExponentPushToken[...] eller Web Push-prenumeration som JSON
  created_at timestamptz not null default now()
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique              -- Crosstraining, Mammaträning med bebis, ...
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  name text not null,                     -- "CT-omgång v 45–51 2026"
  starts_on date not null,
  ends_on date not null,
  registration_opens_at timestamptz,
  priority_until timestamptz,             -- förtur för nuvarande deltagare fram till
  pay_deadline date,
  installment_deadline date,
  info text,
  status text not null default 'draft' check (status in ('draft', 'open', 'running', 'closed'))
);

create table price_tiers (
  round_id uuid not null references rounds(id) on delete cascade,
  per_week smallint not null check (per_week between 1 and 3),
  price integer not null,
  first_installment integer,              -- null = delbetalning ej möjlig
  primary key (round_id, per_week)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),   -- 1 = måndag
  start_time time not null,
  place text not null,                    -- Gymmet, Ladan
  capacity integer not null,
  min_participants integer not null default 14,
  kind text not null default 'ordinary' check (kind in ('ordinary', 'special', 'focus'))
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,   -- null för extrapass
  starts_at timestamptz not null,
  place text not null,
  capacity integer not null,
  kind text not null default 'ordinary' check (kind in ('ordinary', 'extra', 'event')),
  status text not null default 'planned' check (status in ('planned', 'moved', 'cancelled')),
  price integer,                          -- extrapass/event, t.ex. 140 eller 280
  min_participants integer,               -- extrapass blir av vid minst så många
  note text                               -- t.ex. "Flyttat från torsdag v 47"
);
create index on sessions (starts_at);
create index on sessions (group_id);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (group_id, person_id)
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  per_week smallint not null check (per_week between 1 and 3),
  installments boolean not null default false,
  friend_name text,
  created_at timestamptz not null default clock_timestamp(),  -- exakt tid avgör ordningen
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'waitlist', 'withdrawn')),
  unique (round_id, person_id)
);

create table registration_choices (
  registration_id uuid not null references registrations(id) on delete cascade,
  slot smallint not null,                 -- pass 1, 2, 3 per vecka
  rank smallint not null,                 -- 1 = förstahand, 2 = andrahand
  group_id uuid not null references groups(id) on delete cascade,
  primary key (registration_id, slot, rank)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  source text not null check (source in ('ordinary', 'credit', 'punch_card', 'drop_in', 'event')),
  status text not null default 'booked'
    check (status in ('booked', 'attending', 'cancelled_in_time', 'cancelled_late', 'attended', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, person_id)
);

create table waitlist (
  session_id uuid not null references sessions(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (session_id, person_id)
);

-- Tillgodo-pass: skapas av återbud i tid, gäller bara inom samma omgång.
create table credits (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  from_booking_id uuid not null unique references bookings(id) on delete cascade,
  used_booking_id uuid unique references bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 10-kort, 5-gångerskort och presentkort.
create table punch_cards (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  kind text not null check (kind in ('10-kort', '5-kort', 'presentkort')),
  total smallint not null,
  remaining smallint not null check (remaining >= 0),
  purchased_at date not null default current_date,
  valid_until date not null
);

-- Det deltagaren ska betala, och inbetalningar mot det.
create table charges (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  description text not null,
  amount integer not null,
  due_on date,
  kind text not null check (kind in ('round', 'installment', 'drop_in', 'punch_card', 'event', 'product', 'tab')),
  round_id uuid references rounds(id) on delete set null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'cancelled')),
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references charges(id) on delete cascade,
  amount integer not null,
  paid_at timestamptz not null default now(),
  method text not null check (method in ('swish', 'bank', 'cash', 'other')),
  reference text,
  receipt_number serial
);

-- Notiser, med valfri informationssida.
create table notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  page_heading text,
  page_text text,
  page_link text,
  audience text not null,                 -- t.ex. 'all', 'group:<id>', 'unpaid', 'waitlist:<session>'
  sent_by uuid references people(id),
  created_at timestamptz not null default now()
);

create table notice_recipients (
  notice_id uuid not null references notices(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  delivered_via text,                     -- expo, webpush, sms, email
  read_at timestamptz,
  primary key (notice_id, person_id)
);
