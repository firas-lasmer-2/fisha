-- Shifa: Payment webhook hardening fields

alter table public.payment_transactions
  add column if not exists provider_event_id varchar(120),
  add column if not exists provider_name varchar(32),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists idx_payment_transactions_provider_event
  on public.payment_transactions(provider_name, provider_event_id)
  where provider_event_id is not null and provider_name is not null;

create or replace function public.handle_payment_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_payment_updated_at on public.payment_transactions;
create trigger set_payment_updated_at
  before update on public.payment_transactions
  for each row execute function public.handle_payment_updated_at();

