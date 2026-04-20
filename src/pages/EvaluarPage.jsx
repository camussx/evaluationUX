import { useState, useEffect } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CRITERIA } from '../data/criteria'
import { getScoreColor, getScoreBg, calcWeightedScore } from '../utils/scoring'
import { useAuth } from '../hooks/useAuth'
import { saveEvaluation } from '../hooks/useEvaluations'

// ── EvaluarPage ───────────────────────────────────────────────────────────────
//
// Ruta: /flujos/:id/evaluar
// Muestra los 10 criterios con descripción y escala 1-5-10.
// El botón "Guardar evaluación" se habilita cuando los 10 criterios tienen score.

const SCALE_COLORS = {
  s1:  '#F87171',
  s5:  '#FBBF24',
  s10: '#34D399',
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

  const storageKey = `ux_eval_${flowId}`

  const [scores,     setScores]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') }
    catch { return {} }
  })
  const [notes,      setNotes]      = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')  // idle | saving | saved | error
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const answered  = CRITERIA.filter(c => scores[c.id] != null).length
  const allScored = CRITERIA.every(c => scores[c.id] != null)
  const adjScore  = calcWeightedScore(scores, CRITERIA)
  const sc        = adjScore ? getScoreColor(parseFloat(adjScore)) : '#6B7280'
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

  // ── Saved confirmation ────────────────────────────────────────────────────
  if (saveStatus === 'saved') {
    return (
      <div>
        <nav className="flex items-center gap-2 text-[12px] text-text-hint mb-5">
          <button onClick={() => navigate('/')} className="hover:text-accent transition-colors">Dashboard</button>
          <span>/</span>
          <button onClick={() => navigate('/flujos')} className="hover:text-accent transition-colors">Flujos</button>
          <span>/</span>
          <button onClick={() => navigate(`/flujos/${flowId}`)} className="hover:text-accent transition-colors">
            {flow?.name ?? '…'}
          </button>
        </nav>

        <div className="bg-background-surface border border-border-default rounded-xl p-10 text-center max-w-lg mx-auto mt-8">
          <div className="text-5xl mb-5">✅</div>
          <h2 className="text-[20px] font-bold text-text-primary mb-2">Evaluación guardada</h2>
          <p className="text-[14px] text-text-secondary mb-6">
            El score fue registrado en el historial de{' '}
            <strong className="text-text-primary">{flow?.name ?? 'este flujo'}</strong>.
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

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Navigation guard dialog */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => blocker.reset()} />
          <div className="relative bg-background-surface border border-border-default rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-[16px] font-bold text-text-primary mb-2">Cambios sin guardar</h3>
            <p className="text-[13px] text-text-secondary mb-5">
              Si sales ahora perderás las puntuaciones ingresadas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 py-2.5 border border-border-default rounded-lg text-[13px] text-text-secondary hover:border-text-hint"
              >
                Seguir evaluando
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 py-2.5 bg-danger text-white rounded-lg text-[13px] font-bold hover:opacity-90"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12px] text-text-hint mb-5">
        <button onClick={() => navigate('/')} className="hover:text-accent transition-colors">Dashboard</button>
        <span>/</span>
        <button onClick={() => navigate('/flujos')} className="hover:text-accent transition-colors">Flujos</button>
        <span>/</span>
        <button onClick={() => navigate(`/flujos/${flowId}`)} className="hover:text-accent transition-colors">
          {flow?.name ?? '…'}
        </button>
        <span>/</span>
        <span className="text-text-secondary">Nueva evaluación</span>
      </nav>

      {/* Progress + live score */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary mb-1">Evaluación interactiva</h1>
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
        style={{ background: 'rgba(147,180,250,0.06)', borderColor: '#93B4FA', color: '#93B4FA' }}
      >
        <span className="flex-shrink-0">💡</span>
        <span>Para una mejor experiencia de evaluación, te recomendamos un dispositivo de escritorio.</span>
      </div>

      {/* Criteria cards */}
      <div className="space-y-4 mb-6">
        {CRITERIA.map(c => {
          const currentScore = scores[c.id]
          const scoreColor   = currentScore ? getScoreColor(currentScore) : null

          return (
            <div
              key={c.id}
              className="bg-background-surface border border-border-default rounded-xl overflow-hidden"
              style={currentScore ? { borderColor: `${getScoreColor(currentScore)}40` } : {}}
            >
              {/* Criterion header */}
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
                    {currentScore && (
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
                  <p className="text-[12px] text-text-secondary leading-relaxed mt-1">{c.description}</p>
                </div>
              </div>

              {/* Scale reference */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 pb-4">
                {(['s1', 's5', 's10']).map(key => {
                  const meta  = SCALE_LABELS[key]
                  const color = SCALE_COLORS[key]
                  return (
                    <div
                      key={key}
                      className="rounded-lg p-3 border"
                      style={{
                        background:  `${color}0D`,
                        borderColor: `${color}30`,
                      }}
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
                      <p className="text-[11px] text-text-secondary leading-[1.5]">{c[key]}</p>
                    </div>
                  )
                })}
              </div>

              {/* Score buttons */}
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
                          : { background: '#22263A', borderColor: '#2E3347', color: '#9CA3B8' }
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

      {/* Notes */}
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
      <div className="bg-background-surface border border-border-default rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <button
          onClick={handleSave}
          disabled={!allScored || saveStatus === 'saving'}
          title={!allScored ? `Califica los ${CRITERIA.length - answered} criterios restantes para guardar` : ''}
          className="px-6 py-2.5 bg-accent text-background-base text-[14px] font-bold rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saveStatus === 'saving' ? 'Guardando…' : 'Guardar evaluación'}
        </button>

        {!allScored && (
          <span className="text-[13px] text-text-hint">
            {answered === 0
              ? 'Califica todos los criterios para habilitar el guardado.'
              : `${CRITERIA.length - answered} criterio${CRITERIA.length - answered !== 1 ? 's' : ''} sin calificar`}
          </span>
        )}

        {answered > 0 && (
          <button
            onClick={reset}
            className="ml-auto text-[12px] text-text-hint border border-border-default rounded-lg px-4 py-2 hover:text-danger hover:border-danger/50 transition-colors"
          >
            ↺ Reiniciar
          </button>
        )}
      </div>

      {/* Error */}
      {saveStatus === 'error' && (
        <p className="mt-3 text-[13px] text-danger bg-danger/8 border border-danger/30 rounded-lg px-4 py-3">
          {saveError || 'Error al guardar. Verifica tu conexión e intenta de nuevo.'}
        </p>
      )}
    </div>
  )
}
