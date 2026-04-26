import { useState } from 'react'
import RubricTab from './RubricTab'
import FrameworkTab from './FrameworkTab'

// ── CriteriosPage ─────────────────────────────────────────────────────────────
//
// Ruta: /criterios
// Referencia para evaluadores: tabla de criterios con escala 1-5-10 y
// justificación del framework de pesos. Ayuda a puntuar objetivamente.

export default function CriteriosPage() {
  const [view, setView] = useState('rubric')

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Criterios</h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Rúbrica de 10 criterios · Referencia de puntuación objetiva para evaluadores
          </p>
        </div>

        <div
          className="flex gap-1 rounded-lg p-1"
          style={{ background: '#F0F2F7', border: '1px solid #E5E7EB' }}
        >
          {[
            { key: 'rubric',    label: 'Rúbrica'    },
            { key: 'framework', label: 'Framework'  },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={[
                'px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-150',
                view === key
                  ? 'bg-background-surface text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'rubric' ? <RubricTab /> : <FrameworkTab />}
    </div>
  )
}
