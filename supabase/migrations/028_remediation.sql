-- ============================================================
-- Migration 028: Remediation schema additions
-- Sprint 1 (W2) + Sprint 2 (W4, W7) groundwork
-- ============================================================

-- ── Appointment cancellation / reschedule ──────────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS original_appointment_id UUID REFERENCES appointments(id);

-- ── Webhook idempotency ────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT UNIQUE NOT NULL,
  provider      TEXT NOT NULL,
  processed_at  TIMESTAMPTZ DEFAULT now(),
  payload       JSONB
);

-- ── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  read       BOOLEAN NOT NULL DEFAULT false,
  data       JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read) WHERE read = false;

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_own ON notifications;
CREATE POLICY notifications_own ON notifications
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_service ON webhook_events;
CREATE POLICY webhook_events_service ON webhook_events
  FOR ALL USING (true);

-- ── Atomic subscription credit deduction ──────────────────
CREATE OR REPLACE FUNCTION deduct_subscription_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE user_subscriptions
  SET sessions_remaining = sessions_remaining - 1
  WHERE user_id = p_user_id
    AND sessions_remaining > 0
    AND status = 'active';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
