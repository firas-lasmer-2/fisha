-- Migration 027: Listener Directory
-- Adds browsable profile fields to listener_profiles so clients can discover
-- and directly choose a listener instead of joining a blind queue.

ALTER TABLE public.listener_profiles
  ADD COLUMN IF NOT EXISTS headline       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS about_me       TEXT,
  ADD COLUMN IF NOT EXISTS avatar_emoji   VARCHAR(10) NOT NULL DEFAULT '🤝',
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating REAL;

-- Partial index for efficient browse queries (approved + active listeners only)
CREATE INDEX IF NOT EXISTS idx_listener_profiles_browsable
  ON public.listener_profiles (verification_status, activation_status, is_available)
  WHERE verification_status = 'approved'
    AND activation_status IN ('trial', 'live');
