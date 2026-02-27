-- ============================================================
-- Shifa: Full Reset + Rebuild
-- Paste this into the Supabase SQL Editor and run it.
-- Drops all app tables/functions/triggers, then re-applies
-- all 23 migrations in order.
-- ============================================================

-- ─────────────────────────────────────────────
-- STEP 0 — Drop everything in safe reverse order
-- ─────────────────────────────────────────────

-- Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS set_payment_updated_at ON public.payment_transactions;
DROP TRIGGER IF EXISTS set_updated_at_listener_profiles ON public.listener_profiles;
DROP TRIGGER IF EXISTS set_updated_at_listener_applications ON public.listener_applications;
DROP TRIGGER IF EXISTS set_updated_at_listener_queue ON public.listener_queue;
-- (subscriptions/entitlements triggers dropped via CASCADE when tables are dropped below)
DROP TRIGGER IF EXISTS trg_enforce_student_therapist_rate_cap ON public.therapist_profiles;
DROP TRIGGER IF EXISTS trg_enforce_therapist_slot_rules ON public.therapist_slots;
DROP TRIGGER IF EXISTS set_updated_at_therapist_slots ON public.therapist_slots;

-- Tables (reverse FK order)
DROP TABLE IF EXISTS public.tier_upgrade_requests CASCADE;
DROP TABLE IF EXISTS public.consultation_prep CASCADE;
DROP TABLE IF EXISTS public.session_mood_ratings CASCADE;
DROP TABLE IF EXISTS public.session_homework CASCADE;
DROP TABLE IF EXISTS public.doctor_payouts CASCADE;
DROP TABLE IF EXISTS public.therapist_google_tokens CASCADE;
DROP TABLE IF EXISTS public.listener_qualification_tests CASCADE;
DROP TABLE IF EXISTS public.session_summaries CASCADE;
DROP TABLE IF EXISTS public.treatment_goals CASCADE;
DROP TABLE IF EXISTS public.content_flags CASCADE;
DROP TABLE IF EXISTS public.user_key_backups CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.therapist_verifications CASCADE;
DROP TABLE IF EXISTS public.listener_points_ledger CASCADE;
DROP TABLE IF EXISTS public.listener_progress CASCADE;
DROP TABLE IF EXISTS public.therapist_slots CASCADE;
DROP TABLE IF EXISTS public.app_config CASCADE;
DROP TABLE IF EXISTS public.entitlements CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.peer_session_feedback CASCADE;
DROP TABLE IF EXISTS public.peer_reports CASCADE;
DROP TABLE IF EXISTS public.peer_messages CASCADE;
DROP TABLE IF EXISTS public.peer_sessions CASCADE;
DROP TABLE IF EXISTS public.listener_queue CASCADE;
DROP TABLE IF EXISTS public.listener_applications CASCADE;
DROP TABLE IF EXISTS public.listener_profiles CASCADE;
DROP TABLE IF EXISTS public.fcm_tokens CASCADE;
DROP TABLE IF EXISTS public.crisis_reports CASCADE;
DROP TABLE IF EXISTS public.onboarding_responses CASCADE;
DROP TABLE IF EXISTS public.payment_transactions CASCADE;
DROP TABLE IF EXISTS public.mood_entries CASCADE;
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.therapist_reviews CASCADE;
DROP TABLE IF EXISTS public.therapy_messages CASCADE;
DROP TABLE IF EXISTS public.therapy_conversations CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.therapist_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.handle_payment_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_therapist_cap_dinar() CASCADE;
DROP FUNCTION IF EXISTS public.get_graduated_doctor_cap_dinar() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_student_therapist_rate_cap() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_therapist_slot_rules() CASCADE;

-- ─────────────────────────────────────────────
-- MIGRATION 001 — Initial Schema
-- ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email varchar UNIQUE,
  first_name varchar,
  last_name varchar,
  profile_image_url varchar,
  role varchar(20) NOT NULL DEFAULT 'client',
  phone varchar,
  language_preference varchar(10) DEFAULT 'ar',
  governorate varchar,
  bio text,
  is_anonymous boolean DEFAULT false,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.therapist_profiles (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_number varchar,
  specializations text[],
  languages text[],
  rate_dinar real DEFAULT 80,
  verified boolean DEFAULT false,
  rating real DEFAULT 0,
  review_count integer DEFAULT 0,
  years_experience integer DEFAULT 0,
  education text,
  approach text,
  available_days text[],
  available_hours_start varchar(5) DEFAULT '09:00',
  available_hours_end varchar(5) DEFAULT '17:00',
  accepts_online boolean DEFAULT true,
  accepts_in_person boolean DEFAULT false,
  office_address text,
  gender varchar(10),
  headline text,
  about_me text,
  video_intro_url varchar,
  office_photos text[],
  faq_items jsonb,
  social_links jsonb,
  slug varchar UNIQUE,
  profile_theme_color varchar(20),
  accepting_new_clients boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.therapist_reviews (
  id serial PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id integer,
  overall_rating integer NOT NULL,
  helpfulness_rating integer,
  communication_rating integer,
  comment text,
  therapist_response text,
  is_anonymous boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.therapy_conversations (
  id serial PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'active',
  encryption_key text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.therapy_messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES public.therapy_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type varchar(20) NOT NULL DEFAULT 'text',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.appointments (
  id serial PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 50,
  session_type varchar(20) NOT NULL DEFAULT 'chat',
  status varchar(20) NOT NULL DEFAULT 'pending',
  notes text,
  price_dinar real,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.therapist_reviews
  ADD CONSTRAINT fk_review_appointment
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE TABLE public.mood_entries (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mood_score integer NOT NULL,
  emotions text[],
  notes text,
  triggers text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.journal_entries (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title varchar,
  content text NOT NULL,
  prompt_id integer,
  mood varchar(20),
  is_shared_with_therapist boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.resources (
  id serial PRIMARY KEY,
  title_ar text NOT NULL,
  title_fr text NOT NULL,
  title_darija text,
  content_ar text NOT NULL,
  content_fr text NOT NULL,
  content_darija text,
  category varchar(50) NOT NULL,
  image_url varchar,
  read_time_minutes integer DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.payment_transactions (
  id serial PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id integer REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount_dinar real NOT NULL,
  payment_method varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  external_ref varchar,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.fcm_tokens (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_type varchar(20),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.crisis_reports (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  severity varchar(20) NOT NULL DEFAULT 'medium',
  auto_detected boolean DEFAULT false,
  responder_id uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.onboarding_responses (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  primary_concerns text[],
  preferred_language varchar(10),
  gender_preference varchar(10),
  budget_range varchar(20),
  completed_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_therapist_profiles_user_id ON public.therapist_profiles(user_id);
CREATE INDEX idx_therapist_profiles_slug ON public.therapist_profiles(slug);
CREATE INDEX idx_therapy_conversations_client ON public.therapy_conversations(client_id);
CREATE INDEX idx_therapy_conversations_therapist ON public.therapy_conversations(therapist_id);
CREATE INDEX idx_therapy_messages_conversation ON public.therapy_messages(conversation_id);
CREATE INDEX idx_therapy_messages_sender ON public.therapy_messages(sender_id);
CREATE INDEX idx_appointments_client ON public.appointments(client_id);
CREATE INDEX idx_appointments_therapist ON public.appointments(therapist_id);
CREATE INDEX idx_mood_entries_user ON public.mood_entries(user_id);
CREATE INDEX idx_journal_entries_user ON public.journal_entries(user_id);
CREATE INDEX idx_therapist_reviews_therapist ON public.therapist_reviews(therapist_id);
CREATE INDEX idx_payment_transactions_client ON public.payment_transactions(client_id);
CREATE INDEX idx_fcm_tokens_user ON public.fcm_tokens(user_id);
CREATE INDEX idx_crisis_reports_user ON public.crisis_reports(user_id);

-- Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, onboarding_completed)
  VALUES (new.id, new.email, 'client', false)
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email,
        updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.therapy_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.therapy_conversations;

-- ─────────────────────────────────────────────
-- MIGRATION 002 — RLS Policies
-- ─────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- THERAPIST PROFILES
CREATE POLICY "Therapist profiles are viewable by everyone" ON public.therapist_profiles FOR SELECT USING (true);
CREATE POLICY "Therapists can insert their own profile" ON public.therapist_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Therapists can update their own profile" ON public.therapist_profiles FOR UPDATE USING (auth.uid() = user_id);

-- THERAPIST REVIEWS
CREATE POLICY "Reviews are viewable by everyone" ON public.therapist_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated clients can create reviews" ON public.therapist_reviews FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Therapists can update their response only" ON public.therapist_reviews FOR UPDATE USING (auth.uid() = therapist_id);

-- THERAPY CONVERSATIONS
CREATE POLICY "Users can view their own conversations" ON public.therapy_conversations FOR SELECT USING (auth.uid() = client_id OR auth.uid() = therapist_id);
CREATE POLICY "Authenticated users can create conversations" ON public.therapy_conversations FOR INSERT WITH CHECK (auth.uid() = client_id);

-- THERAPY MESSAGES
CREATE POLICY "Users can view messages in their conversations" ON public.therapy_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.therapy_conversations tc WHERE tc.id = therapy_messages.conversation_id AND (tc.client_id = auth.uid() OR tc.therapist_id = auth.uid()))
);
CREATE POLICY "Users can send messages in their conversations" ON public.therapy_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.therapy_conversations tc WHERE tc.id = conversation_id AND (tc.client_id = auth.uid() OR tc.therapist_id = auth.uid()))
);
CREATE POLICY "Users can update read status of messages sent to them" ON public.therapy_messages FOR UPDATE USING (
  sender_id != auth.uid() AND EXISTS (SELECT 1 FROM public.therapy_conversations tc WHERE tc.id = therapy_messages.conversation_id AND (tc.client_id = auth.uid() OR tc.therapist_id = auth.uid()))
);

-- APPOINTMENTS
CREATE POLICY "Users can view their own appointments" ON public.appointments FOR SELECT USING (auth.uid() = client_id OR auth.uid() = therapist_id);
CREATE POLICY "Authenticated users can create appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Participants can update appointments" ON public.appointments FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = therapist_id);

-- MOOD ENTRIES
CREATE POLICY "Users can view their own mood entries" ON public.mood_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own mood entries" ON public.mood_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own mood entries" ON public.mood_entries FOR DELETE USING (auth.uid() = user_id);

-- JOURNAL ENTRIES
CREATE POLICY "Users can view their own journal entries" ON public.journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own journal entries" ON public.journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own journal entries" ON public.journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own journal entries" ON public.journal_entries FOR DELETE USING (auth.uid() = user_id);

-- RESOURCES
CREATE POLICY "Resources are viewable by everyone" ON public.resources FOR SELECT USING (true);

-- PAYMENT TRANSACTIONS
CREATE POLICY "Users can view their own payment transactions" ON public.payment_transactions FOR SELECT USING (auth.uid() = client_id OR auth.uid() = therapist_id);

-- FCM TOKENS
CREATE POLICY "Users can manage their own FCM tokens" ON public.fcm_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own FCM tokens" ON public.fcm_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own FCM tokens" ON public.fcm_tokens FOR DELETE USING (auth.uid() = user_id);

-- CRISIS REPORTS
CREATE POLICY "Users can view their own crisis reports" ON public.crisis_reports FOR SELECT USING (auth.uid() = user_id OR auth.uid() = responder_id);
CREATE POLICY "Authenticated users can create crisis reports" ON public.crisis_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Responders can update crisis reports" ON public.crisis_reports FOR UPDATE USING (auth.uid() = responder_id);

-- ONBOARDING RESPONSES
CREATE POLICY "Users can view their own onboarding responses" ON public.onboarding_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own onboarding responses" ON public.onboarding_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- MIGRATION 003 — Constraints & Onboarding
-- ─────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_therapy_conversations_unique_pair ON public.therapy_conversations(client_id, therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapy_messages_conversation_created_at ON public.therapy_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_user_schedule ON public.appointments(client_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_schedule ON public.appointments(therapist_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_user ON public.onboarding_responses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_responses_user_unique ON public.onboarding_responses(user_id);

ALTER TABLE public.onboarding_responses
  ADD COLUMN IF NOT EXISTS how_did_you_hear varchar(100);

-- ─────────────────────────────────────────────
-- MIGRATION 004 — E2E Keys
-- ─────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_key text;

ALTER TABLE public.therapy_conversations
  ADD COLUMN IF NOT EXISTS client_key_encrypted text,
  ADD COLUMN IF NOT EXISTS therapist_key_encrypted text,
  ADD COLUMN IF NOT EXISTS key_version integer DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_therapy_conversations_key_version ON public.therapy_conversations(key_version);

-- ─────────────────────────────────────────────
-- MIGRATION 005 — Payment Webhook Hardening
-- ─────────────────────────────────────────────

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS provider_event_id varchar(120),
  ADD COLUMN IF NOT EXISTS provider_name varchar(32),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_event
  ON public.payment_transactions(provider_name, provider_event_id)
  WHERE provider_event_id IS NOT NULL AND provider_name IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_payment_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_payment_updated_at ON public.payment_transactions;
CREATE TRIGGER set_payment_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_updated_at();

-- ─────────────────────────────────────────────
-- MIGRATION 006 — Hybrid Peer Support Schema
-- ─────────────────────────────────────────────

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client', 'therapist', 'listener', 'moderator', 'admin'));

CREATE TABLE IF NOT EXISTS public.listener_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_alias varchar(80),
  languages text[],
  topics text[],
  timezone varchar(50),
  verification_status varchar(20) NOT NULL DEFAULT 'pending',
  activation_status varchar(20) NOT NULL DEFAULT 'inactive',
  training_completed_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  is_available boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listener_applications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  motivation text,
  relevant_experience text,
  languages text[],
  topics text[],
  weekly_hours integer,
  status varchar(20) NOT NULL DEFAULT 'pending',
  moderation_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listener_queue (
  id serial PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_language varchar(10),
  topic_tags text[],
  status varchar(20) NOT NULL DEFAULT 'waiting',
  matched_listener_id uuid REFERENCES public.profiles(id),
  session_id integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.peer_sessions (
  id serial PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listener_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  queue_entry_id integer REFERENCES public.listener_queue(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  anonymous_alias_client varchar(50),
  anonymous_alias_listener varchar(50),
  escalated_to_crisis boolean DEFAULT false,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.listener_queue
  ADD CONSTRAINT fk_listener_queue_session
  FOREIGN KEY (session_id) REFERENCES public.peer_sessions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.peer_messages (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES public.peer_sessions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  encrypted boolean DEFAULT false,
  is_flagged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.peer_session_feedback (
  id serial PRIMARY KEY,
  session_id integer NOT NULL UNIQUE REFERENCES public.peer_sessions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listener_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  tags text[],
  comment text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.peer_reports (
  id serial PRIMARY KEY,
  session_id integer REFERENCES public.peer_sessions(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason varchar(120) NOT NULL,
  details text,
  severity varchar(20) NOT NULL DEFAULT 'medium',
  moderation_status varchar(20) NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listener_profiles_status ON public.listener_profiles(verification_status, activation_status);
CREATE INDEX IF NOT EXISTS idx_listener_applications_status ON public.listener_applications(status);
CREATE INDEX IF NOT EXISTS idx_listener_queue_status ON public.listener_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_status ON public.peer_sessions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_peer_messages_session ON public.peer_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_peer_reports_status ON public.peer_reports(moderation_status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_queue_active_by_client
  ON public.listener_queue(client_id)
  WHERE status IN ('waiting', 'matched');

-- Triggers
DROP TRIGGER IF EXISTS set_updated_at_listener_profiles ON public.listener_profiles;
CREATE TRIGGER set_updated_at_listener_profiles BEFORE UPDATE ON public.listener_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_listener_applications ON public.listener_applications;
CREATE TRIGGER set_updated_at_listener_applications BEFORE UPDATE ON public.listener_applications FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_listener_queue ON public.listener_queue;
CREATE TRIGGER set_updated_at_listener_queue BEFORE UPDATE ON public.listener_queue FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listener_queue;

-- ─────────────────────────────────────────────
-- MIGRATION 007 — Hybrid Peer Support RLS
-- ─────────────────────────────────────────────

ALTER TABLE public.listener_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_session_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listener profiles are viewable by everyone" ON public.listener_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create own listener profile" ON public.listener_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own listener profile" ON public.listener_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Moderators can manage listener profiles" ON public.listener_profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

CREATE POLICY "Users can view own listener applications" ON public.listener_applications FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);
CREATE POLICY "Users can submit own listener application" ON public.listener_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Moderators can review listener applications" ON public.listener_applications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

CREATE POLICY "Clients can view own queue entries" ON public.listener_queue FOR SELECT USING (
  auth.uid() = client_id OR auth.uid() = matched_listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);
CREATE POLICY "Clients can join queue" ON public.listener_queue FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can leave own queue" ON public.listener_queue FOR DELETE USING (auth.uid() = client_id);
CREATE POLICY "Matched listener or moderators can update queue entries" ON public.listener_queue FOR UPDATE USING (
  auth.uid() = matched_listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

CREATE POLICY "Participants can view peer sessions" ON public.peer_sessions FOR SELECT USING (
  auth.uid() = client_id OR auth.uid() = listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);
CREATE POLICY "Participants can create peer sessions" ON public.peer_sessions FOR INSERT WITH CHECK (auth.uid() = client_id OR auth.uid() = listener_id);
CREATE POLICY "Participants can update peer sessions" ON public.peer_sessions FOR UPDATE USING (
  auth.uid() = client_id OR auth.uid() = listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

CREATE POLICY "Participants can view peer messages" ON public.peer_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.peer_sessions s WHERE s.id = peer_messages.session_id AND (s.client_id = auth.uid() OR s.listener_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);
CREATE POLICY "Participants can send peer messages" ON public.peer_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.peer_sessions s WHERE s.id = session_id AND (s.client_id = auth.uid() OR s.listener_id = auth.uid()))
);

CREATE POLICY "Clients can view own feedback" ON public.peer_session_feedback FOR SELECT USING (
  auth.uid() = client_id OR auth.uid() = listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);
CREATE POLICY "Clients can submit own feedback" ON public.peer_session_feedback FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Reporter and moderators can view reports" ON public.peer_reports FOR SELECT USING (
  auth.uid() = reporter_id OR auth.uid() = target_user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);
CREATE POLICY "Users can submit reports" ON public.peer_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Moderators can update reports" ON public.peer_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

-- ─────────────────────────────────────────────
-- MIGRATION 008 — Marketplace Tiers, Slots, Listener Progression
-- ─────────────────────────────────────────────

ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS tier varchar(20) NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS tier_approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS tier_approved_at timestamptz;

ALTER TABLE public.therapist_profiles DROP CONSTRAINT IF EXISTS therapist_profiles_tier_check;
ALTER TABLE public.therapist_profiles ADD CONSTRAINT therapist_profiles_tier_check CHECK (tier IN ('student', 'professional'));

UPDATE public.therapist_profiles SET tier = 'professional' WHERE tier IS NULL;

CREATE TABLE IF NOT EXISTS public.app_config (
  key varchar(80) PRIMARY KEY,
  value_text text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.app_config (key, value_text) VALUES ('student_therapist_cap_dinar', '20') ON CONFLICT (key) DO UPDATE SET value_text = excluded.value_text, updated_at = now();

CREATE OR REPLACE FUNCTION public.get_student_therapist_cap_dinar()
RETURNS real LANGUAGE plpgsql AS $$
DECLARE cap_text text; cap_value real;
BEGIN
  SELECT value_text INTO cap_text FROM public.app_config WHERE key = 'student_therapist_cap_dinar';
  IF cap_text IS NULL THEN RETURN 20; END IF;
  cap_value := cap_text::real;
  IF cap_value <= 0 THEN RETURN 20; END IF;
  RETURN cap_value;
EXCEPTION WHEN OTHERS THEN RETURN 20;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_student_therapist_rate_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cap_value real;
BEGIN
  cap_value := public.get_student_therapist_cap_dinar();
  IF new.tier = 'student' AND new.rate_dinar IS NOT NULL AND new.rate_dinar > cap_value THEN
    RAISE EXCEPTION 'Student therapist rate exceeds cap (max % TND)', cap_value;
  END IF;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_student_therapist_rate_cap ON public.therapist_profiles;
CREATE TRIGGER trg_enforce_student_therapist_rate_cap BEFORE INSERT OR UPDATE ON public.therapist_profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_student_therapist_rate_cap();

CREATE TABLE IF NOT EXISTS public.therapist_slots (
  id serial PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price_dinar real NOT NULL CHECK (price_dinar >= 0),
  status varchar(20) NOT NULL DEFAULT 'open',
  appointment_id integer UNIQUE REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.therapist_slots DROP CONSTRAINT IF EXISTS therapist_slots_status_check;
ALTER TABLE public.therapist_slots ADD CONSTRAINT therapist_slots_status_check CHECK (status IN ('open', 'booked', 'cancelled', 'closed'));

CREATE INDEX IF NOT EXISTS idx_therapist_slots_therapist_starts ON public.therapist_slots(therapist_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_therapist_slots_status ON public.therapist_slots(status, starts_at);

CREATE OR REPLACE FUNCTION public.enforce_therapist_slot_rules()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE therapist_tier varchar(20); cap_value real;
BEGIN
  SELECT tier INTO therapist_tier FROM public.therapist_profiles WHERE user_id = new.therapist_id;
  cap_value := public.get_student_therapist_cap_dinar();
  IF therapist_tier = 'student' AND new.price_dinar > cap_value THEN
    RAISE EXCEPTION 'Student therapist slot price exceeds cap (max % TND)', cap_value;
  END IF;
  IF new.status IN ('open', 'booked') THEN
    IF EXISTS (
      SELECT 1 FROM public.therapist_slots s
      WHERE s.therapist_id = new.therapist_id AND s.id <> COALESCE(new.id, -1) AND s.status IN ('open', 'booked')
        AND tstzrange(s.starts_at, s.starts_at + make_interval(mins => s.duration_minutes), '[)')
            && tstzrange(new.starts_at, new.starts_at + make_interval(mins => new.duration_minutes), '[)')
    ) THEN RAISE EXCEPTION 'Therapist slot overlaps with an existing open/booked slot'; END IF;
  END IF;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_therapist_slot_rules ON public.therapist_slots;
CREATE TRIGGER trg_enforce_therapist_slot_rules BEFORE INSERT OR UPDATE ON public.therapist_slots FOR EACH ROW EXECUTE FUNCTION public.enforce_therapist_slot_rules();

DROP TRIGGER IF EXISTS set_updated_at_therapist_slots ON public.therapist_slots;
CREATE TRIGGER set_updated_at_therapist_slots BEFORE UPDATE ON public.therapist_slots FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.listener_progress (
  listener_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  sessions_rated_count integer NOT NULL DEFAULT 0,
  last_calculated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listener_points_ledger (
  id serial PRIMARY KEY,
  listener_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id integer REFERENCES public.peer_sessions(id) ON DELETE SET NULL,
  event_type varchar(40) NOT NULL,
  delta integer NOT NULL,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listener_progress_points ON public.listener_progress(points DESC);
CREATE INDEX IF NOT EXISTS idx_listener_points_ledger_listener_created ON public.listener_points_ledger(listener_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_points_award_once ON public.listener_points_ledger(listener_id, session_id, event_type) WHERE event_type IN ('session_base', 'rating_bonus');

ALTER TABLE public.peer_reports ADD COLUMN IF NOT EXISTS penalty_applied boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- MIGRATION 009 — Marketplace RLS Updates
-- ─────────────────────────────────────────────

ALTER TABLE public.therapist_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapist slots are publicly viewable" ON public.therapist_slots;
CREATE POLICY "Therapist slots are publicly viewable" ON public.therapist_slots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Therapists can create own slots" ON public.therapist_slots;
CREATE POLICY "Therapists can create own slots" ON public.therapist_slots FOR INSERT WITH CHECK (
  auth.uid() = therapist_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

DROP POLICY IF EXISTS "Therapists can update own slots" ON public.therapist_slots;
CREATE POLICY "Therapists can update own slots" ON public.therapist_slots FOR UPDATE USING (
  auth.uid() = therapist_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

DROP POLICY IF EXISTS "Therapists can delete own slots" ON public.therapist_slots;
CREATE POLICY "Therapists can delete own slots" ON public.therapist_slots FOR DELETE USING (
  auth.uid() = therapist_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

DROP POLICY IF EXISTS "Listeners can view own progress" ON public.listener_progress;
CREATE POLICY "Listeners can view own progress" ON public.listener_progress FOR SELECT USING (
  auth.uid() = listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

DROP POLICY IF EXISTS "Listeners can upsert own progress" ON public.listener_progress;
CREATE POLICY "Listeners can upsert own progress" ON public.listener_progress FOR INSERT WITH CHECK (
  auth.uid() = listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

DROP POLICY IF EXISTS "Listeners can update own progress" ON public.listener_progress;
CREATE POLICY "Listeners can update own progress" ON public.listener_progress FOR UPDATE USING (
  auth.uid() = listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

DROP POLICY IF EXISTS "Participants can view listener ledger" ON public.listener_points_ledger;
CREATE POLICY "Participants can view listener ledger" ON public.listener_points_ledger FOR SELECT USING (
  auth.uid() = listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

DROP POLICY IF EXISTS "Listeners can insert own ledger entries" ON public.listener_points_ledger;
CREATE POLICY "Listeners can insert own ledger entries" ON public.listener_points_ledger FOR INSERT WITH CHECK (
  auth.uid() = listener_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'therapist_slots') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.therapist_slots;
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- MIGRATION 010 — Profile Integrity Guardrails
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, onboarding_completed)
  VALUES (new.id, new.email, 'client', false)
  ON CONFLICT (id) DO UPDATE SET email = excluded.email, updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

UPDATE public.profiles SET role = 'client' WHERE role IS NULL OR role = '';

-- ─────────────────────────────────────────────
-- MIGRATION 011 — Listener Progression Guardrails
-- ─────────────────────────────────────────────

DROP INDEX IF EXISTS idx_listener_points_award_once;
CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_points_award_once
  ON public.listener_points_ledger(listener_id, session_id, event_type)
  WHERE event_type IN ('session_base', 'rating_bonus', 'low_rating_penalty', 'detailed_feedback_bonus', 'streak_bonus');

CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_report_penalty_once
  ON public.listener_points_ledger(listener_id, ((meta->>'reportId')))
  WHERE event_type = 'report_penalty' AND (meta ? 'reportId');

CREATE INDEX IF NOT EXISTS idx_peer_session_feedback_listener_created
  ON public.peer_session_feedback(listener_id, created_at DESC);

-- ─────────────────────────────────────────────
-- MIGRATION 012 — Anonymous Display Names
-- ─────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name varchar(30) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name) WHERE display_name IS NOT NULL;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_format CHECK (
  display_name IS NULL OR (LENGTH(display_name) >= 3 AND LENGTH(display_name) <= 30 AND display_name ~ '^[a-zA-Z0-9\u0600-\u06FF_]+$')
);

ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS landing_page_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_page_sections jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS landing_page_cta_text varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS landing_page_cta_url varchar(255) NULL;

-- ─────────────────────────────────────────────
-- MIGRATION 013 — Verification & Analytics
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.therapist_verifications (
  id serial PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type varchar(20) NOT NULL CHECK (document_type IN ('license', 'diploma', 'id_card', 'cv')),
  document_url text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(therapist_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_therapist_verif_therapist ON public.therapist_verifications(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_verif_status ON public.therapist_verifications(status);

ALTER TABLE public.therapist_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_verif_select_own" ON public.therapist_verifications FOR SELECT USING (therapist_id = auth.uid());
CREATE POLICY "therapist_verif_insert_own" ON public.therapist_verifications FOR INSERT WITH CHECK (therapist_id = auth.uid());
CREATE POLICY "therapist_verif_select_admin" ON public.therapist_verifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);
CREATE POLICY "therapist_verif_update_admin" ON public.therapist_verifications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
);

-- ─────────────────────────────────────────────
-- MIGRATION 014 — Audit Log
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  resource_type varchar(50) NOT NULL,
  resource_id text,
  metadata jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin" ON public.audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator'))
);

-- ─────────────────────────────────────────────
-- MIGRATION 015 — User Key Backups
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_key_backups (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wrapped_private_key text NOT NULL,
  salt text NOT NULL,
  iterations integer NOT NULL DEFAULT 200000,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_key_backups_user ON public.user_key_backups(user_id);
ALTER TABLE public.user_key_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "key_backup_select_own" ON public.user_key_backups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "key_backup_insert_own" ON public.user_key_backups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "key_backup_update_own" ON public.user_key_backups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "key_backup_delete_own" ON public.user_key_backups FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- MIGRATION 016 — Appointment Meet Link
-- ─────────────────────────────────────────────

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS meet_link text;
ALTER TABLE public.therapist_slots ADD COLUMN IF NOT EXISTS meet_link text;

-- ─────────────────────────────────────────────
-- MIGRATION 017 — Content Moderation
-- ─────────────────────────────────────────────

ALTER TABLE public.therapy_messages
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text;

ALTER TABLE public.peer_messages
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text;

CREATE TABLE IF NOT EXISTS public.content_flags (
  id bigserial PRIMARY KEY,
  message_type varchar(30) NOT NULL CHECK (message_type IN ('therapy_message', 'peer_message')),
  message_id bigint NOT NULL,
  flag_reason varchar(100) NOT NULL,
  flagged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  severity varchar(20) NOT NULL DEFAULT 'medium',
  status varchar(20) NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_flags_status ON public.content_flags(status);
CREATE INDEX IF NOT EXISTS idx_content_flags_message ON public.content_flags(message_type, message_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_created ON public.content_flags(created_at DESC);

ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_flags_select_admin" ON public.content_flags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator'))
);

-- ─────────────────────────────────────────────
-- MIGRATION 018 — Progress Tracking
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.treatment_goals (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_date date,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  progress_pct integer NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_summaries (
  id serial PRIMARY KEY,
  appointment_id integer NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.profiles(id),
  client_id uuid NOT NULL REFERENCES public.profiles(id),
  key_topics text[],
  homework text,
  therapist_notes text,
  client_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.treatment_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON public.treatment_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapist can write session summaries" ON public.session_summaries FOR ALL USING (auth.uid() = therapist_id) WITH CHECK (auth.uid() = therapist_id);
CREATE POLICY "Client can read visible session summaries" ON public.session_summaries FOR SELECT USING (auth.uid() = client_id AND client_visible = true);

CREATE INDEX IF NOT EXISTS idx_treatment_goals_user ON public.treatment_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_appointment ON public.session_summaries(appointment_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_client ON public.session_summaries(client_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_therapist ON public.session_summaries(therapist_id);

-- ─────────────────────────────────────────────
-- MIGRATION 019 — Tier Rename
-- ─────────────────────────────────────────────

ALTER TABLE public.therapist_profiles DROP CONSTRAINT IF EXISTS therapist_profiles_tier_check;

UPDATE public.therapist_profiles SET tier = 'graduated_doctor' WHERE tier = 'student';
UPDATE public.therapist_profiles SET tier = 'premium_doctor'   WHERE tier = 'professional';

ALTER TABLE public.therapist_profiles ALTER COLUMN tier SET DEFAULT 'premium_doctor';
ALTER TABLE public.therapist_profiles ADD CONSTRAINT therapist_profiles_tier_check CHECK (tier IN ('graduated_doctor', 'premium_doctor'));

ALTER TABLE public.therapist_profiles ADD COLUMN IF NOT EXISTS badge_type varchar(30) CHECK (badge_type IN ('verified', 'premium'));

UPDATE public.therapist_profiles SET badge_type = 'verified' WHERE tier = 'graduated_doctor';
UPDATE public.therapist_profiles SET badge_type = 'premium'  WHERE tier = 'premium_doctor';

INSERT INTO public.app_config (key, value_text) VALUES ('graduated_doctor_cap_dinar', '20')
ON CONFLICT (key) DO UPDATE SET value_text = excluded.value_text, updated_at = now();

DELETE FROM public.app_config WHERE key = 'student_therapist_cap_dinar';

CREATE OR REPLACE FUNCTION public.get_graduated_doctor_cap_dinar()
RETURNS real LANGUAGE plpgsql AS $$
DECLARE cap_text text; cap_value real;
BEGIN
  SELECT value_text INTO cap_text FROM public.app_config WHERE key = 'graduated_doctor_cap_dinar';
  IF cap_text IS NULL THEN RETURN 20; END IF;
  cap_value := cap_text::real;
  IF cap_value <= 0 THEN RETURN 20; END IF;
  RETURN cap_value;
EXCEPTION WHEN OTHERS THEN RETURN 20;
END; $$;

CREATE OR REPLACE FUNCTION public.get_student_therapist_cap_dinar()
RETURNS real LANGUAGE plpgsql AS $$
BEGIN RETURN public.get_graduated_doctor_cap_dinar(); END; $$;

CREATE OR REPLACE FUNCTION public.enforce_student_therapist_rate_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cap_value real;
BEGIN
  cap_value := public.get_graduated_doctor_cap_dinar();
  IF NEW.tier = 'graduated_doctor' AND NEW.rate_dinar IS NOT NULL AND NEW.rate_dinar > cap_value THEN
    RAISE EXCEPTION 'Graduated doctor rate exceeds cap (max % TND)', cap_value;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_therapist_slot_rules()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE therapist_tier varchar(20); cap_value real;
BEGIN
  SELECT tier INTO therapist_tier FROM public.therapist_profiles WHERE user_id = NEW.therapist_id;
  cap_value := public.get_graduated_doctor_cap_dinar();
  IF therapist_tier = 'graduated_doctor' AND NEW.price_dinar > cap_value THEN
    RAISE EXCEPTION 'Graduated doctor slot price exceeds cap (max % TND)', cap_value;
  END IF;
  IF NEW.status IN ('open', 'booked') THEN
    IF EXISTS (
      SELECT 1 FROM public.therapist_slots s
      WHERE s.therapist_id = NEW.therapist_id AND s.id <> COALESCE(NEW.id, -1) AND s.status IN ('open', 'booked')
        AND tstzrange(s.starts_at, s.starts_at + make_interval(mins => s.duration_minutes), '[)')
            && tstzrange(NEW.starts_at, NEW.starts_at + make_interval(mins => NEW.duration_minutes), '[)')
    ) THEN RAISE EXCEPTION 'Therapist slot overlaps with an existing open/booked slot'; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TABLE IF NOT EXISTS public.listener_qualification_tests (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score integer NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL,
  attempted_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_listener_qual_tests_user ON public.listener_qualification_tests(user_id);
ALTER TABLE public.listener_qualification_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own qualification test" ON public.listener_qualification_tests;
CREATE POLICY "users read own qualification test" ON public.listener_qualification_tests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own qualification test" ON public.listener_qualification_tests;
CREATE POLICY "users insert own qualification test" ON public.listener_qualification_tests FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all qualification tests" ON public.listener_qualification_tests;
CREATE POLICY "admins read all qualification tests" ON public.listener_qualification_tests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS custom_banner_url text,
  ADD COLUMN IF NOT EXISTS custom_css jsonb,
  ADD COLUMN IF NOT EXISTS gallery_images text[],
  ADD COLUMN IF NOT EXISTS certifications jsonb,
  ADD COLUMN IF NOT EXISTS consultation_intro text;

-- ─────────────────────────────────────────────
-- MIGRATION 020 — Google OAuth Tokens
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.therapist_google_tokens (
  therapist_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  expires_at timestamptz,
  connected_at timestamptz DEFAULT now()
);

ALTER TABLE public.therapist_google_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "therapist reads own google token" ON public.therapist_google_tokens;
CREATE POLICY "therapist reads own google token" ON public.therapist_google_tokens FOR SELECT USING (auth.uid() = therapist_id);

DROP POLICY IF EXISTS "therapist manages own google token" ON public.therapist_google_tokens;
CREATE POLICY "therapist manages own google token" ON public.therapist_google_tokens FOR ALL USING (auth.uid() = therapist_id) WITH CHECK (auth.uid() = therapist_id);

-- ─────────────────────────────────────────────
-- MIGRATION 021 — Doctor Payouts
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.doctor_payouts (
  id serial PRIMARY KEY,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_sessions integer NOT NULL DEFAULT 0,
  total_amount_dinar real NOT NULL DEFAULT 0,
  platform_fee_dinar real NOT NULL DEFAULT 0,
  net_amount_dinar real NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_payouts_doctor_id ON public.doctor_payouts(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_payouts_status ON public.doctor_payouts(status);
CREATE INDEX IF NOT EXISTS idx_doctor_payouts_period ON public.doctor_payouts(period_start, period_end);

ALTER TABLE public.doctor_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_payouts_select_own" ON public.doctor_payouts FOR SELECT USING (doctor_id = auth.uid());
CREATE POLICY "doctor_payouts_service_all" ON public.doctor_payouts FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- MIGRATION 022 — Post-Session Features
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_homework (
  id serial PRIMARY KEY,
  summary_id integer NOT NULL REFERENCES public.session_summaries(id) ON DELETE CASCADE,
  description text NOT NULL,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  client_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_mood_ratings (
  id serial PRIMARY KEY,
  appointment_id integer NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pre_session_mood integer CHECK (pre_session_mood BETWEEN 1 AND 5),
  post_session_mood integer CHECK (post_session_mood BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consultation_prep (
  id serial PRIMARY KEY,
  appointment_id integer NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  whats_on_mind text NOT NULL,
  goals_for_session text,
  current_mood integer CHECK (current_mood BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapist manages homework" ON public.session_homework FOR ALL
  USING (EXISTS (SELECT 1 FROM public.session_summaries ss WHERE ss.id = session_homework.summary_id AND ss.therapist_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.session_summaries ss WHERE ss.id = session_homework.summary_id AND ss.therapist_id = auth.uid()));

CREATE POLICY "Client reads own homework" ON public.session_homework FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.session_summaries ss WHERE ss.id = session_homework.summary_id AND ss.client_id = auth.uid() AND ss.client_visible = true)
);
CREATE POLICY "Client updates own homework completion" ON public.session_homework FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.session_summaries ss WHERE ss.id = session_homework.summary_id AND ss.client_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.session_summaries ss WHERE ss.id = session_homework.summary_id AND ss.client_id = auth.uid()));

ALTER TABLE public.session_mood_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client manages own mood ratings" ON public.session_mood_ratings FOR ALL USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Therapist reads session mood ratings" ON public.session_mood_ratings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = session_mood_ratings.appointment_id AND a.therapist_id = auth.uid())
);

ALTER TABLE public.consultation_prep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client manages own prep" ON public.consultation_prep FOR ALL USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Therapist reads consultation prep" ON public.consultation_prep FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = consultation_prep.appointment_id AND a.therapist_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_homework_summary ON public.session_homework(summary_id);
CREATE INDEX IF NOT EXISTS idx_mood_ratings_appointment ON public.session_mood_ratings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_mood_ratings_client ON public.session_mood_ratings(client_id);
CREATE INDEX IF NOT EXISTS idx_consultation_prep_appointment ON public.consultation_prep(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_prep_client ON public.consultation_prep(client_id);

-- ─────────────────────────────────────────────
-- MIGRATION 023 — Tier Upgrade Requests
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tier_upgrade_requests (
  id serial PRIMARY KEY,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_tier varchar(20) NOT NULL,
  requested_tier varchar(20) NOT NULL,
  portfolio_url text,
  justification text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tier_upgrade_requests_doctor ON public.tier_upgrade_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_requests_status ON public.tier_upgrade_requests(status);

ALTER TABLE public.tier_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_view_own_upgrade_requests" ON public.tier_upgrade_requests FOR SELECT USING (doctor_id = auth.uid());
CREATE POLICY "doctor_create_upgrade_request" ON public.tier_upgrade_requests FOR INSERT WITH CHECK (doctor_id = auth.uid());
CREATE POLICY "admin_view_all_upgrade_requests" ON public.tier_upgrade_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_update_upgrade_request" ON public.tier_upgrade_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ─────────────────────────────────────────────
-- MIGRATION 024 — Phase A Security & Performance
-- ─────────────────────────────────────────────

-- Case-insensitive display name uniqueness
DROP INDEX IF EXISTS public.idx_profiles_display_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name
  ON public.profiles (LOWER(display_name))
  WHERE display_name IS NOT NULL;

-- Composite performance indexes
CREATE INDEX IF NOT EXISTS idx_therapist_slots_therapist_status_starts
  ON public.therapist_slots(therapist_id, status, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_client_status
  ON public.appointments(client_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_client_status
  ON public.payment_transactions(client_id, status);

-- Fix doctor_payouts RLS
DROP POLICY IF EXISTS "doctor_payouts_service_all" ON public.doctor_payouts;
CREATE POLICY "admin_view_all_payouts" ON public.doctor_payouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- SLA columns on therapist_verifications
ALTER TABLE public.therapist_verifications
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal';

-- ─────────────────────────────────────────────
-- Migration 025: Subscription model + matching preferences
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  name_ar         VARCHAR(100),
  name_fr         VARCHAR(100),
  description     TEXT,
  sessions_included INTEGER NOT NULL,
  price_dinar     REAL NOT NULL,
  duration_days   INTEGER NOT NULL DEFAULT 30,
  tier_restriction VARCHAR(30),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                      SERIAL PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id                 INTEGER NOT NULL REFERENCES public.subscription_plans(id),
  therapist_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sessions_remaining      INTEGER NOT NULL,
  starts_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at              TIMESTAMPTZ NOT NULL,
  status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'expired', 'cancelled')),
  payment_transaction_id  INTEGER REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON public.user_subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires
  ON public.user_subscriptions(expires_at);

CREATE TABLE IF NOT EXISTS public.matching_preferences (
  user_id                   UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_specializations TEXT[],
  preferred_languages       TEXT[],
  preferred_gender          VARCHAR(20),
  max_budget_dinar          REAL,
  session_type_preference   VARCHAR(20)
    CHECK (session_type_preference IN ('online', 'in_person', 'any')),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_plans_select_all" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "sub_plans_admin_write" ON public.subscription_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "user_subs_select_own" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_subs_insert_own" ON public.user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_subs_update_own" ON public.user_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_subs_admin_all" ON public.user_subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "matching_prefs_own" ON public.matching_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.subscription_plans
  (name, name_ar, name_fr, description, sessions_included, price_dinar, duration_days, tier_restriction, is_active)
VALUES
  ('Starter', 'باقة البداية', 'Démarrage', '4 sessions in 30 days — perfect for getting started', 4, 70, 30, NULL, TRUE),
  ('Regular', 'باقة شهرية', 'Régulière', '8 sessions in 30 days with any therapist tier', 8, 130, 30, NULL, TRUE),
  ('Premium', 'باقة مميزة', 'Premium', '8 sessions in 30 days — premium doctors only', 8, 200, 30, 'premium_doctor', TRUE)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- DONE — All 25 migrations applied
-- ─────────────────────────────────────────────
