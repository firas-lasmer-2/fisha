-- 017_content_moderation.sql
-- Content flagging for therapy and peer support messages

-- Add flagging columns to therapy messages
ALTER TABLE therapy_messages
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Add flagging columns to peer messages
ALTER TABLE peer_messages
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Central content flags table for admin review
CREATE TABLE IF NOT EXISTS content_flags (
  id BIGSERIAL PRIMARY KEY,
  -- Which table the flagged message is in
  message_type VARCHAR(30) NOT NULL CHECK (message_type IN ('therapy_message', 'peer_message')),
  message_id BIGINT NOT NULL,
  flag_reason VARCHAR(100) NOT NULL,
  -- Who triggered the flag (NULL = automatic system flag)
  flagged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- low / medium / high / critical
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  -- pending / reviewed / dismissed
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status);
CREATE INDEX IF NOT EXISTS idx_content_flags_message ON content_flags(message_type, message_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_created ON content_flags(created_at DESC);

-- RLS: only admin/moderator can read flags; server writes via service role
ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_flags_select_admin" ON content_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
    )
  );
