import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CRITERIA } from '../data/criteria'
import { getScoreColor, getScoreBg, calcWeightedScore } from '../utils/scoring'
import { useAuth } from '../hooks/useAuth'
import { saveEvaluation } from '../hooks/useEvaluations'

// ── EvaluarPage ───────────────────────────────────────────────────────────────
//
// Ruta: /flujos/:id/evaluar
// Muestra los 10 criterios con descripción y escala 1-5-10.
// Guarda habilitado solo cuando los 10 tienen score asignado.

const SCALE_COLORS = {
  s1:  '#DC2626',
  s5:  '#B45309',
  s10: '#059669',
}

const SCALE_LABELS = {
  s1:  { score: 1,  label: 'Falla crítica'    },
  s5:  { score: 5,  label: 'Funcional básico' },
  s10: { score: 10, label: 'Excelencia UX'    },
}

export default function EvaluarPage() {
  const { id: flowId } = useParams()
  const navigate        = useNavigate()
  const { user }        = useAuth()

  // ── Guard: CRITERIA debe tener 10 elementos ───────────────────────────────
  if (!Array.isArray(CRITERIA) || CRITERIA.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-danger text-[14px] mb-4">
          Error: no se pudieron cargar los criterios de evaluación.
        </p>
        <button onClick={() => navigate(-1)} className="text-accent text-[13px] hover:underline">
          ← Volver
        </button>
      </div>
    )
  }

  // ── Guard: flowId requerido ───────────────────────────────────────────────
  if (!flowId) {
    return (
      <div className="text-center py-20">
        <p className="text-[14px] text-text-secondary mb-6">
          No se encontró el flujo. Selecciona uno desde la lista.
        </p>
        <button
          onClick={() => navigate('/flujos')}
          className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg"
        >
          Ver flujos →
        </button>
      </div>
    )
  }

  return <EvaluarForm flowId={flowId} navigate={navigate} user={user} />
}

// ── EvaluarForm (inner component so guards run before hooks) ──────────────────

function EvaluarForm({ flowId, navigate, user }) {
  const storageKey = `ux_eval_${flowId}`

  // ── State ─────────────────────────────────────────────────────────────────
  const [scores,      setScores]      = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') }
    catch { return {} }
  })
  const [notes,       setNotes]       = useState('')
  const [saveStatus,  setSaveStatus]  = useState('idle')  // idle|saving|saved|error
  const [saveError,   setSaveError]   = useState('')
  const [flow,        setFlow]        = useState(null)
  const [flowLoading, setFlowLoading] = useState(true)
  const [flowError,   setFlowError]   = useState(false)

  // ── Load flow ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setFlowLoading(true)
    setFlowError(false)

    supabase
      .from('flows')
      .select('id, name, product')
      .eq('id', flowId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setFlowError(true)
        } else {
          setFlow(data)
        }
        setFlowLoading(false)
      })

    return () => { cancelled = true }
  }, [flowId])

  // ── Persist scores to localStorage ───────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(scores))
    } catch { /* storage full or disabled — non-fatal */ }
  }, [scores, storageKey])

  // ── Derived state ─────────────────────────────────────────────────────────
  const answered  = CRITERIA.filter(c => scores[c.id] != null).length
  const allScored = answered === CRITERIA.length
  const adjScore  = calcWeightedScore(scores, CRITERIA)
  const sc        = adjScore ? getScoreColor(parseFloat(adjScore)) : '#6B7280'
  const sb        = adjScore ? getScoreBg(parseFloat(adjScore))    : 'rgba(107,114,128,0.08)'

  // ── Navigation guard (beforeunload only — useBlocker requires data router) ──
  useEffect(() => {
    const handler = (e) => {
      if (answered === 0 || saveStatus === 'saved') return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [answered, saveStatus])

  // ── Actions ───────────────────────────────────────────────────────────────
  function setScore(criterionId, n) {
    setScores(prev => ({ ...prev, [criterionId]: n }))
    if (saveStatus !== 'idle') setSaveStatus('idle')
  }

  function reset() {
    if (!window.confirm('¿Reiniciar toda la evaluación? Los datos no guardados se perderán.')) return
    setScores({})
    setNotes('')
    setSaveStatus('idle')
    setSaveError('')
    try { localStorage.removeItem(storageKey) } catch { /* non-fatal */ }
  }

  async function handleSave() {
    if (!flowId || !allScored || saveStatus === 'saving') return
    setSaveStatus('saving')
    setSaveError('')
    try {
      await saveEvaluation(flowId, scores, user?.id ? [user.id] : [], notes)
      setSaveStatus('saved')
      try { localStorage.removeItem(storageKey) } catch { /* non-fatal */ }
    } catch (err) {
      setSaveError(err.message || 'Error al guardar. Intenta de nuevo.')
      setSaveStatus('error')
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (flowLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {/* Breadcrumb skeleton */}
        <div className="h-3 w-48 bg-background-elevated rounded" />
        {/* Header skeleton */}
        <div className="h-6 w-56 bg-background-elevated rounded" />
        <div className="h-4 w-40 bg-background-elevated rounded" />
        {/* Criteria skeletons */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-background-surface border border-border-default rounded-xl p-5">
            <div className="h-4 w-48 bg-background-elevated rounded mb-3" />
            <div className="h-3 w-full bg-background-elevated rounded mb-2" />
            <div className="h-3 w-3/4 bg-background-elevated rounded mb-4" />
            <div className="flex gap-2">
              {Array.from({ length: 10 }).map((_, j) => (
                <div key={j} className="w-9 h-9 bg-background-elevated rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Flow not found ────────────────────────────────────────────────────────
  if (flowError || !flow) {
    return (
      <div className="text-center py-20">
        <p className="text-[14px] text-danger mb-2">No se encontró el flujo solicitado.</p>
        <p className="text-[13px] text-text-hint mb-6">
          Puede que haya sido eliminado o que el enlace sea incorrecto.
        </p>
        <button
          onClick={() => navigate('/flujos')}
          className="text-accent text-[13px] hover:underline"
        >
          ← Volver a flujos
        </button>
      </div>
    )
  }

  // ── Saved confirmation ────────────────────────────────────────────────────
  if (saveStatus === 'saved') {
    return (
      <div>
        <Breadcrumb navigate={navigate} flowId={flowId} flowName={flow.name} last={null} />
        <div className="bg-background-surface border border-border-default rounded-xl p-10 text-center max-w-lg mx-auto mt-8">
          <div className="text-5xl mb-5">✅</div>
          <h2 className="text-[20px] font-bold text-text-primary mb-2">Evaluación guardada</h2>
          <p className="text-[14px] text-text-secondary mb-6">
            El score fue registrado en el historial de{' '}
            <strong className="text-text-primary">{flow.name}</strong>.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => navigate(`/flujos/${flowId}`)}
              className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              Ver historial
            </button>
            <button
              onClick={() => { setScores({}); setNotes(''); setSaveStatus('idle') }}
              className="px-5 py-2.5 border border-border-default text-[13px] text-text-secondary rounded-lg hover:border-text-hint transition-colors"
            >
              Nueva evaluación
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main evaluation form ──────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb
        navigate={navigate}
        flowId={flowId}
        flowName={flow.name}
        last="Nueva evaluación"
      />

      {/* Progress header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary mb-1">
            Evaluación — {flow.name}
          </h1>
          <p className="text-[13px] text-text-secondary">
            {answered} de {CRITERIA.length} criterios completados
            {!allScored && answered > 0 && ` · Faltan ${CRITERIA.length - answered}`}
          </p>
        </div>

        {adjScore && (
          <div
            className="text-center px-5 py-3 rounded-xl border-2 flex-shrink-0"
            style={{ borderColor: sc, background: sb }}
          >
            <div className="font-mono text-[32px] font-bold leading-none" style={{ color: sc }}>
              {adjScore}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: sc }}>
              Score parcial
            </div>
          </div>
        )}
      </div>

      {/* Mobile notice */}
      <div
        className="md:hidden mb-5 flex items-start gap-2.5 px-4 py-3 rounded-lg border text-[13px] leading-snug"
        style={{ background: '#EEEEF9', borderColor: '#BBBDE8', color: '#5B5FC7' }}
      >
        <span className="flex-shrink-0">💡</span>
        <span>Para una mejor experiencia de evaluación, te recomendamos un dispositivo de escritorio.</span>
      </div>

      {/* Criteria cards */}
      <div className="space-y-4 mb-6">
        {CRITERIA.map(c => {
          const currentScore = scores[c.id]
          const scoreColor   = currentScore != null ? getScoreColor(currentScore) : null

          return (
            <div
              key={c.id}
              className="bg-background-surface border border-border-default rounded-xl overflow-hidden transition-colors duration-150"
              style={scoreColor ? { borderColor: `${scoreColor}40` } : {}}
            >
              {/* Header */}
              <div className="flex items-start gap-3 px-5 pt-5 pb-3">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold text-white font-mono flex-shrink-0 mt-0.5"
                  style={{ background: c.color }}
                >
                  {String(c.id).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-text-primary">{c.name}</h3>
                    <span className="text-[11px] text-text-hint">· Peso {c.weight}%</span>
                    {currentScore != null && (
                      <span
                        className="font-mono text-[12px] font-bold px-2 py-0.5 rounded border ml-auto"
                        style={{
                          color:       scoreColor,
                          background:  getScoreBg(currentScore),
                          borderColor: scoreColor,
                        }}
                      >
                        {currentScore}/10
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-secondary leading-relaxed mt-1">
                    {c.description}
                  </p>
                </div>
              </div>

              {/* Scale reference cards (1 / 5 / 10) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 pb-4">
                {['s1', 's5', 's10'].map(key => {
                  const meta  = SCALE_LABELS[key]
                  const color = SCALE_COLORS[key]
                  return (
                    <div
                      key={key}
                      className="rounded-lg p-3 border"
                      style={{ background: `${color}0D`, borderColor: `${color}30` }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.5px]"
                          style={{ color }}
                        >
                          {meta.label}
                        </span>
                        <span className="font-mono text-[16px] font-bold" style={{ color }}>
                          {meta.score}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-[1.5]">
                        {c[key]}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Score buttons 1–10 */}
              <div className="flex flex-wrap gap-1.5 px-5 pb-5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
                  const active = currentScore === n
                  return (
                    <button
                      key={n}
                      onClick={() => setScore(c.id, n)}
                      aria-label={`Puntaje ${n} para ${c.name}`}
                      aria-pressed={active}
                      className="w-9 h-9 rounded-lg border text-[13px] font-bold font-mono transition-all duration-100 focus:outline-none"
                      style={
                        active
                          ? { background: c.color, borderColor: c.color, color: '#fff' }
                          : { background: '#F8F9FC', borderColor: '#E5E7EB', color: '#6B7280' }
                      }
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Notes (visible once at least one criterion is scored) */}
      {answered > 0 && (
        <div className="mb-5 bg-background-surface border border-border-default rounded-xl p-5">
          <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observaciones, hallazgos clave, contexto de la evaluación…"
            rows={3}
            className="w-full bg-background-elevated border border-border-default rounded-lg px-3.5 py-2.5 text-[13px] text-text-primary placeholder:text-text-hint focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>
      )}

      {/* Save bar */}
      <div className="bg-background-surface border border-border-default rounded-xl p-4 flex items-center gap-4 flex-wrap sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={!allScored || saveStatus === 'saving'}
          title={
            !allScored
              ? `Califica los ${CRITERIA.length - answered} criterios restantes para guardar`
              : ''
          }
          className="px-6 py-2.5 bg-accent text-background-base text-[14px] font-bold rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saveStatus === 'saving' ? 'Guardando…' : 'Guardar evaluación'}
        </button>

        <span className="text-[13px] text-text-hint">
          {allScored
            ? 'Todos los criterios completados.'
            : answered === 0
              ? 'Califica todos los criterios para habilitar el guardado.'
              : `${CRITERIA.length - answered} criterio${CRITERIA.length - answered !== 1 ? 's' : ''} sin calificar`}
        </span>

        {answered > 0 && (
          <button
            onClick={reset}
            className="ml-auto text-[12px] text-text-hint border border-border-default rounded-lg px-4 py-2 hover:text-danger hover:border-danger/50 transition-colors"
          >
            ↺ Reiniciar
          </button>
        )}
      </div>

      {/* Save error */}
      {saveStatus === 'error' && (
        <p className="mt-3 text-[13px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
          {saveError || 'Error al guardar. Verifica tu conexión e intenta de nuevo.'}
        </p>
      )}
    </div>
  )
}

// ── Breadcrumb helper ─────────────────────────────────────────────────────────

function Breadcrumb({ navigate, flowId, flowName, last }) {
  return (
    <nav className="flex items-center gap-2 text-[12px] text-text-hint mb-5 flex-wrap">
      <button onClick={() => navigate('/')} className="hover:text-accent transition-colors">
        Dashboard
      </button>
      <span>/</span>
      <button onClick={() => navigate('/flujos')} className="hover:text-accent transition-colors">
        Flujos
      </button>
      <span>/</span>
      <button
        onClick={() => navigate(`/flujos/${flowId}`)}
        className="hover:text-accent transition-colors truncate max-w-[160px]"
      >
        {flowName}
      </button>
      {last && (
        <>
          <span>/</span>
          <span className="text-text-secondary">{last}</span>
        </>
      )}
    </nav>
  )
}
