import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── AdminPage ─────────────────────────────────────────────────────────────────
//
// Visible only to admin role (enforced by ProtectedRoute + TabNav).
// Lets an admin assign evaluadores to specific flows.
//
// Data model:
//   profiles            – mirrors auth.users; upserted on each login by AuthProvider
//   flow_evaluator_permissions – (flow_id, user_id) pairs; admin can INSERT / DELETE

export default function AdminPage() {
  const [evaluadores, setEvaluadores] = useState([])
  const [flows,       setFlows]       = useState([])
  const [permissions, setPermissions] = useState([])   // [{ flow_id, user_id }]
  const [loading,     setLoading]     = useState(true)
  const [toggling,    setToggling]    = useState(null)  // `${flowId}-${userId}` while in-flight

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [profRes, flowRes, permRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .in('role', ['evaluador', 'admin'])
        .order('email'),
      supabase
        .from('flows')
        .select('id, name, product')
        .order('created_at', { ascending: false }),
      supabase
        .from('flow_evaluator_permissions')
        .select('*'),
    ])
    setEvaluadores(profRes.data ?? [])
    setFlows(flowRes.data ?? [])
    setPermissions(permRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function hasPermission(flowId, userId) {
    return permissions.some(p => p.flow_id === flowId && p.user_id === userId)
  }

  function assignedCount(userId) {
    return permissions.filter(p => p.user_id === userId).length
  }

  // ── Toggle a single permission ─────────────────────────────────────────────
  async function togglePermission(flowId, userId) {
    const key = `${flowId}-${userId}`
    setToggling(key)

    if (hasPermission(flowId, userId)) {
      await supabase
        .from('flow_evaluator_permissions')
        .delete()
        .eq('flow_id', flowId)
        .eq('user_id', userId)
      setPermissions(prev =>
        prev.filter(p => !(p.flow_id === flowId && p.user_id === userId))
      )
    } else {
      const { data } = await supabase
        .from('flow_evaluator_permissions')
        .insert({ flow_id: flowId, user_id: userId })
        .select()
        .single()
      if (data) setPermissions(prev => [...prev, data])
    }

    setToggling(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-background-elevated rounded" />
        {[1, 2].map(i => (
          <div key={i} className="bg-background-surface border border-border-default rounded-xl p-5">
            <div className="h-4 w-32 bg-background-elevated rounded mb-4" />
            {[1, 2, 3].map(j => (
              <div key={j} className="h-8 bg-background-elevated rounded mb-2" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-text-primary">Control de evaluadores</h1>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Asigna a cada evaluador los flujos que puede evaluar.
          Los administradores pueden evaluar cualquier flujo sin restricción.
        </p>
      </div>

      {/* Info notice */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg border mb-6 text-[12px]"
        style={{
          background:  'rgba(147,180,250,0.06)',
          borderColor: 'rgba(147,180,250,0.2)',
          color:       '#93B4FA',
        }}
      >
        <span className="flex-shrink-0 mt-px">ℹ️</span>
        <span>
          Los evaluadores solo aparecen aquí después de su primer inicio de sesión.
          Un evaluador sin flujos asignados no podrá guardar evaluaciones.
        </span>
      </div>

      {/* Empty states */}
      {evaluadores.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border-default rounded-xl">
          <p className="text-text-primary font-semibold mb-1">Sin evaluadores registrados</p>
          <p className="text-[13px] text-text-secondary">
            Invita usuarios desde el dashboard de Supabase. Aparecerán aquí tras su primer login.
          </p>
        </div>
      )}

      {flows.length === 0 && evaluadores.length > 0 && (
        <div className="text-center py-16 border border-dashed border-border-default rounded-xl">
          <p className="text-text-primary font-semibold mb-1">Sin flujos creados</p>
          <p className="text-[13px] text-text-secondary">
            Crea flujos desde la sección Flujos para poder asignarlos.
          </p>
        </div>
      )}

      {/* Evaluador cards */}
      <div className="space-y-4">
        {evaluadores.map(ev => (
          <div
            key={ev.id}
            className="bg-background-surface border border-border-default rounded-xl p-5"
          >
            {/* Card header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-[14px] font-semibold text-text-primary">{ev.email}</p>
                <p className="text-[12px] text-text-hint mt-0.5">
                  {assignedCount(ev.id)} flujo{assignedCount(ev.id) !== 1 ? 's' : ''} asignado{assignedCount(ev.id) !== 1 ? 's' : ''}
                </p>
              </div>
              <RoleBadge role={ev.role} />
            </div>

            {/* Flows list */}
            {flows.length === 0 ? (
              <p className="text-[12px] text-text-hint">No hay flujos.</p>
            ) : (
              <div className="space-y-1.5">
                {flows.map(flow => {
                  const hasPerm = hasPermission(flow.id, ev.id)
                  const key     = `${flow.id}-${ev.id}`
                  const busy    = toggling === key

                  // Admins can evaluate all flows — permissions don't apply
                  const isAdmin = ev.role === 'admin'

                  return (
                    <div
                      key={flow.id}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-background-elevated"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="text-[13px] text-text-primary truncate">{flow.name}</p>
                        {flow.product && (
                          <p className="text-[11px] text-text-hint">{flow.product}</p>
                        )}
                      </div>

                      {isAdmin ? (
                        <span className="text-[11px] font-bold text-text-hint px-3 py-1 rounded-full border border-border-default">
                          Acceso total
                        </span>
                      ) : (
                        <button
                          onClick={() => togglePermission(flow.id, ev.id)}
                          disabled={busy}
                          className={[
                            'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-150',
                            busy
                              ? 'opacity-50 cursor-wait border border-border-default text-text-hint'
                              : hasPerm
                                ? 'bg-success/12 text-success border border-success/40 hover:bg-danger/12 hover:text-danger hover:border-danger/40'
                                : 'bg-background-base text-text-hint border border-border-default hover:border-accent hover:text-accent',
                          ].join(' ')}
                        >
                          {busy ? '…' : hasPerm ? '✓ Asignado' : 'Asignar'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_STYLE = {
  admin:     { color: '#93B4FA', bg: 'rgba(147,180,250,0.1)',  border: 'rgba(147,180,250,0.3)'  },
  evaluador: { color: '#34D399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)'   },
  viewer:    { color: '#6B7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.3)'  },
}

function RoleBadge({ role }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.viewer
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider flex-shrink-0"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {role ?? 'sin rol'}
    </span>
  )
}
