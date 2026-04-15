import { useState, useEffect } from 'react'
import { CRITERIA } from '../data/criteria'
import { getScoreColor, getScoreBg, calcWeightedScore } from '../utils/scoring'
import ScoreBadge from '../components/ScoreBadge'

export default function EvaluadorTab() {
  const [scores, setScores] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ux_scores') || '{}') }
    catch { return {} }
  })

  useEffect(() => {
    localStorage.setItem('ux_scores', JSON.stringify(scores))
  }, [scores])

  const answered = Object.keys(scores).length
  const adjScore = calcWeightedScore(scores, CRITERIA)
  const sc       = adjScore ? getScoreColor(parseFloat(adjScore)) : '#9CA3B8'
  const sb       = adjScore ? getScoreBg(parseFloat(adjScore))    : 'rgba(34,38,58,0.5)'

  function setScore(id, n) {
    setScores(prev => ({ ...prev, [id]: n }))
  }

  function reset() {
    if (window.confirm('¿Reiniciar toda la evaluación?')) {
      setScores({})
      localStorage.removeItem('ux_scores')
    }
  }

  return (
    <div>
      {/* ── Mobile banner (< 768 px) ──────────────────────────────────────── */}
      <div
        className="md:hidden mb-4 flex items-start gap-2.5 px-4 py-3 rounded-lg border text-[13px] leading-snug"
        style={{ background: 'rgba(147,180,250,0.08)', borderColor: '#93B4FA', color: '#93B4FA' }}
      >
        <span className="mt-px flex-shrink-0">💡</span>
        <span>
          Para una mejor experiencia de evaluación, te recomendamos usar un dispositivo de escritorio.
        </span>
      </div>

      {/* ── Evaluator card ────────────────────────────────────────────────── */}
      <div className="bg-background-surface border border-border-default rounded-[10px] p-4 md:p-6">

        {/* Top: title + score display */}
        <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-text-primary mb-1">Evaluador Interactivo</h2>
            <p className="text-[13px] text-text-secondary">
              Califica de 1 a 10 · Tu progreso se guarda automáticamente en este navegador
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

        {/* Breakdown section */}
        {answered > 0 && (
          <div className="mt-5 bg-background-elevated rounded-lg p-4 border border-border-default">
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

            <button
              className="mt-3 px-4 py-2 bg-transparent border border-border-default rounded text-[12px] text-text-hint cursor-pointer transition-all duration-150 hover:border-accent hover:text-accent focus:outline-none"
              onClick={reset}
            >
              ↺ Reiniciar evaluación
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
