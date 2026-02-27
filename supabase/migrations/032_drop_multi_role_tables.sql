-- ============================================================
-- Migration 032: Drop multi-role tables (revert 031)
-- Each user has exactly one role stored in profiles.role.
-- ============================================================

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view own role memberships" ON public.role_memberships;
DROP POLICY IF EXISTS "Admins manage role memberships" ON public.role_memberships;
DROP POLICY IF EXISTS "Users view own active role" ON public.user_active_roles;
DROP POLICY IF EXISTS "Users upsert own active role" ON public.user_active_roles;
DROP POLICY IF EXISTS "Users update own active role" ON public.user_active_roles;
DROP POLICY IF EXISTS "Admins manage active roles" ON public.user_active_roles;

-- Drop tables
DROP TABLE IF EXISTS public.user_active_roles CASCADE;
DROP TABLE IF EXISTS public.role_memberships CASCADE;

-- Drop helper function
DROP FUNCTION IF EXISTS public.has_role(TEXT);
