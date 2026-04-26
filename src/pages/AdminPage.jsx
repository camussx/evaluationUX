import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── AdminPage ─────────────────────────────────────────────────────────────────
//
// Ruta: /admin — visible solo para rol admin.
// Subsecciones:
//   Evaluadores — asignar flujos por evaluador
//   Usuarios    — lista de usuarios + invitar nuevo evaluador

const ROLE_STYLE = {
  admin:     { color: '#5B5FC7', bg: '#EEEEF9',  border: '#BBBDE8'  },
  evaluador: { color: '#065F46', bg: '#D1FAE5',  border: '#A7F3D0'  },
  viewer:    { color: '#6B7280', bg: '#F3F4F6',  border: '#D1D5DB'  },
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

// ── SUBSECCIÓN: Evaluadores ───────────────────────────────────────────────────

function EvaluadoresTab({ profiles, flows, permissions, toggling, onToggle }) {
  const evaluadores = profiles.filter(p => p.role === 'evaluador')

  function hasPermission(flowId, userId) {
    return permissions.some(p => p.flow_id === flowId && p.user_id === userId)
  }

  function assignedCount(userId) {
    return permissions.filter(p => p.user_id === userId).length
  }

  if (evaluadores.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-border-default rounded-xl">
        <p className="text-[14px] text-text-secondary font-semibold mb-1">Sin evaluadores registrados</p>
        <p className="text-[13px] text-text-hint">
          Los evaluadores aparecen aquí después de su primer inicio de sesión.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Info notice */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg border mb-5 text-[13px]"
        style={{ background: '#EEEEF9', borderColor: '#BBBDE8', color: '#5B5FC7' }}
      >
        <span className="flex-shrink-0">ℹ️</span>
        <span>
          Los evaluadores sin flujos asignados no podrán guardar evaluaciones.
          Los administradores tienen acceso a todos los flujos sin restricción.
        </span>
      </div>

      <div className="space-y-4">
        {evaluadores.map(ev => (
          <div key={ev.id} className="bg-background-surface border border-border-default rounded-xl p-5">
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
              <p className="text-[12px] text-text-hint">No hay flujos creados aún.</p>
            ) : (
              <div className="space-y-1.5">
                {flows.map(flow => {
                  const hasPerm = hasPermission(flow.id, ev.id)
                  const key     = `${flow.id}-${ev.id}`
                  const busy    = toggling === key

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
                      <button
                        onClick={() => onToggle(flow.id, ev.id)}
                        disabled={busy}
                        className={[
                          'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-150',
                          busy
                            ? 'opacity-50 cursor-wait border border-border-default text-text-hint'
                            : hasPerm
                              ? 'text-success border border-success/40 bg-success/10 hover:text-danger hover:border-danger/40 hover:bg-danger/10'
                              : 'text-text-hint border border-border-default bg-background-base hover:text-accent hover:border-accent/50',
                        ].join(' ')}
                      >
                        {busy ? '…' : hasPerm ? '✓ Asignado' : 'Asignar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ── SUBSECCIÓN: Usuarios ──────────────────────────────────────────────────────

function UsuariosTab({ profiles, onRefresh }) {
  const [inviteEmail,  setInviteEmail]  = useState('')
  const [inviteStatus, setInviteStatus] = useState('idle') // idle | sending | sent | error
  const [inviteError,  setInviteError]  = useState('')

  async function handleInvite(e) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return

    setInviteStatus('sending')
    setInviteError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:  window.location.origin,
        shouldCreateUser: true,
      },
    })

    if (error) {
      setInviteError(error.message || 'Error al enviar la invitación.')
      setInviteStatus('error')
    } else {
      setInviteStatus('sent')
      setInviteEmail('')
    }
  }

  const inputCls =
    'flex-1 bg-background-elevated border border-border-default rounded-lg px-3.5 py-2.5 ' +
    'text-[13px] text-text-primary placeholder:text-text-hint ' +
    'focus:outline-none focus:border-accent transition-colors'

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div className="bg-background-surface border border-border-default rounded-xl p-5">
        <h3 className="text-[15px] font-bold text-text-primary mb-1">Invitar evaluador</h3>
        <p className="text-[13px] text-text-secondary mb-4">
          El usuario recibirá un enlace mágico para iniciar sesión y elegir su rol.
        </p>

        {inviteStatus === 'sent' ? (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-lg border text-[13px]"
            style={{ background: '#D1FAE5', borderColor: '#A7F3D0', color: '#065F46' }}
          >
            <span>✓</span>
            <span>
              Acceso enviado. El usuario debe hacer clic en el enlace de su correo para ingresar.
            </span>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="flex gap-2 flex-wrap">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="correo@empresa.com"
              required
              className={inputCls}
            />
            <button
              type="submit"
              disabled={inviteStatus === 'sending' || !inviteEmail.trim()}
              className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {inviteStatus === 'sending' ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </form>
        )}

        {inviteStatus === 'sent' && (
          <button
            onClick={() => setInviteStatus('idle')}
            className="mt-3 text-[12px] text-text-hint hover:text-text-secondary underline"
          >
            Invitar otro
          </button>
        )}

        {inviteStatus === 'error' && (
          <p className="mt-2 text-[12px] text-danger bg-danger/8 border border-danger/30 rounded-lg px-3 py-2">
            {inviteError}
          </p>
        )}
      </div>

      {/* Users list */}
      <div className="bg-background-surface border border-border-default rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-default">
          <h3 className="text-[15px] font-bold text-text-primary">Usuarios registrados</h3>
          <p className="text-[12px] text-text-hint mt-0.5">
            {profiles.length} usuario{profiles.length !== 1 ? 's' : ''} · Solo aparecen tras su primer inicio de sesión
          </p>
        </div>

        {profiles.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px] text-text-hint">
              Aún no hay usuarios. Invita al primero usando el formulario.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-background-elevated/30">
                {['Email', 'Rol', 'Último acceso'].map(h => (
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
              {profiles
                .slice()
                .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))
                .map(p => (
                  <tr key={p.id} className="border-b border-border-default last:border-b-0">
                    <td className="py-3.5 px-4 pl-5 text-[13px] text-text-primary">{p.email ?? '—'}</td>
                    <td className="py-3.5 px-4">
                      <RoleBadge role={p.role} />
                    </td>
                    <td className="py-3.5 px-4 pr-5 text-[13px] text-text-hint">
                      {p.updated_at
                        ? new Date(p.updated_at).toLocaleDateString('es-PE', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab,         setTab]         = useState('evaluadores')
  const [profiles,    setProfiles]    = useState([])
  const [flows,       setFlows]       = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [toggling,    setToggling]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [profRes, flowRes, permRes] = await Promise.all([
      supabase.from('profiles').select('*').order('email'),
      supabase.from('flows').select('id, name, product').order('created_at', { ascending: false }),
      supabase.from('flow_evaluator_permissions').select('*'),
    ])
    setProfiles(profRes.data ?? [])
    setFlows(flowRes.data ?? [])
    setPermissions(permRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function togglePermission(flowId, userId) {
    const key     = `${flowId}-${userId}`
    const hasPerm = permissions.some(p => p.flow_id === flowId && p.user_id === userId)
    setToggling(key)

    if (hasPerm) {
      await supabase.from('flow_evaluator_permissions')
        .delete().eq('flow_id', flowId).eq('user_id', userId)
      setPermissions(prev => prev.filter(p => !(p.flow_id === flowId && p.user_id === userId)))
    } else {
      const { data } = await supabase.from('flow_evaluator_permissions')
        .insert({ flow_id: flowId, user_id: userId }).select().single()
      if (data) setPermissions(prev => [...prev, data])
    }
    setToggling(null)
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-24 bg-background-elevated rounded" />
        <div className="h-12 w-full bg-background-surface border border-border-default rounded-xl" />
        {[1, 2].map(i => (
          <div key={i} className="h-32 bg-background-surface border border-border-default rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-text-primary">Admin</h1>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Gestión de evaluadores, permisos por flujo e invitaciones
        </p>
      </div>

      {/* Internal tab switcher */}
      <div
        className="flex gap-1 rounded-lg p-1 mb-6 w-fit"
        style={{ background: '#F0F2F7', border: '1px solid #E5E7EB' }}
      >
        {[
          { key: 'evaluadores', label: 'Evaluadores' },
          { key: 'usuarios',    label: 'Usuarios'    },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-150',
              tab === key
                ? 'bg-background-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'evaluadores' ? (
        <EvaluadoresTab
          profiles={profiles}
          flows={flows}
          permissions={permissions}
          toggling={toggling}
          onToggle={togglePermission}
        />
      ) : (
        <UsuariosTab profiles={profiles} onRefresh={load} />
      )}
    </div>
  )
}
