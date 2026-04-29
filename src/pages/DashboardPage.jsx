import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFlows, enrichFlows } from '../hooks/useFlows'
import { supabase } from '../lib/supabase'
import { getScoreColor } from '../utils/scoring'
import FlowActionsMenu from '../components/FlowActionsMenu'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-PE', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '—'

const truncate = (str, n = 30) =>
  !str ? '—' : str.length > n ? str.slice(0, n) + '…' : str

// ── NotificationBanner ───────────────────────────────────────────────────────

function NotificationBanner({ msg, type }) {
  if (!msg) return null
  const styles = type === 'success'
    ? { background: '#D1FAE5', borderColor: '#A7F3D0', color: '#065F46' }
    : { background: '#FEE2E2', borderColor: '#FECACA', color: '#DC2626' }
  return (
    <div
      className="mb-6 px-4 py-3 rounded-xl border text-[13px] font-semibold"
      style={styles}
    >
      {msg}
    </div>
  )
}

// ── Shared loading skeleton ───────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
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
  )
}

// ── Flow table (shared by admin + evaluador) ──────────────────────────────────

function FlowTable({ flows, onRowClick }) {
  const groups = useMemo(() => {
    const map = {}
    for (const flow of flows) {
      const key = flow.product?.trim() || 'Sin producto'
      if (!map[key]) map[key] = []
      map[key].push(flow)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [flows])

  return (
    <div className="space-y-8">
      {groups.map(([product, productFlows]) => (
        <section key={product}>
          <h2 className="text-[11px] font-bold tracking-[2px] uppercase text-text-hint mb-3 px-1">
            {product}
          </h2>
          <div className="bg-background-surface border border-border-default rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default bg-background-elevated/40">
                  {['Flujo', 'Estatus', 'Evaluaciones', 'Promedio', 'Descripción', 'Creación', 'Acciones'].map(h => (
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
                  const avg        = flow.avgScore ? parseFloat(flow.avgScore) : null
                  const scoreColor = avg != null ? getScoreColor(avg) : null
                  const hasEvals   = flow.evalCount > 0

                  return (
                    <tr
                      key={flow.id}
                      onClick={() => onRowClick(flow.id)}
                      className="border-b border-border-default last:border-b-0 hover:bg-background-elevated/40 cursor-pointer transition-colors duration-100"
                    >
                      <td className="py-3.5 px-4 pl-5">
                        <span className="text-[13px] font-semibold text-text-primary">{flow.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {hasEvals ? (
                          <span
                            className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
                            style={{ color: '#065F46', background: '#D1FAE5', borderColor: '#A7F3D0' }}
                          >
                            Evaluado
                          </span>
                        ) : (
                          <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-border-default text-text-hint bg-background-elevated">
                            Sin evaluar
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[13px] font-mono text-text-secondary">
                        {hasEvals ? flow.evalCount : <span className="text-text-hint">—</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {avg != null ? (
                          <span className="font-mono text-[13px] font-bold" style={{ color: scoreColor }}>
                            {flow.avgScore}
                          </span>
                        ) : (
                          <span className="text-text-hint text-[13px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[13px] text-text-secondary">
                        {truncate(flow.description)}
                      </td>
                      <td className="py-3.5 px-4 text-[13px] text-text-hint whitespace-nowrap">
                        {fmtDate(flow.created_at)}
                      </td>
                      <td className="py-3.5 px-4 pr-5" onClick={e => e.stopPropagation()}>
                        <FlowActionsMenu flowId={flow.id} hasEvals={flow.evalCount > 0} />
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
  )
}

// ── AdminDashboard ────────────────────────────────────────────────────────────

function AdminDashboard({ bannerMsg, bannerType }) {
  const navigate               = useNavigate()
  const { flows, loading, error } = useFlows()

  // Clear location state after reading banner
  useEffect(() => {
    if (bannerMsg) window.history.replaceState({}, '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!loading && !error && flows.length === 0) {
    return (
      <div>
        <NotificationBanner msg={bannerMsg} type={bannerType} />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="text-[16px] text-text-secondary mb-6">
            Aún no tienes flujos evaluados
          </p>
          <button
            onClick={() => navigate('/flujos', { state: { openModal: true } })}
            className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            + Nuevo flujo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <NotificationBanner msg={bannerMsg} type={bannerType} />

      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-[22px] font-bold text-text-primary">Evaluaciones realizadas</h1>
        <button
          onClick={() => navigate('/flujos', { state: { openModal: true } })}
          className="flex-shrink-0 px-4 py-2 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          + Nuevo flujo
        </button>
      </div>

      {error && (
        <p className="text-[13px] text-danger mb-4">Error al cargar: {error.message}</p>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && (
        <FlowTable flows={flows} onRowClick={(id) => navigate(`/flujos/${id}`)} />
      )}
    </div>
  )
}

// ── EvaluadorDashboard ────────────────────────────────────────────────────────

function EvaluadorDashboard({ user, bannerMsg, bannerType }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [flows,   setFlows]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Clear location state so the banner doesn't persist on refresh
  useEffect(() => {
    if (location.state?.accessDenied) {
      window.history.replaceState({}, '')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id) return

    async function load() {
      setLoading(true)
      setError(null)

      // 1. Get this evaluador's assigned flow IDs
      const { data: perms, error: permsErr } = await supabase
        .from('flow_evaluator_permissions')
        .select('flow_id')
        .eq('user_id', user.id)

      if (permsErr) { setError(permsErr); setLoading(false); return }

      const flowIds = (perms ?? []).map(p => p.flow_id)
      if (flowIds.length === 0) { setFlows([]); setLoading(false); return }

      // 2. Fetch those flows with evaluation stats
      const { data, error: flowsErr } = await supabase
        .from('flows')
        .select('*, evaluations(overall_score, evaluated_at)')
        .in('id', flowIds)
        .order('created_at', { ascending: false })

      if (flowsErr) { setError(flowsErr); setLoading(false); return }

      setFlows(enrichFlows(data ?? []))
      setLoading(false)
    }

    load()
  }, [user?.id])

  // Empty state
  if (!loading && !error && flows.length === 0) {
    return (
      <div>
        <NotificationBanner msg={bannerMsg} type={bannerType} />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="text-[16px] font-semibold text-text-secondary mb-2">
            Aún no tienes flujos asignados
          </p>
          <p className="text-[13px] text-text-hint">
            Contacta al administrador para que te asigne uno.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <NotificationBanner msg={bannerMsg} type={bannerType} />

      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-[22px] font-bold text-text-primary">Mis flujos asignados</h1>
      </div>

      {error && (
        <p className="text-[13px] text-danger mb-4">Error al cargar: {error.message}</p>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && (
        <FlowTable flows={flows} onRowClick={(id) => navigate(`/flujos/${id}`)} />
      )}
    </div>
  )
}

// ── DashboardPage ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { role, user } = useAuth()
  const location       = useLocation()

  // Banners from redirects or deletions
  const accessDeniedMsg = location.state?.accessDenied  ?? null
  const deletedFlowMsg  = location.state?.deletedFlow   ?? null
  const bannerMsg       = accessDeniedMsg || deletedFlowMsg
  const bannerType      = deletedFlowMsg ? 'success' : 'error'

  if (role === 'evaluador') {
    return <EvaluadorDashboard user={user} bannerMsg={bannerMsg} bannerType={bannerType} />
  }

  return <AdminDashboard bannerMsg={bannerMsg} bannerType={bannerType} />
}
