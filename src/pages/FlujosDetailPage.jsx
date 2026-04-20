import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFlow } from '../hooks/useFlows'
import { useAuth } from '../hooks/useAuth'
import { getScoreColor, getScoreBg } from '../utils/scoring'
import { CRITERIA } from '../data/criteria'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', opts) : '—'

const fmtShort = (iso) =>
  fmtDate(iso, { day: '2-digit', month: '2-digit', year: '2-digit' })

// ── Expandable evaluation row ─────────────────────────────────────────────────

function EvalRow({ evaluation, evaluatorProfiles }) {
  const [open, setOpen] = useState(false)

  const score     = parseFloat(evaluation.overall_score)
  const sc        = getScoreColor(score)
  const sb        = getScoreBg(score)
  const evaluators = evaluation.evaluation_evaluators ?? []

  // Build criteria rows sorted by id
  const criteriaRows = useMemo(() =>
    [...(evaluation.evaluation_criteria ?? [])]
      .sort((a, b) => a.criterion_id - b.criterion_id)
      .map(ec => ({
        ...ec,
        name:         CRITERIA.find(c => c.id === ec.criterion_id)?.name ?? `Criterio ${ec.criterion_id}`,
        color:        CRITERIA.find(c => c.id === ec.criterion_id)?.color ?? '#6B7280',
        contribution: (ec.score * ec.weight) / 100,
      }))
  , [evaluation.evaluation_criteria])

  // Get evaluator emails from profiles
  const evaluatorEmails = evaluators
    .map(e => evaluatorProfiles.find(p => p.id === e.user_id)?.email ?? e.user_id.slice(0, 8) + '…')

  return (
    <div className="border-b border-border-default last:border-b-0">
      {/* Summary row */}
      <div
        className="flex items-center gap-4 px-5 py-4 hover:bg-background-elevated/30 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        {/* Date */}
        <span className="text-[13px] text-text-secondary whitespace-nowrap w-28 flex-shrink-0">
          {fmtDate(evaluation.evaluated_at)}
        </span>

        {/* Score */}
        <span
          className="font-mono text-[13px] font-bold px-2 py-0.5 rounded border flex-shrink-0"
          style={{ color: sc, background: sb, borderColor: sc }}
        >
          {score.toFixed(2)}
        </span>

        {/* Evaluators */}
        <span className="text-[13px] text-text-secondary flex-1">
          {evaluators.length > 0
            ? `${evaluators.length} evaluador${evaluators.length !== 1 ? 'es' : ''}`
            : <span className="text-text-hint">Sin registro</span>}
        </span>

        {/* Toggle */}
        <span className="text-[12px] text-accent font-semibold flex-shrink-0">
          {open ? '▲ Cerrar' : '▼ Ver detalle'}
        </span>
      </div>

      {/* Detail panel */}
      {open && (
        <div className="px-5 pb-5 bg-background-elevated/20 border-t border-border-default">
          {/* Criteria table */}
          <div className="mt-4 bg-background-surface border border-border-default rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default bg-background-elevated/40">
                  <th className="text-left text-[11px] font-bold tracking-[1px] uppercase text-text-hint py-2.5 px-4 pl-5">
                    Criterio
                  </th>
                  <th className="text-left text-[11px] font-bold tracking-[1px] uppercase text-text-hint py-2.5 px-4">
                    Peso
                  </th>
                  <th className="text-left text-[11px] font-bold tracking-[1px] uppercase text-text-hint py-2.5 px-4">
                    Score
                  </th>
                  <th className="text-left text-[11px] font-bold tracking-[1px] uppercase text-text-hint py-2.5 px-4 pr-5">
                    Aporte
                  </th>
                </tr>
              </thead>
              <tbody>
                {criteriaRows.map(ec => {
                  const csc = getScoreColor(ec.score)
                  return (
                    <tr key={ec.criterion_id} className="border-b border-border-default last:border-b-0">
                      <td className="py-3 px-4 pl-5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: ec.color }} />
                          <span className="text-[13px] text-text-primary">{ec.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[13px] text-text-secondary font-mono">{ec.weight}%</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[13px] font-bold" style={{ color: csc }}>
                          {ec.score}/10
                        </span>
                      </td>
                      <td className="py-3 px-4 pr-5 font-mono text-[12px] text-text-hint">
                        {ec.contribution.toFixed(2)} pts
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Score final */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px] text-text-hint">Score final ponderado</span>
            <span className="font-mono text-[15px] font-bold" style={{ color: sc }}>
              {score.toFixed(2)}/10
            </span>
          </div>

          {/* Evaluators */}
          {evaluatorEmails.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-text-hint">Evaluadores:</span>
              {evaluatorEmails.map((email, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2.5 py-0.5 rounded-full bg-background-elevated border border-border-default text-text-secondary"
                >
                  {email}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {evaluation.notes && (
            <div className="mt-3 p-3 bg-background-elevated rounded-lg border border-border-default">
              <p className="text-[11px] font-semibold text-text-hint uppercase tracking-wider mb-1">Notas</p>
              <p className="text-[13px] text-text-secondary leading-relaxed">{evaluation.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── FlujosDetailPage ──────────────────────────────────────────────────────────

export default function FlujosDetailPage() {
  const { id }                               = useParams()
  const navigate                             = useNavigate()
  const { user, role }                       = useAuth()
  const { flow, evaluations, loading, error } = useFlow(id)

  const [canEvaluate,       setCanEvaluate]       = useState(false)
  const [evaluatorProfiles, setEvaluatorProfiles] = useState([])

  // ── Check if user can evaluate this flow ─────────────────────────────────
  useEffect(() => {
    if (!user || !role || !id) return
    if (role === 'admin') { setCanEvaluate(true); return }
    if (role !== 'evaluador') return

    supabase
      .from('flow_evaluator_permissions')
      .select('flow_id')
      .eq('flow_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setCanEvaluate(!!data))
  }, [user, role, id])

  // ── Load evaluator profiles for history display ───────────────────────────
  useEffect(() => {
    if (!evaluations.length) return
    const ids = [...new Set(
      evaluations.flatMap(e =>
        (e.evaluation_evaluators ?? []).map(ee => ee.user_id)
      )
    )]
    if (!ids.length) return

    supabase
      .from('profiles')
      .select('id, email')
      .in('id', ids)
      .then(({ data }) => setEvaluatorProfiles(data ?? []))
  }, [evaluations])

  // ── Computed: avg score across all evaluations ────────────────────────────
  const avgScore = useMemo(() => {
    if (!evaluations.length) return null
    const sum = evaluations.reduce((s, e) => s + parseFloat(e.overall_score), 0)
    return (sum / evaluations.length).toFixed(1)
  }, [evaluations])

  const avgColor = avgScore ? getScoreColor(parseFloat(avgScore)) : null
  const avgBg    = avgScore ? getScoreBg(parseFloat(avgScore))    : null

  // Newest first for history display
  const sortedEvals = useMemo(() =>
    [...evaluations].sort((a, b) =>
      new Date(b.evaluated_at) - new Date(a.evaluated_at)
    )
  , [evaluations])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-3 w-40 bg-background-elevated rounded" />
        <div className="h-8 w-64 bg-background-elevated rounded" />
        <div className="h-28 bg-background-surface border border-border-default rounded-xl" />
        <div className="h-48 bg-background-surface border border-border-default rounded-xl" />
      </div>
    )
  }

  // ── Error / not found ─────────────────────────────────────────────────────
  if (error || !flow) {
    return (
      <div className="text-center py-20">
        <p className="text-danger mb-4">{error?.message ?? 'Flujo no encontrado.'}</p>
        <Link to="/flujos" className="text-accent text-[13px] hover:underline">
          ← Volver a flujos
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12px] text-text-hint mb-5">
        <button onClick={() => navigate('/')} className="hover:text-accent transition-colors">
          Dashboard
        </button>
        <span>/</span>
        <button onClick={() => navigate('/flujos')} className="hover:text-accent transition-colors">
          Flujos
        </button>
        {flow.product && (
          <>
            <span>/</span>
            <span className="text-text-hint">{flow.product}</span>
          </>
        )}
        <span>/</span>
        <span className="text-text-secondary truncate max-w-[160px]">{flow.name}</span>
      </nav>

      {/* ── ZONA 1: Flow info ─────────────────────────────────────────────── */}
      <div className="bg-background-surface border border-border-default rounded-xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            {flow.product && (
              <p className="text-[11px] font-bold tracking-widest uppercase text-text-hint mb-1">
                {flow.product}
              </p>
            )}
            <h1 className="text-[22px] font-bold text-text-primary leading-tight mb-2">
              {flow.name}
            </h1>
            {flow.description && (
              <p className="text-[13px] text-text-secondary leading-relaxed mb-3 max-w-xl">
                {flow.description}
              </p>
            )}
            <p className="text-[12px] text-text-hint">
              Creado el {fmtDate(flow.created_at)}
            </p>
          </div>

          {/* Score + action */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {avgScore && (
              <div
                className="text-center px-4 py-3 rounded-xl border"
                style={{ borderColor: avgColor, background: avgBg }}
              >
                <div className="font-mono text-[28px] font-bold leading-none" style={{ color: avgColor }}>
                  {avgScore}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: avgColor }}>
                  Promedio
                </div>
                <div className="text-[10px] text-text-hint mt-0.5">
                  {evaluations.length} eval{evaluations.length !== 1 ? 's.' : '.'}
                </div>
              </div>
            )}

            {canEvaluate && (
              <button
                onClick={() => navigate(`/flujos/${id}/evaluar`)}
                className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                Nueva evaluación
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ZONA 2: Historial ─────────────────────────────────────────────── */}
      <div className="bg-background-surface border border-border-default rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <div>
            <h2 className="text-[15px] font-bold text-text-primary">Historial de evaluaciones</h2>
            <p className="text-[12px] text-text-hint mt-0.5">
              {evaluations.length} evaluación{evaluations.length !== 1 ? 'es' : ''} · Las evaluaciones son registros permanentes
            </p>
          </div>
          {/* Append-only lock indicator */}
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(147,180,250,0.08)', color: '#93B4FA' }}
          >
            🔒 Solo lectura
          </span>
        </div>

        {/* Column headers */}
        {evaluations.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border-default bg-background-elevated/30">
            <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-hint w-28 flex-shrink-0">Fecha</span>
            <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-hint flex-shrink-0">Score</span>
            <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-hint flex-1">Evaluadores</span>
            <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-hint flex-shrink-0">Detalle</span>
          </div>
        )}

        {/* Rows */}
        {sortedEvals.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-[14px] text-text-secondary font-semibold mb-1">Sin evaluaciones aún</p>
            <p className="text-[13px] text-text-hint mb-5">
              La primera evaluación marcará el punto de partida del historial.
            </p>
            {canEvaluate && (
              <button
                onClick={() => navigate(`/flujos/${id}/evaluar`)}
                className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                + Crear primera evaluación
              </button>
            )}
          </div>
        ) : (
          sortedEvals.map(ev => (
            <EvalRow
              key={ev.id}
              evaluation={ev}
              evaluatorProfiles={evaluatorProfiles}
            />
          ))
        )}
      </div>
    </div>
  )
}
