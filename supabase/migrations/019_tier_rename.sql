-- Shifa: Phase 1 — Rename therapist tiers, add badge_type, listener qualification tests, extend therapist_profiles

-- ─────────────────────────────────────────────
-- 1a. Rename tier values: student → graduated_doctor, professional → premium_doctor
-- ─────────────────────────────────────────────

-- Temporarily drop the check constraint so we can migrate data
ALTER TABLE public.therapist_profiles
  DROP CONSTRAINT IF EXISTS therapist_profiles_tier_check;

-- Migrate existing data
UPDATE public.therapist_profiles SET tier = 'graduated_doctor' WHERE tier = 'student';
UPDATE public.therapist_profiles SET tier = 'premium_doctor'   WHERE tier = 'professional';

-- Update default so new rows default to premium_doctor
ALTER TABLE public.therapist_profiles
  ALTER COLUMN tier SET DEFAULT 'premium_doctor';

-- Restore constraint with new valid values
ALTER TABLE public.therapist_profiles
  ADD CONSTRAINT therapist_profiles_tier_check
  CHECK (tier IN ('graduated_doctor', 'premium_doctor'));

-- ─────────────────────────────────────────────
-- 1a. Add badge_type column
-- ─────────────────────────────────────────────
ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS badge_type VARCHAR(30)
  CHECK (badge_type IN ('verified', 'premium'));

-- Back-fill badge_type based on tier
UPDATE public.therapist_profiles SET badge_type = 'verified' WHERE tier = 'graduated_doctor';
UPDATE public.therapist_profiles SET badge_type = 'premium'  WHERE tier = 'premium_doctor';

-- ─────────────────────────────────────────────
-- 1a. Update app_config cap key to new name
-- ─────────────────────────────────────────────
INSERT INTO public.app_config (key, value_text)
VALUES ('graduated_doctor_cap_dinar', '20')
ON CONFLICT (key) DO UPDATE SET value_text = excluded.value_text, updated_at = NOW();

-- Keep old key for backward safety during rollout, then remove later
-- (We drop it here; if you need a rolling deploy, comment out the DELETE)
DELETE FROM public.app_config WHERE key = 'student_therapist_cap_dinar';

-- ─────────────────────────────────────────────
-- 1a. Update DB helper function to use new cap key & tier name
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_graduated_doctor_cap_dinar()
RETURNS real
LANGUAGE plpgsql
AS $$
DECLARE
  cap_text  TEXT;
  cap_value REAL;
BEGIN
  SELECT value_text INTO cap_text
  FROM public.app_config
  WHERE key = 'graduated_doctor_cap_dinar';

  IF cap_text IS NULL THEN RETURN 20; END IF;

  cap_value := cap_text::real;
  IF cap_value <= 0 THEN RETURN 20; END IF;

  RETURN cap_value;
EXCEPTION
  WHEN OTHERS THEN RETURN 20;
END;
$$;

-- Also keep old function name as alias so nothing breaks during transition
CREATE OR REPLACE FUNCTION public.get_student_therapist_cap_dinar()
RETURNS real
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.get_graduated_doctor_cap_dinar();
END;
$$;

-- ─────────────────────────────────────────────
-- 1a. Update rate-cap trigger function
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_student_therapist_rate_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cap_value REAL;
BEGIN
  cap_value := public.get_graduated_doctor_cap_dinar();
  IF NEW.tier = 'graduated_doctor' AND NEW.rate_dinar IS NOT NULL AND NEW.rate_dinar > cap_value THEN
    RAISE EXCEPTION 'Graduated doctor rate exceeds cap (max % TND)', cap_value;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────
-- 1a. Update slot-rules trigger function
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_therapist_slot_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  therapist_tier VARCHAR(20);
  cap_value      REAL;
BEGIN
  SELECT tier INTO therapist_tier
  FROM public.therapist_profiles
  WHERE user_id = NEW.therapist_id;

  cap_value := public.get_graduated_doctor_cap_dinar();
  IF therapist_tier = 'graduated_doctor' AND NEW.price_dinar > cap_value THEN
    RAISE EXCEPTION 'Graduated doctor slot price exceeds cap (max % TND)', cap_value;
  END IF;

  IF NEW.status IN ('open', 'booked') THEN
    IF EXISTS (
      SELECT 1
      FROM public.therapist_slots s
      WHERE s.therapist_id = NEW.therapist_id
        AND s.id <> COALESCE(NEW.id, -1)
        AND s.status IN ('open', 'booked')
        AND tstzrange(s.starts_at, s.starts_at + make_interval(mins => s.duration_minutes), '[)')
            && tstzrange(NEW.starts_at, NEW.starts_at + make_interval(mins => NEW.duration_minutes), '[)')
    ) THEN
      RAISE EXCEPTION 'Therapist slot overlaps with an existing open/booked slot';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────
-- 1b. New table: listener_qualification_tests
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listener_qualification_tests (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL,
  passed       BOOLEAN NOT NULL DEFAULT FALSE,
  answers      JSONB NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)  -- one attempt per user (can be relaxed with a migration later)
);

CREATE INDEX IF NOT EXISTS idx_listener_qual_tests_user
  ON public.listener_qualification_tests(user_id);

-- RLS for listener_qualification_tests
ALTER TABLE public.listener_qualification_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own qualification test" ON public.listener_qualification_tests;
CREATE POLICY "users read own qualification test"
  ON public.listener_qualification_tests
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own qualification test" ON public.listener_qualification_tests;
CREATE POLICY "users insert own qualification test"
  ON public.listener_qualification_tests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all qualification tests" ON public.listener_qualification_tests;
CREATE POLICY "admins read all qualification tests"
  ON public.listener_qualification_tests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ─────────────────────────────────────────────
-- 1c. Extend therapist_profiles for richer landing pages
-- ─────────────────────────────────────────────
ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS custom_banner_url    TEXT,
  ADD COLUMN IF NOT EXISTS custom_css           JSONB,
  ADD COLUMN IF NOT EXISTS gallery_images       TEXT[],
  ADD COLUMN IF NOT EXISTS certifications       JSONB,
  ADD COLUMN IF NOT EXISTS consultation_intro   TEXT;
