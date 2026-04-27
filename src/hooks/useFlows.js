import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Return the most recent evaluation from a flow's nested evaluations array. */
export function getLatestEval(evaluations = []) {
  if (!evaluations.length) return null
  return [...evaluations].sort(
    (a, b) => new Date(b.evaluated_at) - new Date(a.evaluated_at)
  )[0]
}

/** Attach lastScore, lastEvaluatedAt, evalCount and avgScore to each flow. */
export function enrichFlows(flows) {
  return flows.map(f => {
    const evals  = f.evaluations ?? []
    const latest = getLatestEval(evals)
    const evalCount = evals.length
    const avgScore  = evalCount > 0
      ? (evals.reduce((s, e) => s + parseFloat(e.overall_score), 0) / evalCount).toFixed(1)
      : null
    return {
      ...f,
      lastScore:      latest?.overall_score ?? null,
      lastEvaluatedAt: latest?.evaluated_at ?? null,
      evalCount,
      avgScore,
    }
  })
}

// ── useFlows ─────────────────────────────────────────────────────────────────

/**
 * useFlows() → { flows, loading, error, createFlow, refresh }
 *
 * `flows` is enriched with `lastScore` and `lastEvaluatedAt` derived
 * from the nested `evaluations` relation so the list can show at-a-glance
 * scores without a second query.
 */
export function useFlows() {
  const [flows, setFlows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('flows')
      .select('*, evaluations(overall_score, evaluated_at)')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
    } else {
      setFlows(enrichFlows(data ?? []))
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  /**
   * createFlow({ name, product?, description? }) → flow record
   * Optimistically prepends the new flow to the list.
   * Throws on Supabase error so the caller can surface it.
   */
  const createFlow = useCallback(async ({ name, product, description }) => {
    const { data, error: err } = await supabase
      .from('flows')
      .insert({
        name:        name.trim(),
        product:     product?.trim()     || null,
        description: description?.trim() || null,
      })
      .select('*, evaluations(overall_score, evaluated_at)')
      .single()

    if (err) throw err

    const enriched = enrichFlows([data])[0]
    setFlows(prev => [enriched, ...prev])
    return enriched
  }, [])

  return { flows, loading, error, createFlow, refresh }
}

// ── useFlow ──────────────────────────────────────────────────────────────────

/**
 * useFlow(id) → { flow, evaluations, loading, error }
 *
 * Evaluations are ordered oldest→newest (ascending) so a chart can
 * render them left-to-right without reversing.  The history table
 * can call [...evaluations].reverse() for newest-first display.
 */
export function useFlow(id) {
  const [flow, setFlow]           = useState(null)
  const [evaluations, setEvals]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const [flowRes, evalsRes] = await Promise.all([
        supabase
          .from('flows')
          .select('*')
          .eq('id', id)
          .single(),

        supabase
          .from('evaluations')
          .select(`
            *,
            evaluation_criteria (*),
            evaluation_evaluators (user_id)
          `)
          .eq('flow_id', id)
          .order('evaluated_at', { ascending: true }),  // oldest→newest for chart
      ])

      if (cancelled) return

      if (flowRes.error) setError(flowRes.error)
      else               setFlow(flowRes.data)

      if (!evalsRes.error) setEvals(evalsRes.data ?? [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [id])

  return { flow, evaluations, loading, error }
}
