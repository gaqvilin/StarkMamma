-- Onlineträning (pass som text eller film, tillgång för den som betalat) och utmaningar (bingo).

create table online_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price integer not null default 0,
  starts_on date,
  ends_on date,
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),  -- open = går att köpa i appen
  created_at timestamptz not null default now()
);

create table online_access (
  program_id uuid not null references online_programs(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  source text not null check (source in ('paid', 'manual')),
  granted_at timestamptz not null default now(),
  primary key (program_id, person_id)
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references online_programs(id) on delete cascade,
  title text not null,
  body text,                     -- passet i text: övningar, varv, tider
  video_url text,                -- film där Emma visar passet (t.ex. olistad YouTube eller Vimeo)
  duration_min integer,
  publish_on date,               -- syns från detta datum (null = direkt)
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index on workouts (program_id, publish_on);

create table workout_done (
  workout_id uuid not null references workouts(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (workout_id, person_id)
);

alter table charges add column online_program_id uuid references online_programs(id) on delete set null;
alter table charges drop constraint if exists charges_kind_check;
alter table charges add constraint charges_kind_check
  check (kind in ('round', 'installment', 'drop_in', 'punch_card', 'event', 'product', 'tab', 'online'));

create table challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  prize text,
  starts_on date not null,
  ends_on date not null,
  program_id uuid references online_programs(id) on delete set null,  -- bara för dem med tillgång (null = alla)
  created_at timestamptz not null default now()
);

create table challenge_tasks (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  sort integer not null,
  text text not null,
  workout_id uuid references workouts(id) on delete set null
);
create index on challenge_tasks (challenge_id, sort);

create table challenge_checks (
  task_id uuid not null references challenge_tasks(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  done_on date not null,
  created_at timestamptz not null default now(),
  primary key (task_id, person_id)
);

create table challenge_winners (
  challenge_id uuid not null references challenges(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  drawn_at timestamptz not null default now(),
  primary key (challenge_id, person_id)
);
