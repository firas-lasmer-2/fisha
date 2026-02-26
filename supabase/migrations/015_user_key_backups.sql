-- 015_user_key_backups.sql
-- Encrypted backup of per-user E2E private keys (PBKDF2 + AES-KW wrapping)

CREATE TABLE IF NOT EXISTS user_key_backups (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- AES-KW-wrapped private key JWK, base64url encoded
  wrapped_private_key TEXT NOT NULL,
  -- Salt used for PBKDF2 key derivation, base64url encoded
  salt TEXT NOT NULL,
  -- PBKDF2 iteration count (>=100000)
  iterations INTEGER NOT NULL DEFAULT 200000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One backup slot per user; upsert replaces it
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_key_backups_user ON user_key_backups(user_id);

-- RLS: users can only read/write their own backup
ALTER TABLE user_key_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "key_backup_select_own" ON user_key_backups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "key_backup_insert_own" ON user_key_backups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "key_backup_update_own" ON user_key_backups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "key_backup_delete_own" ON user_key_backups
  FOR DELETE USING (auth.uid() = user_id);
