-- Phase 3.3: Enhanced Progress Tracking
-- Adds treatment_goals and session_summaries tables

CREATE TABLE IF NOT EXISTS treatment_goals (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_summaries (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES profiles(id),
  client_id UUID NOT NULL REFERENCES profiles(id),
  key_topics TEXT[],
  homework TEXT,
  therapist_notes TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: treatment_goals
ALTER TABLE treatment_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals"
  ON treatment_goals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: session_summaries
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist can write session summaries"
  ON session_summaries
  FOR ALL
  USING (auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Client can read visible session summaries"
  ON session_summaries
  FOR SELECT
  USING (auth.uid() = client_id AND client_visible = TRUE);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_treatment_goals_user ON treatment_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_appointment ON session_summaries(appointment_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_client ON session_summaries(client_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_therapist ON session_summaries(therapist_id);
