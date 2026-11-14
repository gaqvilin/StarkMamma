-- Deltagaren kan meddela att hon har swishat, så att Emma vet vilka betalningar att leta efter.
alter table charges add column reported_paid_at timestamptz;
