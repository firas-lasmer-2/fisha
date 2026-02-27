-- Migration 024: Phase A Security & Performance
-- 1. Case-insensitive unique index for display names
-- 2. Composite performance indexes per §4.3 of mine.md
-- 3. Fix doctor_payouts RLS (auth.role() = 'service_role' never fires; add admin policy)

-- ─────────────────────────────────────────────
-- 1. Case-insensitive display name uniqueness
--    Replaces the case-sensitive idx_profiles_display_name from migration 012.
--    Prevents "Ali" and "ali" being registered as different names.
-- ─────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_profiles_display_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name
  ON public.profiles (LOWER(display_name))
  WHERE display_name IS NOT NULL;

-- ─────────────────────────────────────────────
-- 2. Composite performance indexes
-- ─────────────────────────────────────────────

-- Slot availability queries: therapist + status + time range
CREATE INDEX IF NOT EXISTS idx_therapist_slots_therapist_status_starts
  ON public.therapist_slots(therapist_id, status, starts_at);

-- Appointment list queries: client + status (most common filter combination)
CREATE INDEX IF NOT EXISTS idx_appointments_client_status
  ON public.appointments(client_id, status);

-- Payment history queries: client + status
CREATE INDEX IF NOT EXISTS idx_payment_transactions_client_status
  ON public.payment_transactions(client_id, status);

-- ─────────────────────────────────────────────
-- 3. Fix doctor_payouts RLS
--    auth.role() = 'service_role' is always false for JWT users;
--    the service role bypasses RLS entirely so the policy is dead code.
--    Replace with an explicit admin-read policy.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "doctor_payouts_service_all" ON public.doctor_payouts;

CREATE POLICY "admin_view_all_payouts" ON public.doctor_payouts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────
-- 4. SLA columns on therapist_verifications (gap G8)
-- ─────────────────────────────────────────────
ALTER TABLE public.therapist_verifications
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal';
