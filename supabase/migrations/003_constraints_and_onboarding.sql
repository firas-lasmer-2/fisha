-- Shifa: Constraints and onboarding enhancements

-- Ensure one conversation per client/therapist pair.
create unique index if not exists idx_therapy_conversations_unique_pair
  on public.therapy_conversations(client_id, therapist_id);

-- Improve hot-path query performance.
create index if not exists idx_therapy_messages_conversation_created_at
  on public.therapy_messages(conversation_id, created_at desc);

create index if not exists idx_appointments_user_schedule
  on public.appointments(client_id, scheduled_at desc);

create index if not exists idx_appointments_therapist_schedule
  on public.appointments(therapist_id, scheduled_at desc);

create index if not exists idx_onboarding_responses_user
  on public.onboarding_responses(user_id);

create unique index if not exists idx_onboarding_responses_user_unique
  on public.onboarding_responses(user_id);

-- Extend onboarding responses with acquisition analytics.
alter table public.onboarding_responses
  add column if not exists how_did_you_hear varchar(100);
