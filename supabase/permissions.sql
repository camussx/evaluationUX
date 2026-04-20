-- ================================================================
-- Permissions v1: profiles + flow_evaluator_permissions
-- ================================================================
-- Run AFTER schema.sql and rls_v2.sql.
--
-- What this adds:
--   · profiles                   – client-queryable mirror of auth.users
--                                  (id, email, role); upserted by the React
--                                  app on every login via AuthProvider.
--   · flow_evaluator_permissions – (flow_id, user_id) pairs; admin can
--                                  INSERT / DELETE; all authenticated can SELECT.
--   · save_evaluation (v3)       – adds a per-flow permission check for the
--                                  'evaluador' role before allowing an INSERT.
-- ================================================================


-- ── profiles ──────────────────────────────────────────────────────────────────
-- Mirrors auth.users so the React client can list users without needing the
-- service-role key.  The AuthProvider upserts a row after every session change.

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  role       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: authenticated users can read all"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles: users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());


-- ── flow_evaluator_permissions ────────────────────────────────────────────────
-- Stores which evaluadores are authorised to evaluate which flows.
-- Admins bypass this check inside save_evaluation (v3 below).

CREATE TABLE IF NOT EXISTS flow_evaluator_permissions (
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (flow_id, user_id)
);

CREATE INDEX idx_flow_eval_perms_user_id
  ON flow_evaluator_permissions (user_id);

ALTER TABLE flow_evaluator_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flow_perms: authenticated users can read"
  ON flow_evaluator_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "flow_perms: admin can insert"
  ON flow_evaluator_permissions FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "flow_perms: admin can delete"
  ON flow_evaluator_permissions FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );


-- ================================================================
-- save_evaluation (v3): add flow permission check for evaluadores
-- ================================================================
-- Replaces the v2 function from rls_v2.sql.
-- SECURITY DEFINER bypasses table-level RLS, so all role and
-- permission checks are enforced here explicitly.

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

  -- 2. Must be admin or evaluador
  v_caller_role := (auth.jwt() -> 'user_metadata' ->> 'role');
  IF v_caller_role NOT IN ('admin', 'evaluador') THEN
    RAISE EXCEPTION 'Insufficient permissions: evaluador or admin role required'
      USING ERRCODE = 'PT403';
  END IF;

  -- 3. Evaluadores must be assigned to the target flow
  IF v_caller_role = 'evaluador' THEN
    IF NOT EXISTS (
      SELECT 1 FROM flow_evaluator_permissions
      WHERE flow_id = p_flow_id
        AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Evaluador does not have permission for this flow'
        USING ERRCODE = 'PT403';
    END IF;
  END IF;

  -- 4. Criteria must be non-empty
  IF p_criteria IS NULL OR jsonb_array_length(p_criteria) = 0 THEN
    RAISE EXCEPTION 'At least one criterion is required' USING ERRCODE = 'PT400';
  END IF;

  -- 5. Insert parent evaluation row (append-only)
  INSERT INTO evaluations (flow_id, overall_score, notes)
  VALUES (p_flow_id, p_overall_score, NULLIF(trim(COALESCE(p_notes, '')), ''))
  RETURNING id INTO v_evaluation_id;

  -- 6. One row per criterion score
  INSERT INTO evaluation_criteria (evaluation_id, criterion_id, score, weight)
  SELECT
    v_evaluation_id,
    (c ->> 'criterion_id')::INTEGER,
    (c ->> 'score')::INTEGER,
    (c ->> 'weight')::INTEGER
  FROM jsonb_array_elements(p_criteria) AS c;

  -- 7. Evaluators (skip when empty)
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
