-- Egen registrering: vem som helst kan logga in med e-post (kod), Google eller Facebook.
-- Nya konton får status 'pending' tills Emma aktiverar dem.
alter table people add column status text not null default 'active'
  check (status in ('pending', 'active', 'rejected'));
alter table people add column signed_up_via text;          -- email, google, facebook, admin
alter table people add column activated_at timestamptz;

-- Koder kan nu skickas till e-postadresser som inte har något konto än.
alter table login_codes alter column person_id drop not null;
alter table login_codes add column email text;
create index on login_codes (email, created_at desc);
