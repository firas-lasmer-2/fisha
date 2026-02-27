-- ============================================================
-- Migration 029: Listener gamification + burnout prevention
-- Adds badges, endorsements, wellbeing check-ins, and cooldown state
-- ============================================================

-- ---- Listener progress extensions ---------------------------------------
ALTER TABLE public.listener_progress
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS endorsements_count INTEGER NOT NULL DEFAULT 0;

-- ---- Listener badges -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listener_badges (
  id          SERIAL PRIMARY KEY,
  listener_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key   VARCHAR(60) NOT NULL,
  title       VARCHAR(120) NOT NULL,
  description TEXT,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta        JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_badges_unique
  ON public.listener_badges(listener_id, badge_key);

CREATE INDEX IF NOT EXISTS idx_listener_badges_listener_awarded
  ON public.listener_badges(listener_id, awarded_at DESC);

-- ---- Listener endorsements ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.listener_endorsements (
  id          SERIAL PRIMARY KEY,
  listener_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id  INTEGER REFERENCES public.peer_sessions(id) ON DELETE SET NULL,
  quote       TEXT NOT NULL,
  warmth_score INTEGER CHECK (warmth_score BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_endorsement_session_once
  ON public.listener_endorsements(listener_id, session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listener_endorsements_listener_created
  ON public.listener_endorsements(listener_id, created_at DESC);

-- ---- Listener wellbeing check-ins ---------------------------------------
CREATE TABLE IF NOT EXISTS public.listener_wellbeing_checkins (
  id             SERIAL PRIMARY KEY,
  listener_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id     INTEGER REFERENCES public.peer_sessions(id) ON DELETE SET NULL,
  stress_level   INTEGER NOT NULL CHECK (stress_level BETWEEN 1 AND 5),
  emotional_load INTEGER NOT NULL CHECK (emotional_load BETWEEN 1 AND 5),
  needs_break    BOOLEAN NOT NULL DEFAULT false,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listener_wellbeing_listener_created
  ON public.listener_wellbeing_checkins(listener_id, created_at DESC);

-- ---- Listener cooldown state --------------------------------------------
CREATE TABLE IF NOT EXISTS public.listener_cooldowns (
  listener_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_session_id INTEGER REFERENCES public.peer_sessions(id) ON DELETE SET NULL,
  reason            VARCHAR(60) NOT NULL DEFAULT 'difficult_session',
  starts_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at           TIMESTAMPTZ NOT NULL,
  released_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listener_cooldowns_ends_at
  ON public.listener_cooldowns(ends_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_listener_cooldowns ON public.listener_cooldowns;
CREATE TRIGGER set_updated_at_listener_cooldowns
  BEFORE UPDATE ON public.listener_cooldowns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---- Backfill aggregate count -------------------------------------------
UPDATE public.listener_progress lp
SET endorsements_count = COALESCE(src.cnt, 0)
FROM (
  SELECT listener_id, COUNT(*)::INT AS cnt
  FROM public.listener_endorsements
  GROUP BY listener_id
) src
WHERE lp.listener_id = src.listener_id;

-- ---- RLS -----------------------------------------------------------------
ALTER TABLE public.listener_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_wellbeing_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_cooldowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Listeners can view own badges" ON public.listener_badges;
CREATE POLICY "Listeners can view own badges" ON public.listener_badges
  FOR SELECT USING (
    auth.uid() = listener_id OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Listeners can insert own badges" ON public.listener_badges;
CREATE POLICY "Listeners can insert own badges" ON public.listener_badges
  FOR INSERT WITH CHECK (
    auth.uid() = listener_id OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Endorsements are public read" ON public.listener_endorsements;
CREATE POLICY "Endorsements are public read" ON public.listener_endorsements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Participants can insert endorsements" ON public.listener_endorsements;
CREATE POLICY "Participants can insert endorsements" ON public.listener_endorsements
  FOR INSERT WITH CHECK (
    auth.uid() = listener_id OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Listeners can view own wellbeing checkins" ON public.listener_wellbeing_checkins;
CREATE POLICY "Listeners can view own wellbeing checkins" ON public.listener_wellbeing_checkins
  FOR SELECT USING (
    auth.uid() = listener_id OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Listeners can insert own wellbeing checkins" ON public.listener_wellbeing_checkins;
CREATE POLICY "Listeners can insert own wellbeing checkins" ON public.listener_wellbeing_checkins
  FOR INSERT WITH CHECK (
    auth.uid() = listener_id OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Listeners can view own cooldowns" ON public.listener_cooldowns;
CREATE POLICY "Listeners can view own cooldowns" ON public.listener_cooldowns
  FOR SELECT USING (
    auth.uid() = listener_id OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Listeners can upsert own cooldowns" ON public.listener_cooldowns;
CREATE POLICY "Listeners can upsert own cooldowns" ON public.listener_cooldowns
  FOR INSERT WITH CHECK (
    auth.uid() = listener_id OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Listeners can update own cooldowns" ON public.listener_cooldowns;
CREATE POLICY "Listeners can update own cooldowns" ON public.listener_cooldowns
  FOR UPDATE USING (
    auth.uid() = listener_id OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );
