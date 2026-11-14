-- Notiser som kräver att mottagaren bekräftar att hon läst (t.ex. inställt pass, event).
alter table notices add column requires_ack boolean not null default false;
alter table notice_recipients add column acknowledged_at timestamptz;
alter table notice_recipients add column reminded_at timestamptz;
create index on notices (audience);
