-- Migration 023: Tier upgrade requests for doctors
-- Allows graduated_doctor to request upgrade to premium_doctor

CREATE TABLE IF NOT EXISTS tier_upgrade_requests (
  id SERIAL PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_tier VARCHAR(20) NOT NULL,
  requested_tier VARCHAR(20) NOT NULL,
  portfolio_url TEXT,
  justification TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_upgrade_requests_doctor ON tier_upgrade_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_requests_status ON tier_upgrade_requests(status);

-- RLS
ALTER TABLE tier_upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Doctors can view and create their own requests
CREATE POLICY "doctor_view_own_upgrade_requests" ON tier_upgrade_requests
  FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY "doctor_create_upgrade_request" ON tier_upgrade_requests
  FOR INSERT WITH CHECK (doctor_id = auth.uid());

-- Admins can view all and update status
CREATE POLICY "admin_view_all_upgrade_requests" ON tier_upgrade_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin_update_upgrade_request" ON tier_upgrade_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
