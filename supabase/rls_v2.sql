-- ================================================================
-- RLS v2: Role-based policies + updated save_evaluation function
-- ================================================================
-- Run this file AFTER schema.sql.
--
-- Changes from v1 (schema.sql):
--   · INSERT on flows      → admin only
--   · INSERT on evaluations / criteria / evaluators
--                          → admin + evaluador
--   · SELECT               → unchanged (all authenticated users)
--   · UPDATE / DELETE      → still blocked (no policies = denied)
--
-- Role is stored in user_metadata.role (set by the user on first
-- login via the RoleSelector screen in the React app).
-- The JWT is refreshed after updateUser(), so RLS checks reflect
-- the new role on the very next request.
--
-- ⚠️  Production note: for stronger security, move roles to
--     app_metadata (writable only via service-role key) and update
--     the helper expression below accordingly.
-- ================================================================

-- ── Helper expression used in every role-based policy ────────────────────────
-- (auth.jwt() -> 'user_metadata' ->> 'role')
-- Returns the role string from the JWT claim, or NULL if not set.


-- ── Drop old unrestricted INSERT policies (from schema.sql) ──────────────────

DROP POLICY IF EXISTS "flows: authenticated users can insert"              ON flows;
DROP POLICY IF EXISTS "evaluations: authenticated users can insert"        ON evaluations;
DROP POLICY IF EXISTS "evaluation_criteria: authenticated users can insert" ON evaluation_criteria;
DROP POLICY IF EXISTS "evaluation_evaluators: authenticated users can insert" ON evaluation_evaluators;


-- ── flows: only admins can create new flows ───────────────────────────────────

CREATE POLICY "flows: admins can insert"
  ON flows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );


-- ── evaluations: admins + evaluadores ────────────────────────────────────────

CREATE POLICY "evaluations: admins and evaluadores can insert"
  ON evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'evaluador')
  );

-- evaluation_criteria and evaluation_evaluators are always written
-- as part of the same RPC transaction — they follow the same rule.

CREATE POLICY "evaluation_criteria: admins and evaluadores can insert"
  ON evaluation_criteria
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'evaluador')
  );

CREATE POLICY "evaluation_evaluators: admins and evaluadores can insert"
  ON evaluation_evaluators
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'evaluador')
  );


-- ── SELECT policies (unchanged — all authenticated roles can read) ────────────
-- These were created in schema.sql; no changes needed.


-- ── UPDATE / DELETE — still blocked ──────────────────────────────────────────
-- Intentionally no UPDATE or DELETE policies exist.  Any attempt by an
-- authenticated client returns a PostgreSQL RLS error.  This is the
-- primary enforcement layer for the append-only business rule.


-- ================================================================
-- save_evaluation (v2): add role check inside SECURITY DEFINER fn
-- ================================================================
-- Because the function uses SECURITY DEFINER it bypasses table-level
-- RLS, so we must validate the caller's role explicitly.

CREATE OR REPLACE FUNCTION save_evaluation(
  p_flow_id       UUID,
  p_overall_score NUMERIC,
  p_notes         TEXT,
  p_evaluator_ids UUID[],
  p_criteria      JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_evaluation_id UUID;
BEGIN
  -- 1. Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PT401';
  END IF;

  -- 2. Must be admin or evaluador  (SECURITY DEFINER bypasses RLS so we
  --    enforce the role constraint here instead of relying on table policies)
  v_caller_role := (auth.jwt() -> 'user_metadata' ->> 'role');

  IF v_caller_role NOT IN ('admin', 'evaluador') THEN
    RAISE EXCEPTION 'Insufficient permissions: evaluador or admin role required'
      USING ERRCODE = 'PT403';
  END IF;

  -- 3. Criteria must be non-empty
  IF p_criteria IS NULL OR jsonb_array_length(p_criteria) = 0 THEN
    RAISE EXCEPTION 'At least one criterion is required' USING ERRCODE = 'PT400';
  END IF;

  -- 4. Insert parent evaluation row (append-only — no UPDATE path exists)
  INSERT INTO evaluations (flow_id, overall_score, notes)
  VALUES (p_flow_id, p_overall_score, NULLIF(trim(COALESCE(p_notes, '')), ''))
  RETURNING id INTO v_evaluation_id;

  -- 5. One row per criterion score
  INSERT INTO evaluation_criteria (evaluation_id, criterion_id, score, weight)
  SELECT
    v_evaluation_id,
    (c ->> 'criterion_id')::INTEGER,
    (c ->> 'score')::INTEGER,
    (c ->> 'weight')::INTEGER
  FROM jsonb_array_elements(p_criteria) AS c;

  -- 6. Evaluators (skip when array is NULL or empty)
  IF p_evaluator_ids IS NOT NULL AND array_length(p_evaluator_ids, 1) > 0 THEN
    INSERT INTO evaluation_evaluators (evaluation_id, user_id)
    SELECT v_evaluation_id, uid
    FROM unnest(p_evaluator_ids) AS uid;
  END IF;

  RETURN v_evaluation_id;
END;
$$;

-- Grant is idempotent — safe to re-run
GRANT EXECUTE ON FUNCTION save_evaluation(UUID, NUMERIC, TEXT, UUID[], JSONB)
  TO authenticated;
