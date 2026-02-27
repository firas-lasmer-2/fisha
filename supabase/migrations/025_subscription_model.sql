-- Migration 025: Phase B — Subscription model + matching preferences
-- Adds subscription_plans, user_subscriptions, matching_preferences

-- ─────────────────────────────────────────────
-- 1. subscription_plans (admin-managed catalogue)
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
  -- NULL = any tier; or 'graduated_doctor' / 'premium_doctor'
  tier_restriction VARCHAR(30),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. user_subscriptions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                      SERIAL PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id                 INTEGER NOT NULL REFERENCES public.subscription_plans(id),
  -- NULL = platform-wide; set to lock credits to a specific therapist
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

-- ─────────────────────────────────────────────
-- 3. matching_preferences
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_preferences ENABLE ROW LEVEL SECURITY;

-- subscription_plans: everyone can read, only admin can write
CREATE POLICY "sub_plans_select_all" ON public.subscription_plans
  FOR SELECT USING (true);

CREATE POLICY "sub_plans_admin_write" ON public.subscription_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- user_subscriptions: user reads/writes own; admin can read all
CREATE POLICY "user_subs_select_own" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_subs_insert_own" ON public.user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_subs_update_own" ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_subs_admin_all" ON public.user_subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- matching_preferences: user owns their own row
CREATE POLICY "matching_prefs_own" ON public.matching_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Seed: 3 default subscription plans
-- ─────────────────────────────────────────────
INSERT INTO public.subscription_plans
  (name, name_ar, name_fr, description, sessions_included, price_dinar, duration_days, tier_restriction, is_active)
VALUES
  ('Starter',
   'باقة البداية',
   'Démarrage',
   '4 sessions in 30 days — perfect for getting started',
   4, 70, 30, NULL, TRUE),
  ('Regular',
   'باقة شهرية',
   'Régulière',
   '8 sessions in 30 days with any therapist tier',
   8, 130, 30, NULL, TRUE),
  ('Premium',
   'باقة مميزة',
   'Premium',
   '8 sessions in 30 days — premium doctors only',
   8, 200, 30, 'premium_doctor', TRUE)
ON CONFLICT DO NOTHING;
