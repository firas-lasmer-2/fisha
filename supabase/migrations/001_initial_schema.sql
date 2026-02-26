-- Shifa: Initial Schema Migration
-- Migrated from Drizzle ORM schema to Supabase SQL

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Profiles table (replaces users table, linked to auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email varchar unique,
  first_name varchar,
  last_name varchar,
  profile_image_url varchar,
  role varchar(20) not null default 'client',
  phone varchar,
  language_preference varchar(10) default 'ar',
  governorate varchar,
  bio text,
  is_anonymous boolean default false,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Therapist profiles
create table public.therapist_profiles (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  license_number varchar,
  specializations text[],
  languages text[],
  rate_dinar real default 80,
  verified boolean default false,
  rating real default 0,
  review_count integer default 0,
  years_experience integer default 0,
  education text,
  approach text,
  available_days text[],
  available_hours_start varchar(5) default '09:00',
  available_hours_end varchar(5) default '17:00',
  accepts_online boolean default true,
  accepts_in_person boolean default false,
  office_address text,
  gender varchar(10),
  headline text,
  about_me text,
  video_intro_url varchar,
  office_photos text[],
  faq_items jsonb,
  social_links jsonb,
  slug varchar unique,
  profile_theme_color varchar(20),
  accepting_new_clients boolean default true,
  created_at timestamptz default now()
);

-- Therapist reviews
create table public.therapist_reviews (
  id serial primary key,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id integer,
  overall_rating integer not null,
  helpfulness_rating integer,
  communication_rating integer,
  comment text,
  therapist_response text,
  is_anonymous boolean default true,
  created_at timestamptz default now()
);

-- Therapy conversations
create table public.therapy_conversations (
  id serial primary key,
  client_id uuid not null references public.profiles(id) on delete cascade,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  status varchar(20) not null default 'active',
  encryption_key text,
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Therapy messages
create table public.therapy_messages (
  id serial primary key,
  conversation_id integer not null references public.therapy_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  message_type varchar(20) not null default 'text',
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Appointments
create table public.appointments (
  id serial primary key,
  client_id uuid not null references public.profiles(id) on delete cascade,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer default 50,
  session_type varchar(20) not null default 'chat',
  status varchar(20) not null default 'pending',
  notes text,
  price_dinar real,
  created_at timestamptz default now()
);

-- Add foreign key from reviews to appointments (now that appointments table exists)
alter table public.therapist_reviews
  add constraint fk_review_appointment
  foreign key (appointment_id) references public.appointments(id) on delete set null;

-- Mood entries
create table public.mood_entries (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mood_score integer not null,
  emotions text[],
  notes text,
  triggers text[],
  created_at timestamptz default now()
);

-- Journal entries
create table public.journal_entries (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title varchar,
  content text not null,
  prompt_id integer,
  mood varchar(20),
  is_shared_with_therapist boolean default false,
  created_at timestamptz default now()
);

-- Resources
create table public.resources (
  id serial primary key,
  title_ar text not null,
  title_fr text not null,
  title_darija text,
  content_ar text not null,
  content_fr text not null,
  content_darija text,
  category varchar(50) not null,
  image_url varchar,
  read_time_minutes integer default 5,
  created_at timestamptz default now()
);

-- Payment transactions (MVP)
create table public.payment_transactions (
  id serial primary key,
  client_id uuid not null references public.profiles(id) on delete cascade,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id integer references public.appointments(id) on delete set null,
  amount_dinar real not null,
  payment_method varchar(20) not null,
  status varchar(20) not null default 'pending',
  external_ref varchar,
  created_at timestamptz default now()
);

-- FCM tokens for push notifications (MVP)
create table public.fcm_tokens (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  device_type varchar(20),
  created_at timestamptz default now()
);

-- Crisis reports (MVP)
create table public.crisis_reports (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  severity varchar(20) not null default 'medium',
  auto_detected boolean default false,
  responder_id uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- Onboarding responses (MVP)
create table public.onboarding_responses (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary_concerns text[],
  preferred_language varchar(10),
  gender_preference varchar(10),
  budget_range varchar(20),
  completed_at timestamptz default now()
);

-- Indexes
create index idx_therapist_profiles_user_id on public.therapist_profiles(user_id);
create index idx_therapist_profiles_slug on public.therapist_profiles(slug);
create index idx_therapy_conversations_client on public.therapy_conversations(client_id);
create index idx_therapy_conversations_therapist on public.therapy_conversations(therapist_id);
create index idx_therapy_messages_conversation on public.therapy_messages(conversation_id);
create index idx_therapy_messages_sender on public.therapy_messages(sender_id);
create index idx_appointments_client on public.appointments(client_id);
create index idx_appointments_therapist on public.appointments(therapist_id);
create index idx_mood_entries_user on public.mood_entries(user_id);
create index idx_journal_entries_user on public.journal_entries(user_id);
create index idx_therapist_reviews_therapist on public.therapist_reviews(therapist_id);
create index idx_payment_transactions_client on public.payment_transactions(client_id);
create index idx_fcm_tokens_user on public.fcm_tokens(user_id);
create index idx_crisis_reports_user on public.crisis_reports(user_id);

-- Auto-create profile trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Enable realtime for key tables
alter publication supabase_realtime add table public.therapy_messages;
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.therapy_conversations;
