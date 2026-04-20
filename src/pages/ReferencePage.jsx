import { useState } from 'react'
import RubricTab from './RubricTab'
import FrameworkTab from './FrameworkTab'

// ── ReferencePage ─────────────────────────────────────────────────────────────
//
// Merged entry point for Rúbrica + Framework content.
// Replaces the two separate tab routes with a single /referencia route,
// and an in-page toggle to switch between the two views.

export default function ReferencePage() {
  const [view, setView] = useState('rubric')

  return (
    <div>
      {/* Page header + view toggle */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Referencia</h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Rúbrica de criterios y justificación del framework de evaluación
          </p>
        </div>

        <div
          className="flex gap-1 rounded-lg p-1"
          style={{ background: 'rgba(30,33,49,0.8)', border: '1px solid #2E3347' }}
        >
          {[
            { key: 'rubric',    label: '📋 Rúbrica'   },
            { key: 'framework', label: '🧠 Framework'  },
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
