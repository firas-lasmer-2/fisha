-- Shifa: Marketplace tiers, slot inventory, listener progression; remove billing tables

-- Tier support for therapist profiles.
alter table public.therapist_profiles
  add column if not exists tier varchar(20) not null default 'professional',
  add column if not exists tier_approved_by uuid references public.profiles(id),
  add column if not exists tier_approved_at timestamptz;

alter table public.therapist_profiles
  drop constraint if exists therapist_profiles_tier_check;

alter table public.therapist_profiles
  add constraint therapist_profiles_tier_check
  check (tier in ('student', 'professional'));

update public.therapist_profiles
set tier = 'professional'
where tier is null;

-- Centralized runtime config for business rules.
create table if not exists public.app_config (
  key varchar(80) primary key,
  value_text text not null,
  updated_at timestamptz default now()
);

insert into public.app_config (key, value_text)
values ('student_therapist_cap_dinar', '20')
on conflict (key) do update set value_text = excluded.value_text, updated_at = now();

create or replace function public.get_student_therapist_cap_dinar()
returns real
language plpgsql
as $$
declare
  cap_text text;
  cap_value real;
begin
  select value_text into cap_text
  from public.app_config
  where key = 'student_therapist_cap_dinar';

  if cap_text is null then
    return 20;
  end if;

  cap_value := cap_text::real;
  if cap_value <= 0 then
    return 20;
  end if;

  return cap_value;
exception
  when others then
    return 20;
end;
$$;

create or replace function public.enforce_student_therapist_rate_cap()
returns trigger
language plpgsql
as $$
declare
  cap_value real;
begin
  cap_value := public.get_student_therapist_cap_dinar();
  if new.tier = 'student' and new.rate_dinar is not null and new.rate_dinar > cap_value then
    raise exception 'Student therapist rate exceeds cap (max % TND)', cap_value;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_student_therapist_rate_cap on public.therapist_profiles;
create trigger trg_enforce_student_therapist_rate_cap
  before insert or update on public.therapist_profiles
  for each row execute function public.enforce_student_therapist_rate_cap();

-- Therapist-published slots.
create table if not exists public.therapist_slots (
  id serial primary key,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price_dinar real not null check (price_dinar >= 0),
  status varchar(20) not null default 'open',
  appointment_id integer unique references public.appointments(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.therapist_slots
  drop constraint if exists therapist_slots_status_check;

alter table public.therapist_slots
  add constraint therapist_slots_status_check
  check (status in ('open', 'booked', 'cancelled', 'closed'));

create index if not exists idx_therapist_slots_therapist_starts
  on public.therapist_slots(therapist_id, starts_at);

create index if not exists idx_therapist_slots_status
  on public.therapist_slots(status, starts_at);

create or replace function public.enforce_therapist_slot_rules()
returns trigger
language plpgsql
as $$
declare
  therapist_tier varchar(20);
  cap_value real;
begin
  select tier into therapist_tier
  from public.therapist_profiles
  where user_id = new.therapist_id;

  cap_value := public.get_student_therapist_cap_dinar();
  if therapist_tier = 'student' and new.price_dinar > cap_value then
    raise exception 'Student therapist slot price exceeds cap (max % TND)', cap_value;
  end if;

  if new.status in ('open', 'booked') then
    if exists (
      select 1
      from public.therapist_slots s
      where s.therapist_id = new.therapist_id
        and s.id <> coalesce(new.id, -1)
        and s.status in ('open', 'booked')
        and tstzrange(s.starts_at, s.starts_at + make_interval(mins => s.duration_minutes), '[)')
            && tstzrange(new.starts_at, new.starts_at + make_interval(mins => new.duration_minutes), '[)')
    ) then
      raise exception 'Therapist slot overlaps with an existing open/booked slot';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_therapist_slot_rules on public.therapist_slots;
create trigger trg_enforce_therapist_slot_rules
  before insert or update on public.therapist_slots
  for each row execute function public.enforce_therapist_slot_rules();

drop trigger if exists set_updated_at_therapist_slots on public.therapist_slots;
create trigger set_updated_at_therapist_slots
  before update on public.therapist_slots
  for each row execute function public.handle_updated_at();

-- Listener progression model (points + levels + ledger).
create table if not exists public.listener_progress (
  listener_id uuid primary key references public.profiles(id) on delete cascade,
  points integer not null default 0,
  level integer not null default 1,
  sessions_rated_count integer not null default 0,
  last_calculated_at timestamptz default now()
);

create table if not exists public.listener_points_ledger (
  id serial primary key,
  listener_id uuid not null references public.profiles(id) on delete cascade,
  session_id integer references public.peer_sessions(id) on delete set null,
  event_type varchar(40) not null,
  delta integer not null,
  meta jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_listener_progress_points
  on public.listener_progress(points desc);

create index if not exists idx_listener_points_ledger_listener_created
  on public.listener_points_ledger(listener_id, created_at desc);

create unique index if not exists idx_listener_points_award_once
  on public.listener_points_ledger(listener_id, session_id, event_type)
  where event_type in ('session_base', 'rating_bonus');

-- Report penalty application guard.
alter table public.peer_reports
  add column if not exists penalty_applied boolean not null default false;

-- Remove subscription billing domain completely.
drop table if exists public.entitlements cascade;
drop table if exists public.subscriptions cascade;
drop table if exists public.plans cascade;
