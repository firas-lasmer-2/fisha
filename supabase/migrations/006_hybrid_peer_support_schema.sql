-- Shifa: Hybrid care (peer support + billing) schema

-- Expand role taxonomy for hybrid support and moderation.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'therapist', 'listener', 'moderator', 'admin'));

-- Listener profile and safety-gated activation state.
create table if not exists public.listener_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_alias varchar(80),
  languages text[],
  topics text[],
  timezone varchar(50),
  verification_status varchar(20) not null default 'pending',
  activation_status varchar(20) not null default 'inactive',
  training_completed_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  is_available boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.listener_applications (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  motivation text,
  relevant_experience text,
  languages text[],
  topics text[],
  weekly_hours integer,
  status varchar(20) not null default 'pending',
  moderation_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Queue for 1:1 listener matching.
create table if not exists public.listener_queue (
  id serial primary key,
  client_id uuid not null references public.profiles(id) on delete cascade,
  preferred_language varchar(10),
  topic_tags text[],
  status varchar(20) not null default 'waiting',
  matched_listener_id uuid references public.profiles(id),
  session_id integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.peer_sessions (
  id serial primary key,
  client_id uuid not null references public.profiles(id) on delete cascade,
  listener_id uuid not null references public.profiles(id) on delete cascade,
  queue_entry_id integer references public.listener_queue(id) on delete set null,
  status varchar(20) not null default 'active',
  anonymous_alias_client varchar(50),
  anonymous_alias_listener varchar(50),
  escalated_to_crisis boolean default false,
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

alter table public.listener_queue
  add constraint fk_listener_queue_session
  foreign key (session_id) references public.peer_sessions(id) on delete set null;

create table if not exists public.peer_messages (
  id serial primary key,
  session_id integer not null references public.peer_sessions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  encrypted boolean default false,
  is_flagged boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.peer_session_feedback (
  id serial primary key,
  session_id integer not null unique references public.peer_sessions(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  listener_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null,
  tags text[],
  comment text,
  created_at timestamptz default now()
);

create table if not exists public.peer_reports (
  id serial primary key,
  session_id integer references public.peer_sessions(id) on delete set null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  reason varchar(120) not null,
  details text,
  severity varchar(20) not null default 'medium',
  moderation_status varchar(20) not null default 'open',
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- Plans, subscriptions, and entitlement snapshots.
create table if not exists public.plans (
  id serial primary key,
  code varchar(30) not null unique,
  name varchar(80) not null,
  monthly_price_dinar real not null default 0,
  peer_minutes_limit integer not null default 60,
  priority_level integer not null default 0,
  therapist_discount_pct real not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id integer not null references public.plans(id),
  status varchar(20) not null default 'active',
  provider varchar(30),
  provider_ref varchar(120),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.entitlements (
  id serial primary key,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_code varchar(30) not null default 'free',
  peer_minutes_remaining integer not null default 60,
  priority_level integer not null default 0,
  therapist_discount_pct real not null default 0,
  renewed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Performance and uniqueness constraints.
create index if not exists idx_listener_profiles_status on public.listener_profiles(verification_status, activation_status);
create index if not exists idx_listener_applications_status on public.listener_applications(status);
create index if not exists idx_listener_queue_status on public.listener_queue(status, created_at);
create index if not exists idx_peer_sessions_status on public.peer_sessions(status, created_at);
create index if not exists idx_peer_messages_session on public.peer_messages(session_id, created_at);
create index if not exists idx_peer_reports_status on public.peer_reports(moderation_status, created_at);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id, status);
create index if not exists idx_entitlements_plan on public.entitlements(plan_code);

create unique index if not exists idx_listener_queue_active_by_client
  on public.listener_queue(client_id)
  where status in ('waiting', 'matched');

-- Generic updated_at triggers for mutable workflow tables.
drop trigger if exists set_updated_at_listener_profiles on public.listener_profiles;
create trigger set_updated_at_listener_profiles
  before update on public.listener_profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at_listener_applications on public.listener_applications;
create trigger set_updated_at_listener_applications
  before update on public.listener_applications
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at_listener_queue on public.listener_queue;
create trigger set_updated_at_listener_queue
  before update on public.listener_queue
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at_subscriptions on public.subscriptions;
create trigger set_updated_at_subscriptions
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at_entitlements on public.entitlements;
create trigger set_updated_at_entitlements
  before update on public.entitlements
  for each row execute function public.handle_updated_at();

-- Seed freemium plan matrix.
insert into public.plans (code, name, monthly_price_dinar, peer_minutes_limit, priority_level, therapist_discount_pct)
values
  ('free', 'Free', 0, 60, 0, 0),
  ('basic', 'Basic', 19.9, 180, 1, 10),
  ('premium', 'Premium', 39.9, 600, 2, 20)
on conflict (code) do update
set
  name = excluded.name,
  monthly_price_dinar = excluded.monthly_price_dinar,
  peer_minutes_limit = excluded.peer_minutes_limit,
  priority_level = excluded.priority_level,
  therapist_discount_pct = excluded.therapist_discount_pct;

-- Enable realtime for peer messaging and queue flows.
alter publication supabase_realtime add table public.peer_messages;
alter publication supabase_realtime add table public.peer_sessions;
alter publication supabase_realtime add table public.listener_queue;

