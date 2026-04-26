import { CRITERIA } from '../data/criteria'
import { JUSTIFICATIONS } from '../data/justifications'

const MAX_WEIGHT = 15

const HOW_TO_STEPS = [
  {
    n: '01', color: '#C1272D',
    title: 'Definir el Scope',
    desc: 'Seleccionar la funcionalidad o flujo específico. Delimitar pantallas incluidas, perfil de usuario objetivo y contexto de uso.',
  },
  {
    n: '02', color: '#1A5276',
    title: 'Calificar los 10 Criterios',
    desc: 'Usar la rúbrica para puntuar de 1-10. Documentar evidencia concreta (capturas, flows, datos) que justifique cada nota.',
  },
  {
    n: '03', color: '#196F3D',
    title: 'Calcular el Score Ponderado',
    desc: 'Score ≥ 7.5 aprueba para producción. 5.0–7.4 requiere plan de mejora. Menor a 5.0 requiere rediseño.',
  },
  {
    n: '04', color: '#784212',
    title: 'Priorizar y Remediar',
    desc: 'Mayor peso × menor score = máxima prioridad. Generar backlog con responsable, sprint asignado y métrica de éxito.',
  },
]

function JustCard({ color, pct, title, sub, desc }) {
  return (
    <div className="bg-background-elevated border border-border-default rounded-[10px] p-[18px] relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: color }} />
      <div className="pl-3.5">
        <div className="text-[28px] font-bold font-mono mb-0.5" style={{ color }}>{pct}</div>
        <div className="text-[13px] font-bold text-text-primary">{title}</div>
        {sub && <div className="text-[11px] text-text-secondary italic mt-0.5 mb-2.5">{sub}</div>}
        <div className="h-px my-2.5" style={{ background: '#E5E7EB' }} />
        <div className="text-[12px] text-text-secondary leading-relaxed">{desc}</div>
      </div>
    </div>
  )
}

export default function FrameworkTab() {
  const sorted = [...CRITERIA].sort((a, b) => b.weight - a.weight)

  return (
    <div>
      {/* Weight distribution */}
      <div className="bg-background-surface border border-border-default rounded-[10px] p-4 md:p-6 mb-5">
        <h2 className="text-[18px] font-bold text-text-primary mb-1.5">Distribución de Pesos</h2>
        <p className="text-[13px] text-text-secondary mb-5">
          Ordenados de mayor a menor · Los primeros 3 suman el 40% del score total
        </p>
        {sorted.map(c => (
          <div key={c.id} className="flex items-center gap-3 mb-2.5">
            <div className="w-[110px] md:w-[200px] text-[11px] md:text-[12px] text-text-secondary text-right flex-shrink-0 leading-tight">
              {c.name}
            </div>
            <div className="flex-1 h-[18px] bg-background-elevated rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center justify-end pr-1.5 transition-all duration-700"
                style={{ width: `${(c.weight / MAX_WEIGHT) * 100}%`, background: c.color }}
              >
                <span className="text-[10px] font-bold text-white font-mono">{c.weight}%</span>
              </div>
            </div>
            <div
              className="w-20 text-[10px] font-semibold flex-shrink-0"
              style={{ color: c.color }}
            >
              {c.dim}
            </div>
          </div>
        ))}
      </div>

      {/* Strategic justification */}
      <div className="bg-background-surface border border-border-default rounded-[10px] p-4 md:p-6 mb-5">
        <h2 className="text-[18px] font-bold text-text-primary mb-1.5">Justificación Estratégica</h2>
        <p className="text-[13px] text-text-secondary mb-5">
          Por qué estos criterios tienen mayor peso en contexto bancario-financiero
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {JUSTIFICATIONS.map(j => (
            <JustCard key={j.pct} color={j.color} pct={j.pct} title={j.title} sub={j.sub} desc={j.desc} />
          ))}
        </div>
      </div>

      {/* How to use */}
      <div className="bg-background-surface border border-border-default rounded-[10px] p-4 md:p-6">
        <h2 className="text-[18px] font-bold text-text-primary mb-1.5">Cómo Usar el Framework</h2>
        <p className="text-[13px] text-text-secondary mb-5">Proceso recomendado de evaluación</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {HOW_TO_STEPS.map(st => (
            <JustCard key={st.n} color={st.color} pct={st.n} title={st.title} desc={st.desc} />
          ))}
        </div>
      </div>
    </div>
  )
}
