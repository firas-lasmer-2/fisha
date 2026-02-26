-- Shifa: Phase 3 — Google OAuth token storage for therapists

CREATE TABLE IF NOT EXISTS public.therapist_google_tokens (
  therapist_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token_encrypted  TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at              TIMESTAMPTZ,
  connected_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Only the therapist themselves and the service-role key can access tokens.
-- Service-role bypasses RLS so server storage layer reads fine.
ALTER TABLE public.therapist_google_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "therapist reads own google token" ON public.therapist_google_tokens;
CREATE POLICY "therapist reads own google token"
  ON public.therapist_google_tokens
  FOR SELECT
  USING (auth.uid() = therapist_id);

DROP POLICY IF EXISTS "therapist manages own google token" ON public.therapist_google_tokens;
CREATE POLICY "therapist manages own google token"
  ON public.therapist_google_tokens
  FOR ALL
  USING (auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = therapist_id);
