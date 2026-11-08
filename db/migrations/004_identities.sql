-- Inloggning med Google eller Facebook. Första gången kopplas kontot via e-postadressen
-- (som måste finnas hos en registrerad deltagare eller Emma); därefter via leverantörens id.
create table identities (
  provider text not null check (provider in ('google', 'facebook', 'apple')),
  subject text not null,                  -- användarens id hos leverantören
  person_id uuid not null references people(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  primary key (provider, subject)
);
create index on identities (person_id);
