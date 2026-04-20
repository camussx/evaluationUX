import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlows } from '../hooks/useFlows'
import { getScoreColor } from '../utils/scoring'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-PE', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '—'

const truncate = (str, n = 30) =>
  !str ? '—' : str.length > n ? str.slice(0, n) + '…' : str

// ── DashboardPage ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate           = useNavigate()
  const { flows, loading, error } = useFlows()

  // Group flows by product, sorted alphabetically
  const groups = useMemo(() => {
    const map = {}
    for (const flow of flows) {
      const key = flow.product?.trim() || 'Sin producto'
      if (!map[key]) map[key] = []
      map[key].push(flow)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [flows])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!loading && !error && flows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-[16px] text-text-secondary mb-6">
          Aún no tienes flujos evaluados
        </p>
        <button
          onClick={() => navigate('/flujos')}
          className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          + Nuevo flujo
        </button>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-[22px] font-bold text-text-primary">Evaluaciones realizadas</h1>
        <button
          onClick={() => navigate('/flujos')}
          className="flex-shrink-0 px-4 py-2 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          + Nuevo flujo
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[13px] text-danger mb-4">Error al cargar: {error.message}</p>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-8 animate-pulse">
          {[1, 2].map(i => (
            <div key={i}>
              <div className="h-3 w-28 bg-background-elevated rounded mb-3" />
              <div className="bg-background-surface border border-border-default rounded-xl overflow-hidden">
                {[1, 2, 3].map(j => (
                  <div key={j} className="flex items-center gap-6 px-5 py-4 border-b border-border-default last:border-b-0">
                    <div className="h-3 w-36 bg-background-elevated rounded" />
                    <div className="h-5 w-20 bg-background-elevated rounded-full" />
                    <div className="h-3 w-10 bg-background-elevated rounded" />
                    <div className="h-3 w-12 bg-background-elevated rounded" />
                    <div className="h-3 w-40 bg-background-elevated rounded" />
                    <div className="h-3 w-20 bg-background-elevated rounded ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product groups */}
      {!loading && (
        <div className="space-y-8">
          {groups.map(([product, productFlows]) => (
            <section key={product}>
              {/* Group label */}
              <h2 className="text-[11px] font-bold tracking-[2px] uppercase text-text-hint mb-3 px-1">
                {product}
              </h2>

              {/* Table */}
              <div className="bg-background-surface border border-border-default rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-default bg-background-elevated/40">
                      {['Flujo', 'Estatus', 'Evaluaciones', 'Promedio', 'Descripción', 'Creación'].map(h => (
                        <th
                          key={h}
                          className="text-left text-[11px] font-bold tracking-[1px] uppercase text-text-hint py-3 px-4 first:pl-5 last:pr-5"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productFlows.map(flow => {
                      const avg = flow.avgScore ? parseFloat(flow.avgScore) : null
                      const scoreColor = avg != null ? getScoreColor(avg) : null
                      const hasEvals   = flow.evalCount > 0

                      return (
                        <tr
                          key={flow.id}
                          onClick={() => navigate(`/flujos/${flow.id}`)}
                          className="border-b border-border-default last:border-b-0 hover:bg-background-elevated/40 cursor-pointer transition-colors duration-100"
                        >
                          {/* Flujo */}
                          <td className="py-3.5 px-4 pl-5">
                            <span className="text-[13px] font-semibold text-text-primary">
                              {flow.name}
                            </span>
                          </td>

                          {/* Estatus */}
                          <td className="py-3.5 px-4">
                            {hasEvals ? (
                              <span
                                className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
                                style={{
                                  color:       '#34D399',
                                  background:  'rgba(52,211,153,0.1)',
                                  borderColor: 'rgba(52,211,153,0.3)',
                                }}
                              >
                                Evaluado
                              </span>
                            ) : (
                              <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-border-default text-text-hint bg-background-elevated">
                                Sin evaluar
                              </span>
                            )}
                          </td>

                          {/* Evaluaciones */}
                          <td className="py-3.5 px-4 text-[13px] font-mono text-text-secondary">
                            {hasEvals ? flow.evalCount : <span className="text-text-hint">—</span>}
                          </td>

                          {/* Promedio */}
                          <td className="py-3.5 px-4">
                            {avg != null ? (
                              <span
                                className="font-mono text-[13px] font-bold"
                                style={{ color: scoreColor }}
                              >
                                {flow.avgScore}
                              </span>
                            ) : (
                              <span className="text-text-hint text-[13px]">—</span>
                            )}
                          </td>

                          {/* Descripción */}
                          <td className="py-3.5 px-4 text-[13px] text-text-secondary">
                            {truncate(flow.description)}
                          </td>

                          {/* Creación */}
                          <td className="py-3.5 px-4 pr-5 text-[13px] text-text-hint whitespace-nowrap">
                            {fmtDate(flow.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
