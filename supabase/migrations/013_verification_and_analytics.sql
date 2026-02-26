-- 013_verification_and_analytics.sql
-- Therapist document verification workflow

CREATE TABLE IF NOT EXISTS therapist_verifications (
  id SERIAL PRIMARY KEY,
  therapist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('license', 'diploma', 'id_card', 'cv')),
  document_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(therapist_id, document_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_therapist_verif_therapist ON therapist_verifications(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_verif_status ON therapist_verifications(status);

-- RLS
ALTER TABLE therapist_verifications ENABLE ROW LEVEL SECURITY;

-- Therapists can read and insert their own
CREATE POLICY "therapist_verif_select_own" ON therapist_verifications
  FOR SELECT USING (therapist_id = auth.uid());

CREATE POLICY "therapist_verif_insert_own" ON therapist_verifications
  FOR INSERT WITH CHECK (therapist_id = auth.uid());

-- Moderators and admins can read all and update
CREATE POLICY "therapist_verif_select_admin" ON therapist_verifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "therapist_verif_update_admin" ON therapist_verifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
    )
  );
