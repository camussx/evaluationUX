-- ── Team Management RPCs ──────────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor.
-- These functions use SECURITY DEFINER to access auth.users safely.

-- ── 1. List all users (admin only) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id              uuid,
  email           text,
  role            text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  banned_until    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT
      au.id,
      au.email::text,
      COALESCE(p.role, au.raw_user_meta_data->>'role')::text AS role,
      au.created_at,
      au.last_sign_in_at,
      au.banned_until
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.deleted_at IS NULL
    ORDER BY au.created_at ASC;
END;
$$;

-- ── 2. Set user role by email (used immediately after signInWithOtp) ──────────
--    Returns the user's UUID so the caller can insert flow permissions.
CREATE OR REPLACE FUNCTION public.admin_set_user_role_by_email(
  p_email text,
  p_role  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF (SELECT pr.role FROM public.profiles pr WHERE pr.id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_email;
  END IF;

  -- Update auth metadata so the role is active on next login
  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role)
  WHERE id = v_user_id;

  -- Update profiles table if the row already exists
  UPDATE public.profiles SET role = p_role WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

-- ── 3. Update role for an existing user ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id uuid,
  p_role    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT pr.role FROM public.profiles pr WHERE pr.id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role)
  WHERE id = p_user_id;

  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;

-- ── 4. Ban user (revoke access) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT pr.role FROM public.profiles pr WHERE pr.id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own access';
  END IF;

  -- Set banned_until to the far future (effective permanent ban)
  UPDATE auth.users
  SET banned_until = '2099-01-01 00:00:00+00'::timestamptz
  WHERE id = p_user_id;
END;
$$;
