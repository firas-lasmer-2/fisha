-- Migration 021: Doctor payout tracking table

CREATE TABLE IF NOT EXISTS doctor_payouts (
  id              SERIAL PRIMARY KEY,
  doctor_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  total_sessions  INTEGER NOT NULL DEFAULT 0,
  total_amount_dinar  REAL NOT NULL DEFAULT 0,
  platform_fee_dinar  REAL NOT NULL DEFAULT 0,
  net_amount_dinar    REAL NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_payouts_doctor_id ON doctor_payouts(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_payouts_status    ON doctor_payouts(status);
CREATE INDEX IF NOT EXISTS idx_doctor_payouts_period    ON doctor_payouts(period_start, period_end);

-- RLS
ALTER TABLE doctor_payouts ENABLE ROW LEVEL SECURITY;

-- Doctors can read their own payouts
CREATE POLICY "doctor_payouts_select_own" ON doctor_payouts
  FOR SELECT
  USING (doctor_id = auth.uid());

-- Service role (server) has full access
CREATE POLICY "doctor_payouts_service_all" ON doctor_payouts
  FOR ALL
  USING (auth.role() = 'service_role');
