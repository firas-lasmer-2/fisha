-- Migration 033: Full-text search index on therapist_profiles
-- Adds a generated tsvector column using simple configuration (works for Arabic + French)
-- and a GIN index for fast text search.

ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce(headline, '') || ' ' ||
        coalesce(about_me, '') || ' ' ||
        coalesce(array_to_string(specializations, ' '), '') || ' ' ||
        coalesce(array_to_string(languages, ' '), '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_therapist_profiles_fts
  ON public.therapist_profiles USING gin(search_vector);
