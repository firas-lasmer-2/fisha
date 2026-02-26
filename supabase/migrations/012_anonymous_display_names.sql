-- 012_anonymous_display_names.sql
-- Add display_name to profiles for persistent anonymous identity

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(30) NULL;

-- Partial unique index: uniqueness only when set
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name
  ON profiles(display_name) WHERE display_name IS NOT NULL;

-- Alphanumeric + Arabic Unicode block + underscore, 3-30 chars
ALTER TABLE profiles
  ADD CONSTRAINT profiles_display_name_format CHECK (
    display_name IS NULL
    OR (
      LENGTH(display_name) >= 3
      AND LENGTH(display_name) <= 30
      AND display_name ~ '^[a-zA-Z0-9\u0600-\u06FF_]+$'
    )
  );

-- RLS: users can update only their own display_name (RLS already enabled on profiles)
-- The existing "profiles: users can update own row" policy covers this column.

-- Extend therapist_profiles for landing pages
ALTER TABLE therapist_profiles
  ADD COLUMN IF NOT EXISTS landing_page_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS landing_page_sections JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS landing_page_cta_text VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS landing_page_cta_url VARCHAR(255) NULL;
