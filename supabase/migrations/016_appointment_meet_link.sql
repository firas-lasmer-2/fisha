-- 016_appointment_meet_link.sql
-- Add Google Meet (or any video call) link to appointments

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS meet_link TEXT;

-- Also allow therapists to pre-fill a default Meet link on their profile/slots
ALTER TABLE therapist_slots
  ADD COLUMN IF NOT EXISTS meet_link TEXT;

COMMENT ON COLUMN appointments.meet_link IS 'Google Meet or video call URL for the session';
COMMENT ON COLUMN therapist_slots.meet_link IS 'Default video call URL for this slot (copied to appointment on booking)';
