-- Inloggning med engångskod via sms eller e-post (samma för mobilappen och admin).
create table login_codes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  code_hash text not null,
  channel text not null check (channel in ('sms', 'email')),
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on login_codes (person_id, created_at desc);
