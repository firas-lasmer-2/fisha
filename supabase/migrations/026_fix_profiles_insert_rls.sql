-- Migration 026: Fix profiles INSERT RLS
-- The profiles table has SELECT and UPDATE policies but no INSERT policy.
-- This causes 42501 errors when the server tries to insert a new profile
-- (e.g. during signup if the auto-profile trigger hasn't fired yet).
-- The service role bypasses RLS, but as a safety net we also add an explicit
-- policy so authenticated users can insert their own profile row.

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
