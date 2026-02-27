-- ============================================================
-- Migration 030: Listener seasons + Hall of Fame archive
-- Monthly leaderboard reset foundation and certificate records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.listener_leaderboard_seasons (
  season_key   VARCHAR(7) PRIMARY KEY, -- YYYY-MM
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listener_hall_of_fame (
  id                  SERIAL PRIMARY KEY,
  season_key          VARCHAR(7) NOT NULL REFERENCES public.listener_leaderboard_seasons(season_key) ON DELETE CASCADE,
  rank                INTEGER NOT NULL CHECK (rank > 0),
  listener_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name        VARCHAR(120) NOT NULL,
  points              INTEGER NOT NULL DEFAULT 0,
  average_rating      REAL NOT NULL DEFAULT 0,
  rating_count        INTEGER NOT NULL DEFAULT 0,
  positive_streak     INTEGER NOT NULL DEFAULT 0,
  trophy_tier         VARCHAR(10) CHECK (trophy_tier IN ('gold', 'silver', 'bronze')),
  certification_title VARCHAR(120),
  archived_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  certificate_issued_at TIMESTAMPTZ,
  certificate_code    VARCHAR(64)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_hof_season_rank
  ON public.listener_hall_of_fame(season_key, rank);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_hof_season_listener
  ON public.listener_hall_of_fame(season_key, listener_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_hof_certificate_code
  ON public.listener_hall_of_fame(certificate_code)
  WHERE certificate_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listener_hof_season_archived
  ON public.listener_hall_of_fame(season_key DESC, rank ASC);

CREATE INDEX IF NOT EXISTS idx_listener_hof_listener
  ON public.listener_hall_of_fame(listener_id, season_key DESC);

ALTER TABLE public.listener_leaderboard_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_hall_of_fame ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leaderboard seasons public read" ON public.listener_leaderboard_seasons;
CREATE POLICY "Leaderboard seasons public read" ON public.listener_leaderboard_seasons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Moderators manage leaderboard seasons" ON public.listener_leaderboard_seasons;
CREATE POLICY "Moderators manage leaderboard seasons" ON public.listener_leaderboard_seasons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Hall of fame public read" ON public.listener_hall_of_fame;
CREATE POLICY "Hall of fame public read" ON public.listener_hall_of_fame
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Moderators manage hall of fame" ON public.listener_hall_of_fame;
CREATE POLICY "Moderators manage hall of fame" ON public.listener_hall_of_fame
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );
