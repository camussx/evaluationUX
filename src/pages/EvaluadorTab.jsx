import { useState, useEffect } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CRITERIA } from '../data/criteria'
import { getScoreColor, getScoreBg, calcWeightedScore } from '../utils/scoring'
import { useAuth } from '../hooks/useAuth'
import { saveEvaluation } from '../hooks/useEvaluations'
import ScoreBadge from '../components/ScoreBadge'

// ── EvaluadorTab ──────────────────────────────────────────────────────────────
//
// Always mounted in the context of a flow: /flows/:id/evaluate
// Standalone /evaluador redirected to /flows in App.jsx.

export default function EvaluadorTab() {
  const { id: flowId } = useParams()
  const navigate        = useNavigate()
  const { user }        = useAuth()

  // ── Per-flow score persistence (localStorage) ─────────────────────────────
  const storageKey = `ux_scores_${flowId ?? 'standalone'}`

  const [scores,     setScores]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') }
    catch { return {} }
  })
  const [notes,      setNotes]      = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')   // idle | saving | saved | error
  const [saveError,  setSaveError]  = useState('')
  const [flow,       setFlow]       = useState(null)

  // ── Load flow metadata ────────────────────────────────────────────────────
  useEffect(() => {
    if (!flowId) return
    supabase.from('flows').select('id, name, product')
      .eq('id', flowId).single()
      .then(({ data }) => setFlow(data))
  }, [flowId])

  // ── Persist scores ────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(scores))
  }, [scores, storageKey])

  // ── Derived state ─────────────────────────────────────────────────────────
  const answered  = CRITERIA.filter(c => scores[c.id] != null).length
  const allScored = CRITERIA.every(c => scores[c.id] != null)
  const adjScore  = calcWeightedScore(scores, CRITERIA)
  const sc        = adjScore ? getScoreColor(parseFloat(adjScore)) : '#9CA3B8'
  const sb        = adjScore ? getScoreBg(parseFloat(adjScore))    : 'rgba(34,38,58,0.5)'

  // ── Navigation guard ──────────────────────────────────────────────────────
  const isDirty = answered > 0 && saveStatus !== 'saved'
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ── Actions ───────────────────────────────────────────────────────────────
  function setScore(id, n) {
    setScores(prev => ({ ...prev, [id]: n }))
    if (saveStatus !== 'idle') setSaveStatus('idle')
  }

  function reset() {
    if (!window.confirm('¿Reiniciar toda la evaluación? Los datos no guardados se perderán.')) return
    setScores({})
    setNotes('')
    setSaveStatus('idle')
    setSaveError('')
    localStorage.removeItem(storageKey)
  }

  async function handleSave() {
    if (!flowId || !allScored || saveStatus === 'saving') return
    setSaveStatus('saving')
    setSaveError('')
    try {
      await saveEvaluation(flowId, scores, user?.id ? [user.id] : [], notes)
      setSaveStatus('saved')
      localStorage.removeItem(storageKey)
    } catch (err) {
      setSaveError(err.message || 'Error al guardar. Intenta de nuevo.')
      setSaveStatus('error')
    }
  }

  // ── No flow context ───────────────────────────────────────────────────────
  if (!flowId) {
    return (
      <div className="text-center py-20">
        <p className="text-[16px] font-semibold text-text-primary mb-2">
          Selecciona un flujo para evaluar
        </p>
        <p className="text-[13px] text-text-secondary mb-6">
          Las evaluaciones siempre deben asociarse a un flujo registrado.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          Ver flujos →
        </button>
      </div>
    )
  }

  // ── Saved confirmation ────────────────────────────────────────────────────
  if (saveStatus === 'saved') {
    return (
      <div>
        <nav className="flex items-center gap-2 text-[12px] text-text-hint mb-5">
          <button onClick={() => navigate('/')} className="hover:text-accent transition-colors">Flujos</button>
          <span>/</span>
          <button onClick={() => navigate(`/flows/${flowId}`)} className="hover:text-accent transition-colors">
            {flow?.name ?? '…'}
          </button>
          <span>/</span>
          <span className="text-text-secondary">Evaluación guardada</span>
        </nav>

        <div className="bg-background-surface border border-border-default rounded-xl p-10 text-center">
          <div className="text-5xl mb-5">✅</div>
          <h2 className="text-[20px] font-bold text-text-primary mb-2">Evaluación guardada</h2>
          <p className="text-[14px] text-text-secondary mb-6">
            El score ha sido registrado en el historial de{' '}
            <strong className="text-text-primary">{flow?.name ?? 'este flujo'}</strong>.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => navigate(`/flows/${flowId}`)}
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

  // ── Main evaluator form ───────────────────────────────────────────────────
  return (
    <div>
      {/* ── Unsaved changes dialog (useBlocker) ──────────────────────────── */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => blocker.reset()} />
          <div className="relative bg-background-surface border border-border-default rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-[16px] font-bold text-text-primary mb-2">Cambios sin guardar</h3>
            <p className="text-[13px] text-text-secondary mb-5">
              Si sales ahora perderás las puntuaciones ingresadas. ¿Deseas continuar?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 py-2.5 border border-border-default rounded-lg text-[13px] text-text-secondary hover:border-text-hint transition-colors"
              >
                Seguir evaluando
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 py-2.5 bg-danger text-white rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-[12px] text-text-hint mb-5">
        <button onClick={() => navigate('/')} className="hover:text-accent transition-colors">Flujos</button>
        <span>/</span>
        <button onClick={() => navigate(`/flows/${flowId}`)} className="hover:text-accent transition-colors">
          {flow?.name ?? '…'}
        </button>
        <span>/</span>
        <span className="text-text-secondary">Nueva evaluación</span>
      </nav>

      {/* ── Mobile banner ───────────────────────────────────────────────── */}
      <div
        className="md:hidden mb-4 flex items-start gap-2.5 px-4 py-3 rounded-lg border text-[13px] leading-snug"
        style={{ background: 'rgba(147,180,250,0.08)', borderColor: '#93B4FA', color: '#93B4FA' }}
      >
        <span className="mt-px flex-shrink-0">💡</span>
        <span>Para una mejor experiencia de evaluación, te recomendamos usar un dispositivo de escritorio.</span>
      </div>

      {/* ── Evaluator card ───────────────────────────────────────────────── */}
      <div className="bg-background-surface border border-border-default rounded-[10px] p-4 md:p-6">

        {/* Top: title + live score */}
        <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-text-primary mb-1">Evaluación interactiva</h2>
            <p className="text-[13px] text-text-secondary">
              Califica de 1 a 10 · {answered}/{CRITERIA.length} criterios completados
            </p>
          </div>
          {adjScore && (
            <div
              className="text-center px-5 py-3.5 rounded-xl border-2 min-w-[140px] flex-shrink-0"
              style={{ borderColor: sc, background: sb }}
            >
              <div className="font-mono text-[36px] font-medium leading-none" style={{ color: sc }}>
                {adjScore}
              </div>
              <div className="text-[11px] font-bold tracking-wider uppercase mt-1" style={{ color: sc }}>
                Score Ponderado
              </div>
              <div className="text-[10px] text-text-hint mt-0.5">
                {answered}/{CRITERIA.length} evaluados
              </div>
            </div>
          )}
        </div>

        {/* Criteria rows */}
        {CRITERIA.map(c => (
          <div
            key={c.id}
            className="flex items-center gap-3 py-3 border-b border-border-default last:border-b-0 flex-wrap"
          >
            {/* Label */}
            <div className="flex items-center gap-2 min-w-[180px] flex-1">
              <div className="w-3 h-3 rounded-[3px] flex-shrink-0" style={{ background: c.color }} />
              <div>
                <div className="text-[13px] font-semibold text-text-primary">{c.name}</div>
                <div className="text-[11px] text-text-hint">Peso: {c.weight}%</div>
              </div>
            </div>

            {/* Score buttons 1–10 */}
            <div className="flex gap-1 flex-wrap">
              {[1,2,3,4,5,6,7,8,9,10].map(n => {
                const active = scores[c.id] === n
                return (
                  <button
                    key={n}
                    className="w-[30px] h-[30px] rounded-md border text-[12px] font-bold font-mono cursor-pointer transition-all duration-150 focus:outline-none"
                    style={
                      active
                        ? { background: c.color, borderColor: c.color, color: '#fff' }
                        : { background: '#22263A', borderColor: '#2E3347', color: '#9CA3B8' }
                    }
                    onClick={() => setScore(c.id, n)}
                    aria-label={`Puntaje ${n} para ${c.name}`}
                    aria-pressed={active}
                  >
                    {n}
                  </button>
                )
              })}
            </div>

            {/* Current score badge */}
            {scores[c.id] && <ScoreBadge score={scores[c.id]} />}
          </div>
        ))}

        {/* Notes field */}
        {answered > 0 && (
          <div className="mt-5">
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observaciones, hallazgos clave, contexto de la evaluación…"
              rows={3}
              className="w-full bg-background-elevated border border-border-default rounded-lg px-3.5 py-2.5 text-[13px] text-text-primary placeholder:text-text-hint focus:outline-none focus:border-accent transition-colors duration-150 resize-none"
            />
          </div>
        )}

        {/* Breakdown */}
        {answered > 0 && (
          <div className="mt-4 bg-background-elevated rounded-lg p-4 border border-border-default">
            <div className="text-[14px] font-bold text-text-primary mb-3">Desglose por criterio</div>
            {CRITERIA.filter(c => scores[c.id]).map(c => {
              const contrib = (scores[c.id] * c.weight) / 100
              return (
                <div
                  key={c.id}
                  className="flex justify-between items-center py-1.5 border-b border-border-default last:border-b-0 text-[12px]"
                >
                  <span className="text-text-secondary">{c.name}</span>
                  <span>
                    <span className="text-text-hint mr-2">{scores[c.id]} × {c.weight}% =</span>
                    <span className="font-bold font-mono" style={{ color: c.color }}>
                      {contrib.toFixed(2)} pts
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Save row */}
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={!allScored || saveStatus === 'saving'}
            className="px-6 py-2.5 bg-accent text-background-base text-[14px] font-bold rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            title={!allScored ? `Faltan ${CRITERIA.length - answered} criterios por calificar` : ''}
          >
            {saveStatus === 'saving' ? 'Guardando…' : 'Guardar evaluación'}
          </button>

          {!allScored && answered > 0 && (
            <span className="text-[12px] text-text-hint">
              Faltan {CRITERIA.length - answered} criterio{CRITERIA.length - answered !== 1 ? 's' : ''}
            </span>
          )}

          {answered === 0 && (
            <span className="text-[12px] text-text-hint">
              Califica todos los criterios para habilitar el guardado.
            </span>
          )}

          {answered > 0 && (
            <button
              className="ml-auto px-4 py-2 bg-transparent border border-border-default rounded text-[12px] text-text-hint cursor-pointer transition-all duration-150 hover:border-danger hover:text-danger focus:outline-none"
              onClick={reset}
            >
              ↺ Reiniciar
            </button>
          )}
        </div>

        {/* Error */}
        {saveStatus === 'error' && (
          <p className="mt-3 text-[12px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {saveError || 'Error al guardar. Intenta de nuevo.'}
          </p>
        )}
      </div>
    </div>
  )
}
