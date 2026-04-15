import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CRITERIA } from '../data/criteria'

// ── useEvaluations ───────────────────────────────────────────────────────────

/**
 * useEvaluations(flowId) → { evaluations, loading, refresh }
 *
 * Evaluations are ordered newest-first for table display.
 * READ ONLY — no mutation methods are exposed from this hook.
 */
export function useEvaluations(flowId) {
  const [evaluations, setEvaluations] = useState([])
  const [loading, setLoading]         = useState(true)

  const refresh = useCallback(async () => {
    if (!flowId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('evaluations')
      .select(`
        *,
        evaluation_criteria (*),
        evaluation_evaluators (user_id)
      `)
      .eq('flow_id', flowId)
      .order('evaluated_at', { ascending: false })

    if (!error) setEvaluations(data ?? [])
    setLoading(false)
  }, [flowId])

  useEffect(() => { refresh() }, [refresh])

  return { evaluations, loading, refresh }
}

// ── saveEvaluation ───────────────────────────────────────────────────────────

/**
 * saveEvaluation(flowId, scores, evaluatorIds, notes) → Promise<UUID>
 *
 * @param {string}   flowId        - UUID of the flow being evaluated
 * @param {Object}   scores        - { [criterionId]: number (1-10) }
 * @param {string[]} evaluatorIds  - array of user UUIDs (may be empty)
 * @param {string}   notes         - free-text notes (may be empty)
 *
 * Calculates the weighted overall_score internally from the answered
 * criteria and the weights defined in CRITERIA.
 *
 * Delegates all DB writes to the `save_evaluation` Postgres function via
 * supabase.rpc(), which guarantees a single atomic transaction.
 *
 * NEVER updates existing rows — the RPC function only does INSERT.
 */
export async function saveEvaluation(flowId, scores, evaluatorIds = [], notes = '') {
  // Only consider criteria that have been scored
  const answered = CRITERIA.filter(c => scores[c.id] != null)

  if (!answered.length) {
    throw new Error('Debe calificar al menos un criterio antes de guardar.')
  }

  // Weighted overall score  (same formula used in the interactive evaluator)
  const totalWeight  = answered.reduce((sum, c) => sum + c.weight, 0)
  const weightedSum  = answered.reduce((sum, c) => sum + scores[c.id] * c.weight, 0)
  const overallScore = +(weightedSum / totalWeight).toFixed(2)

  const criteriaPayload = answered.map(c => ({
    criterion_id: c.id,
    score:        scores[c.id],
    weight:       c.weight,
  }))

  const { data, error } = await supabase.rpc('save_evaluation', {
    p_flow_id:       flowId,
    p_overall_score: overallScore,
    p_notes:         notes?.trim() || null,
    p_evaluator_ids: evaluatorIds,
    p_criteria:      criteriaPayload,
  })

  if (error) throw error

  // data is the new evaluation UUID returned by the Postgres function
  return data
}
