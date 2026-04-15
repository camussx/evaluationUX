-- ================================================================
-- save_evaluation
-- ================================================================
-- Inserts an evaluation + its criteria + its evaluators atomically.
-- Called from the client via supabase.rpc('save_evaluation', { … })
-- Returns the UUID of the new evaluation row.
--
-- Security model:
--   SECURITY DEFINER  → runs as DB owner, so child-table inserts
--                       always succeed regardless of RLS on those tables.
--   auth.uid() check  → only authenticated callers can proceed.
--   SET search_path   → prevents search-path injection attacks.
-- ================================================================

CREATE OR REPLACE FUNCTION save_evaluation(
  p_flow_id       UUID,
  p_overall_score NUMERIC,
  p_notes         TEXT,
  p_evaluator_ids UUID[],
  p_criteria      JSONB         -- [{ criterion_id, score, weight }, …]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluation_id UUID;
BEGIN
  -- Only authenticated users may call this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PT401';
  END IF;

  -- Validate criteria is non-empty
  IF p_criteria IS NULL OR jsonb_array_length(p_criteria) = 0 THEN
    RAISE EXCEPTION 'At least one criterion is required' USING ERRCODE = 'PT400';
  END IF;

  -- 1. Parent evaluation row (append-only — no UPDATE path exists)
  INSERT INTO evaluations (flow_id, overall_score, notes)
  VALUES (p_flow_id, p_overall_score, NULLIF(trim(COALESCE(p_notes, '')), ''))
  RETURNING id INTO v_evaluation_id;

  -- 2. One row per criterion score
  INSERT INTO evaluation_criteria (evaluation_id, criterion_id, score, weight)
  SELECT
    v_evaluation_id,
    (c ->> 'criterion_id')::INTEGER,
    (c ->> 'score')::INTEGER,
    (c ->> 'weight')::INTEGER
  FROM jsonb_array_elements(p_criteria) AS c;

  -- 3. Evaluators (skip gracefully when array is NULL or empty)
  IF p_evaluator_ids IS NOT NULL AND array_length(p_evaluator_ids, 1) > 0 THEN
    INSERT INTO evaluation_evaluators (evaluation_id, user_id)
    SELECT v_evaluation_id, uid
    FROM unnest(p_evaluator_ids) AS uid;
  END IF;

  RETURN v_evaluation_id;
END;
$$;

-- Allow authenticated role to call this function
GRANT EXECUTE ON FUNCTION save_evaluation(UUID, NUMERIC, TEXT, UUID[], JSONB)
  TO authenticated;
