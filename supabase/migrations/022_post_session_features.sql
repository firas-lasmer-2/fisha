-- Phase 6: Post-Session Features
-- Adds session_homework, session_mood_ratings, consultation_prep tables

-- 6b: Session homework assigned by doctor
CREATE TABLE IF NOT EXISTS session_homework (
  id SERIAL PRIMARY KEY,
  summary_id INTEGER NOT NULL REFERENCES session_summaries(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  client_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6c: Mood ratings before/after a session
CREATE TABLE IF NOT EXISTS session_mood_ratings (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pre_session_mood INTEGER CHECK (pre_session_mood BETWEEN 1 AND 5),
  post_session_mood INTEGER CHECK (post_session_mood BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6e: Consultation prep form filled by client before session
CREATE TABLE IF NOT EXISTS consultation_prep (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  whats_on_mind TEXT NOT NULL,
  goals_for_session TEXT,
  current_mood INTEGER CHECK (current_mood BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: session_homework
ALTER TABLE session_homework ENABLE ROW LEVEL SECURITY;

-- Therapist can manage homework via session_summaries they own
CREATE POLICY "Therapist manages homework"
  ON session_homework
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM session_summaries ss
      WHERE ss.id = session_homework.summary_id
        AND ss.therapist_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_summaries ss
      WHERE ss.id = session_homework.summary_id
        AND ss.therapist_id = auth.uid()
    )
  );

-- Client can read and update their own homework
CREATE POLICY "Client reads own homework"
  ON session_homework
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_summaries ss
      WHERE ss.id = session_homework.summary_id
        AND ss.client_id = auth.uid()
        AND ss.client_visible = TRUE
    )
  );

CREATE POLICY "Client updates own homework completion"
  ON session_homework
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM session_summaries ss
      WHERE ss.id = session_homework.summary_id
        AND ss.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_summaries ss
      WHERE ss.id = session_homework.summary_id
        AND ss.client_id = auth.uid()
    )
  );

-- RLS: session_mood_ratings
ALTER TABLE session_mood_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own mood ratings"
  ON session_mood_ratings
  FOR ALL
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Therapist reads session mood ratings"
  ON session_mood_ratings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = session_mood_ratings.appointment_id
        AND a.therapist_id = auth.uid()
    )
  );

-- RLS: consultation_prep
ALTER TABLE consultation_prep ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own prep"
  ON consultation_prep
  FOR ALL
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Therapist reads consultation prep"
  ON consultation_prep
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = consultation_prep.appointment_id
        AND a.therapist_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_homework_summary ON session_homework(summary_id);
CREATE INDEX IF NOT EXISTS idx_mood_ratings_appointment ON session_mood_ratings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_mood_ratings_client ON session_mood_ratings(client_id);
CREATE INDEX IF NOT EXISTS idx_consultation_prep_appointment ON consultation_prep(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_prep_client ON consultation_prep(client_id);
