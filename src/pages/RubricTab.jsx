import { useState } from 'react'
import { CRITERIA } from '../data/criteria'
import WeightBar from '../components/WeightBar'

const BADGE = {
  Base:  { bg: '#FEF9C3', color: '#B45309', border: 'rgba(180,83,9,0.3)'   },
  Nuevo: { bg: '#D1FAE5', color: '#059669', border: 'rgba(5,150,105,0.3)'  },
}

const SCALE_LEVELS = [
  { key: 's1',  score: 1,  label: 'Falla Crítica',    color: '#DC2626', bg: '#FEE2E2', border: 'rgba(220,38,38,0.3)'   },
  { key: 's5',  score: 5,  label: 'Funcional Básico', color: '#B45309', bg: '#FEF3C7', border: 'rgba(180,83,9,0.3)'    },
  { key: 's10', score: 10, label: 'Excelencia UX',    color: '#059669', bg: '#D1FAE5', border: 'rgba(5,150,105,0.3)'   },
]

export default function RubricTab() {
  const [expanded, setExpanded] = useState(null)
  const toggle = (id) => setExpanded(expanded === id ? null : id)

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          { v: '10',   l: 'Criterios evaluados'            },
          { v: '100%', l: 'Peso total distribuido'         },
          { v: '1–10', l: 'Escala · 1=falla · 10=excelente' },
        ].map(c => (
          <div
            key={c.v}
            className="bg-background-surface border border-border-default rounded-[10px] p-4"
          >
            <div className="font-mono text-2xl font-medium text-text-primary">{c.v}</div>
            <div className="text-[11px] text-text-secondary mt-1">{c.l}</div>
          </div>
        ))}
      </div>

      {/* Rubric table */}
      <div className="bg-background-surface border border-border-default rounded-[10px] overflow-hidden">
        {/* Header row */}
        <div className="rubric-grid bg-background-elevated px-4 py-3">
          <div className="text-[10px] font-bold tracking-[1.5px] uppercase text-text-hint">#</div>
          <div className="text-[10px] font-bold tracking-[1.5px] uppercase text-text-hint">Criterio · Heurística</div>
          <div className="text-[10px] font-bold tracking-[1.5px] uppercase text-text-hint">Peso</div>
          <div className="text-[10px] font-bold tracking-[1.5px] uppercase text-text-hint text-right">Expandir</div>
        </div>

        {CRITERIA.map((c) => {
          const isOpen = expanded === c.id
          const badge  = BADGE[c.origin]
          return (
            <div key={c.id}>
              <div
                className={[
                  'rubric-grid px-4 py-3.5 cursor-pointer transition-colors duration-150',
                  'border-b border-border-default last:border-b-0',
                  isOpen ? 'bg-background-elevated' : 'hover:bg-background-elevated/60',
                ].join(' ')}
                onClick={() => toggle(c.id)}
              >
                {/* Number badge */}
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold text-white font-mono flex-shrink-0"
                  style={{ background: c.color }}
                >
                  {String(c.id).padStart(2, '0')}
                </div>

                {/* Name + heuristic */}
                <div>
                  <div className="text-[14px] font-semibold text-text-primary leading-snug">
                    {c.name}
                    <span
                      className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ml-1.5 uppercase tracking-[0.5px] align-middle border"
                      style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}
                    >
                      {c.origin}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-hint mt-0.5">{c.heuristic}</div>
                </div>

                {/* Weight bar */}
                <WeightBar weight={c.weight} color={c.color} />

                {/* Toggle */}
                <div className="text-[11px] text-accent text-right font-semibold">
                  {isOpen ? '▲ cerrar' : '▼ ver escala'}
                </div>
              </div>

              {/* Expanded scale cards */}
              {isOpen && (
                <div
                  className="px-4 pb-5 pt-1 bg-background-elevated border-b border-border-default animate-slide-down"
                  style={{ paddingLeft: '60px' }}
                >
                  <p className="text-[13px] text-text-secondary mb-3.5 italic">{c.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {SCALE_LEVELS.map(lv => (
                      <div
                        key={lv.score}
                        className="rounded-lg p-3 border"
                        style={{ background: lv.bg, borderColor: lv.border }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.5px]" style={{ color: lv.color }}>
                            {lv.label}
                          </span>
                          <span className="text-[20px] font-bold font-mono" style={{ color: lv.color }}>
                            {lv.score}
                          </span>
                        </div>
                        <p className="text-[12px] leading-[1.55] text-text-secondary">{c[lv.key]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3.5 flex gap-4 flex-wrap items-center px-3.5 py-2.5 bg-background-surface rounded-lg border border-border-default text-[12px]">
        <span className="text-text-hint">Leyenda:</span>
        {Object.entries(BADGE).map(([label, s]) => (
          <span key={label} className="flex items-center gap-1.5 text-text-secondary">
            <span
              className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-[0.5px] border"
              style={{ background: s.bg, color: s.color, borderColor: s.border }}
            >
              {label}
            </span>
            {label === 'Base' ? 'Pilares originales expandidos' : 'Criterios añadidos desde frameworks de usabilidad'}
          </span>
        ))}
      </div>
    </div>
  )
}
