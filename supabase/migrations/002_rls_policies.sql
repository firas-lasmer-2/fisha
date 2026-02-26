-- Shifa: Row Level Security Policies

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.therapist_profiles enable row level security;
alter table public.therapist_reviews enable row level security;
alter table public.therapy_conversations enable row level security;
alter table public.therapy_messages enable row level security;
alter table public.appointments enable row level security;
alter table public.mood_entries enable row level security;
alter table public.journal_entries enable row level security;
alter table public.resources enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.fcm_tokens enable row level security;
alter table public.crisis_reports enable row level security;
alter table public.onboarding_responses enable row level security;

-- PROFILES
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- THERAPIST PROFILES
create policy "Therapist profiles are viewable by everyone"
  on public.therapist_profiles for select using (true);

create policy "Therapists can insert their own profile"
  on public.therapist_profiles for insert with check (auth.uid() = user_id);

create policy "Therapists can update their own profile"
  on public.therapist_profiles for update using (auth.uid() = user_id);

-- THERAPIST REVIEWS
create policy "Reviews are viewable by everyone"
  on public.therapist_reviews for select using (true);

create policy "Authenticated clients can create reviews"
  on public.therapist_reviews for insert with check (auth.uid() = client_id);

create policy "Therapists can update their response only"
  on public.therapist_reviews for update using (auth.uid() = therapist_id);

-- THERAPY CONVERSATIONS
create policy "Users can view their own conversations"
  on public.therapy_conversations for select
  using (auth.uid() = client_id or auth.uid() = therapist_id);

create policy "Authenticated users can create conversations"
  on public.therapy_conversations for insert
  with check (auth.uid() = client_id);

-- THERAPY MESSAGES
create policy "Users can view messages in their conversations"
  on public.therapy_messages for select
  using (
    exists (
      select 1 from public.therapy_conversations tc
      where tc.id = therapy_messages.conversation_id
      and (tc.client_id = auth.uid() or tc.therapist_id = auth.uid())
    )
  );

create policy "Users can send messages in their conversations"
  on public.therapy_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.therapy_conversations tc
      where tc.id = conversation_id
      and (tc.client_id = auth.uid() or tc.therapist_id = auth.uid())
    )
  );

create policy "Users can update read status of messages sent to them"
  on public.therapy_messages for update
  using (
    sender_id != auth.uid()
    and exists (
      select 1 from public.therapy_conversations tc
      where tc.id = therapy_messages.conversation_id
      and (tc.client_id = auth.uid() or tc.therapist_id = auth.uid())
    )
  );

-- APPOINTMENTS
create policy "Users can view their own appointments"
  on public.appointments for select
  using (auth.uid() = client_id or auth.uid() = therapist_id);

create policy "Authenticated users can create appointments"
  on public.appointments for insert
  with check (auth.uid() = client_id);

create policy "Participants can update appointments"
  on public.appointments for update
  using (auth.uid() = client_id or auth.uid() = therapist_id);

-- MOOD ENTRIES
create policy "Users can view their own mood entries"
  on public.mood_entries for select using (auth.uid() = user_id);

create policy "Users can create their own mood entries"
  on public.mood_entries for insert with check (auth.uid() = user_id);

create policy "Users can delete their own mood entries"
  on public.mood_entries for delete using (auth.uid() = user_id);

-- JOURNAL ENTRIES
create policy "Users can view their own journal entries"
  on public.journal_entries for select using (auth.uid() = user_id);

create policy "Users can create their own journal entries"
  on public.journal_entries for insert with check (auth.uid() = user_id);

create policy "Users can update their own journal entries"
  on public.journal_entries for update using (auth.uid() = user_id);

create policy "Users can delete their own journal entries"
  on public.journal_entries for delete using (auth.uid() = user_id);

-- RESOURCES (public read, service role write)
create policy "Resources are viewable by everyone"
  on public.resources for select using (true);

-- PAYMENT TRANSACTIONS
create policy "Users can view their own payment transactions"
  on public.payment_transactions for select
  using (auth.uid() = client_id or auth.uid() = therapist_id);

-- FCM TOKENS
create policy "Users can manage their own FCM tokens"
  on public.fcm_tokens for select using (auth.uid() = user_id);

create policy "Users can insert their own FCM tokens"
  on public.fcm_tokens for insert with check (auth.uid() = user_id);

create policy "Users can delete their own FCM tokens"
  on public.fcm_tokens for delete using (auth.uid() = user_id);

-- CRISIS REPORTS
create policy "Users can view their own crisis reports"
  on public.crisis_reports for select
  using (auth.uid() = user_id or auth.uid() = responder_id);

create policy "Authenticated users can create crisis reports"
  on public.crisis_reports for insert
  with check (auth.uid() = user_id);

create policy "Responders can update crisis reports"
  on public.crisis_reports for update
  using (auth.uid() = responder_id);

-- ONBOARDING RESPONSES
create policy "Users can view their own onboarding responses"
  on public.onboarding_responses for select using (auth.uid() = user_id);

create policy "Users can create their own onboarding responses"
  on public.onboarding_responses for insert with check (auth.uid() = user_id);
