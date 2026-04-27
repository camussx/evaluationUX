-- ── RLS Policies ─────────────────────────────────────────────────────────────
-- Run this in Supabase → SQL Editor.
--
-- Role model:
--   admin     → sees and inserts everything
--   evaluador → sees/inserts only their assigned flows and evaluations
--
-- Role is read from public.profiles.role which is kept in sync by:
--   • useAuth hook (upserts on every session)
--   • admin_set_user_role_by_email / admin_update_user_role RPCs
--
-- NOTE: RLS on profiles is intentionally permissive (authenticated users can
-- read/upsert their own row). Policies on flows / evaluations / permissions
-- rely on the helper function below.

-- ── Helper: current user's role ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Each user can read and upsert their own profile row.
-- Admin can read all profiles (needed by admin_get_users RPC).

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_upsert_own"  ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "profiles_upsert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ── flows ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flows_select"  ON public.flows;
DROP POLICY IF EXISTS "flows_insert"  ON public.flows;
DROP POLICY IF EXISTS "flows_update"  ON public.flows;
DROP POLICY IF EXISTS "flows_delete"  ON public.flows;

-- SELECT: admin sees all; evaluador sees only their assigned flows
CREATE POLICY "flows_select" ON public.flows
  FOR SELECT USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'evaluador'
      AND EXISTS (
        SELECT 1
        FROM public.flow_evaluator_permissions fep
        WHERE fep.flow_id = flows.id
          AND fep.user_id = auth.uid()
      )
    )
  );

-- INSERT: only admin
CREATE POLICY "flows_insert" ON public.flows
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'admin'
  );

-- UPDATE: nobody from client
CREATE POLICY "flows_update" ON public.flows
  FOR UPDATE USING (false);

-- DELETE: nobody from client
CREATE POLICY "flows_delete" ON public.flows
  FOR DELETE USING (false);

-- ── evaluations ───────────────────────────────────────────────────────────────

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evaluations_select"  ON public.evaluations;
DROP POLICY IF EXISTS "evaluations_insert"  ON public.evaluations;
DROP POLICY IF EXISTS "evaluations_update"  ON public.evaluations;
DROP POLICY IF EXISTS "evaluations_delete"  ON public.evaluations;

-- SELECT: admin sees all; evaluador sees only evaluations of their assigned flows
CREATE POLICY "evaluations_select" ON public.evaluations
  FOR SELECT USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'evaluador'
      AND EXISTS (
        SELECT 1
        FROM public.flow_evaluator_permissions fep
        WHERE fep.flow_id = evaluations.flow_id
          AND fep.user_id = auth.uid()
      )
    )
  );

-- INSERT: admin any flow; evaluador only assigned flows
CREATE POLICY "evaluations_insert" ON public.evaluations
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'evaluador'
      AND EXISTS (
        SELECT 1
        FROM public.flow_evaluator_permissions fep
        WHERE fep.flow_id = evaluations.flow_id
          AND fep.user_id = auth.uid()
      )
    )
  );

-- UPDATE: nobody
CREATE POLICY "evaluations_update" ON public.evaluations
  FOR UPDATE USING (false);

-- DELETE: nobody
CREATE POLICY "evaluations_delete" ON public.evaluations
  FOR DELETE USING (false);

-- ── evaluation_criteria ───────────────────────────────────────────────────────
-- Child table of evaluations — follows parent access rules.

ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eval_criteria_select" ON public.evaluation_criteria;
DROP POLICY IF EXISTS "eval_criteria_insert" ON public.evaluation_criteria;
DROP POLICY IF EXISTS "eval_criteria_update" ON public.evaluation_criteria;
DROP POLICY IF EXISTS "eval_criteria_delete" ON public.evaluation_criteria;

CREATE POLICY "eval_criteria_select" ON public.evaluation_criteria
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_criteria.evaluation_id
    )
  );

CREATE POLICY "eval_criteria_insert" ON public.evaluation_criteria
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_criteria.evaluation_id
    )
  );

CREATE POLICY "eval_criteria_update" ON public.evaluation_criteria
  FOR UPDATE USING (false);

CREATE POLICY "eval_criteria_delete" ON public.evaluation_criteria
  FOR DELETE USING (false);

-- ── evaluation_evaluators ─────────────────────────────────────────────────────
-- Child table of evaluations — follows parent access rules.

ALTER TABLE public.evaluation_evaluators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eval_evaluators_select" ON public.evaluation_evaluators;
DROP POLICY IF EXISTS "eval_evaluators_insert" ON public.evaluation_evaluators;
DROP POLICY IF EXISTS "eval_evaluators_update" ON public.evaluation_evaluators;
DROP POLICY IF EXISTS "eval_evaluators_delete" ON public.evaluation_evaluators;

CREATE POLICY "eval_evaluators_select" ON public.evaluation_evaluators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_evaluators.evaluation_id
    )
  );

CREATE POLICY "eval_evaluators_insert" ON public.evaluation_evaluators
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_evaluators.evaluation_id
    )
  );

CREATE POLICY "eval_evaluators_update" ON public.evaluation_evaluators
  FOR UPDATE USING (false);

CREATE POLICY "eval_evaluators_delete" ON public.evaluation_evaluators
  FOR DELETE USING (false);

-- ── flow_evaluator_permissions ────────────────────────────────────────────────

ALTER TABLE public.flow_evaluator_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fep_select"  ON public.flow_evaluator_permissions;
DROP POLICY IF EXISTS "fep_insert"  ON public.flow_evaluator_permissions;
DROP POLICY IF EXISTS "fep_update"  ON public.flow_evaluator_permissions;
DROP POLICY IF EXISTS "fep_delete"  ON public.flow_evaluator_permissions;

-- SELECT: admin sees all; evaluador sees only their own rows
CREATE POLICY "fep_select" ON public.flow_evaluator_permissions
  FOR SELECT USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'evaluador'
      AND user_id = auth.uid()
    )
  );

-- INSERT: only admin
CREATE POLICY "fep_insert" ON public.flow_evaluator_permissions
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'admin'
  );

-- UPDATE: nobody
CREATE POLICY "fep_update" ON public.flow_evaluator_permissions
  FOR UPDATE USING (false);

-- DELETE: only admin
CREATE POLICY "fep_delete" ON public.flow_evaluator_permissions
  FOR DELETE USING (
    public.get_my_role() = 'admin'
  );
