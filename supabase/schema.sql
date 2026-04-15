-- ================================================================
-- UX Evaluation Framework – Supabase Schema
-- ================================================================
-- Design rules (enforced at DB level, not only in the client):
--   · Evaluations are append-only — no UPDATE, no DELETE from any
--     authenticated client (RLS blocks both operations).
--   · evaluation_criteria / evaluation_evaluators are child rows
--     that live and die with their parent evaluation; the ON DELETE
--     CASCADE is present but is only reachable by a service-role
--     call, never from an authenticated browser session.
-- ================================================================


-- ── TABLES ──────────────────────────────────────────────────────

-- Flows: the feature / user-journey being evaluated
CREATE TABLE flows (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  product     TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES auth.users(id)
);

-- Evaluations: one record per evaluation session (append-only)
CREATE TABLE evaluations (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id       UUID         NOT NULL REFERENCES flows(id),
  overall_score NUMERIC(4,2) NOT NULL CHECK (overall_score BETWEEN 1 AND 10),
  notes         TEXT,
  evaluated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Individual criterion scores for each evaluation
CREATE TABLE evaluation_criteria (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID    NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_id  INTEGER NOT NULL CHECK (criterion_id BETWEEN 1 AND 10),
  score         INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  weight        INTEGER NOT NULL CHECK (weight > 0),
  -- One row per criterion per evaluation
  UNIQUE (evaluation_id, criterion_id)
);

-- Many-to-many: which users participated in each evaluation
CREATE TABLE evaluation_evaluators (
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (evaluation_id, user_id)
);


-- ── INDEXES ─────────────────────────────────────────────────────

-- Most common query: all evaluations for a specific flow
CREATE INDEX idx_evaluations_flow_id
  ON evaluations (flow_id);

-- History views always sort / filter by date
CREATE INDEX idx_evaluations_evaluated_at
  ON evaluations (evaluated_at DESC);

-- Loading all criteria for a given evaluation
CREATE INDEX idx_eval_criteria_eval_id
  ON evaluation_criteria (evaluation_id);

-- "Evaluations I participated in"
CREATE INDEX idx_eval_evaluators_user_id
  ON evaluation_evaluators (user_id);

-- Flows created by a user
CREATE INDEX idx_flows_created_by
  ON flows (created_by);


-- ── VIEW ────────────────────────────────────────────────────────
-- security_invoker = true → the view runs with the caller's
-- permissions, so RLS on the underlying tables is respected.

CREATE VIEW flow_evaluation_history
  WITH (security_invoker = true)
AS
SELECT
  e.id,
  e.flow_id,
  f.name            AS flow_name,
  e.overall_score,
  e.evaluated_at,
  e.notes,
  ARRAY_AGG(eu.user_id) FILTER (WHERE eu.user_id IS NOT NULL)
                    AS evaluator_ids
FROM evaluations e
JOIN  flows                 f  ON f.id  = e.flow_id
LEFT JOIN evaluation_evaluators eu ON eu.evaluation_id = e.id
GROUP BY e.id, e.flow_id, f.name, e.overall_score, e.evaluated_at, e.notes
ORDER BY e.evaluated_at DESC;


-- ── ROW LEVEL SECURITY ──────────────────────────────────────────
-- Strategy:
--   SELECT  → any authenticated user can read all rows
--   INSERT  → any authenticated user can insert
--   UPDATE  → no policy → denied for all clients  ✓
--   DELETE  → no policy → denied for all clients  ✓
--
-- The absence of an UPDATE / DELETE policy is intentional and
-- sufficient: when RLS is enabled, PostgreSQL denies any operation
-- that has no matching policy.

ALTER TABLE flows                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_criteria   ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_evaluators ENABLE ROW LEVEL SECURITY;

-- ── SELECT policies ─────────────────────────────────────────────

CREATE POLICY "flows: authenticated users can read"
  ON flows
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "evaluations: authenticated users can read"
  ON evaluations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "evaluation_criteria: authenticated users can read"
  ON evaluation_criteria
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "evaluation_evaluators: authenticated users can read"
  ON evaluation_evaluators
  FOR SELECT
  TO authenticated
  USING (true);

-- ── INSERT policies ─────────────────────────────────────────────

CREATE POLICY "flows: authenticated users can insert"
  ON flows
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "evaluations: authenticated users can insert"
  ON evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- evaluation_criteria and evaluation_evaluators are always written
-- as part of the same transaction that creates an evaluation.
CREATE POLICY "evaluation_criteria: authenticated users can insert"
  ON evaluation_criteria
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "evaluation_evaluators: authenticated users can insert"
  ON evaluation_evaluators
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── No UPDATE or DELETE policies ────────────────────────────────
-- Omitting them is not an oversight — it is the enforcement
-- mechanism.  Any UPDATE or DELETE attempt from an authenticated
-- client will be rejected by PostgreSQL with:
--   ERROR: new row violates row-level security policy
-- The service-role key (used only server-side) bypasses RLS and
-- can still perform administrative operations if ever needed.
