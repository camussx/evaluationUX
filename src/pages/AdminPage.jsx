import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ── AdminPage (ruta /admin, UI label "Equipo") ────────────────────────────────
//
// Vista única: tabla de personas con acceso a la plataforma.
// Acciones por fila: Editar (rol + flujos) · Revocar acceso.
// Cabecera: botón "+ Invitar persona" → InviteModal.
//
// Requiere tres RPCs en Supabase (supabase/team_management.sql):
//   admin_get_users()
//   admin_set_user_role_by_email(p_email, p_role) → uuid
//   admin_update_user_role(p_user_id, p_role)
//   admin_ban_user(p_user_id)

// ── Shared style constants ────────────────────────────────────────────────────

const labelCls =
  'block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5'
const inputCls =
  'w-full bg-background-elevated border border-border-default rounded-lg px-3.5 py-2.5 ' +
  'text-[13px] text-text-primary placeholder:text-text-hint focus:outline-none ' +
  'focus:border-accent transition-colors'
const cancelBtnCls =
  'flex-1 px-4 py-2.5 rounded-lg border border-border-default text-[13px] ' +
  'text-text-secondary hover:text-text-primary hover:border-border-strong transition-all'
const primaryBtnCls =
  'flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-[13px] ' +
  'font-bold transition-opacity disabled:opacity-50'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-PE', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

const isBanned = (u) =>
  u.banned_until && new Date(u.banned_until) > new Date()

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_STYLE = {
  admin:    { color: '#5B5FC7', bg: '#EEEEF9', border: '#BBBDE8', label: 'Admin'     },
  evaluador:{ color: '#065F46', bg: '#D1FAE5', border: '#A7F3D0', label: 'Evaluador' },
  viewer:   { color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB', label: 'Viewer'    },
}

function RoleBadge({ role, banned }) {
  if (banned) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider"
        style={{ color: '#DC2626', background: '#FEE2E2', borderColor: '#FECACA' }}>
        Acceso revocado
      </span>
    )
  }
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.viewer
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}>
      {s.label}
    </span>
  )
}

// ── Role selector (shared by both modals) ─────────────────────────────────────

const ROLE_OPTIONS = [
  {
    id: 'admin',
    label: 'Admin',
    desc: 'Acceso total. Puede crear flujos, invitar personas y ver todo.',
  },
  {
    id: 'evaluador',
    label: 'Evaluador',
    desc: 'Puede evaluar los flujos que se le asignen y ver resultados.',
  },
  {
    id: 'viewer',
    label: 'Viewer',
    desc: 'Solo puede ver resultados. No puede evaluar.',
  },
]

function RoleSelector({ value, onChange }) {
  return (
    <div className="space-y-2">
      {ROLE_OPTIONS.map(r => {
        const s = ROLE_STYLE[r.id]
        const active = value === r.id
        return (
          <label
            key={r.id}
            className={[
              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-100',
              active ? 'border-2' : 'border border-border-default hover:border-border-strong',
            ].join(' ')}
            style={active ? { borderColor: s.color, background: `${s.color}08` } : {}}
          >
            <input
              type="radio"
              name="modal-role"
              value={r.id}
              checked={active}
              onChange={() => onChange(r.id)}
              className="mt-0.5 flex-shrink-0"
              style={{ accentColor: '#5B5FC7' }}
            />
            <div>
              <span
                className="text-[13px] font-semibold"
                style={{ color: active ? s.color : '#1A1D35' }}
              >
                {r.label}
              </span>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">{r.desc}</p>
            </div>
          </label>
        )
      })}
    </div>
  )
}

// ── Flow checkboxes (shown when role = evaluador) ─────────────────────────────

function FlowCheckboxes({ flows, selected, onChange }) {
  if (flows.length === 0) {
    return (
      <p className="text-[12px] text-text-hint px-1 py-2">
        Primero crea al menos un flujo para poder asignarlo.
      </p>
    )
  }
  return (
    <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
      {flows.map(f => {
        const checked = selected.includes(f.id)
        return (
          <label
            key={f.id}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-background-elevated transition-colors"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={e =>
                onChange(
                  e.target.checked
                    ? [...selected, f.id]
                    : selected.filter(id => id !== f.id)
                )
              }
              style={{ accentColor: '#5B5FC7' }}
            />
            <div className="min-w-0">
              <span className="text-[13px] text-text-primary">{f.name}</span>
              {f.product && (
                <span className="text-[11px] text-text-hint ml-1.5">{f.product}</span>
              )}
            </div>
          </label>
        )
      })}
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background-surface border border-border-default rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-default flex-shrink-0">
          <h2 className="text-[16px] font-bold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-hint hover:text-text-primary transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ── InviteModal ───────────────────────────────────────────────────────────────

function InviteModal({ flows, onClose, onSuccess }) {
  const [email,   setEmail]   = useState('')
  const [role,    setRole]    = useState('evaluador')
  const [flowIds, setFlowIds] = useState([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const normalEmail = email.trim().toLowerCase()
    if (!normalEmail) return

    setSaving(true)
    setError('')

    try {
      // 1. Send magic link (creates user in auth.users if not existing)
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: normalEmail,
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
        },
      })
      if (otpErr) throw otpErr

      // 2. Set role in auth.users via SECURITY DEFINER RPC
      //    Returns the user's UUID
      const { data: userId, error: roleErr } = await supabase
        .rpc('admin_set_user_role_by_email', {
          p_email: normalEmail,
          p_role:  role,
        })
      if (roleErr) throw roleErr

      // 3. Insert flow permissions if evaluador
      if (role === 'evaluador' && flowIds.length > 0) {
        const { error: permErr } = await supabase
          .from('flow_evaluator_permissions')
          .upsert(
            flowIds.map(fid => ({ flow_id: fid, user_id: userId })),
            { onConflict: 'flow_id,user_id', ignoreDuplicates: true }
          )
        if (permErr) throw permErr
      }

      onSuccess(
        `Invitación enviada a ${normalEmail}. ` +
        `La persona recibirá un magic link para acceder.`
      )
    } catch (err) {
      setError(err.message || 'Error al enviar la invitación.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Invitar persona" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label className={labelCls}>
            Email <span className="text-danger">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="correo@empresa.com"
            required
            autoFocus
            className={inputCls}
          />
        </div>

        {/* Role */}
        <div>
          <label className={labelCls}>
            Rol <span className="text-danger">*</span>
          </label>
          <RoleSelector value={role} onChange={r => { setRole(r); setFlowIds([]) }} />
        </div>

        {/* Flows (only for evaluador) */}
        {role === 'evaluador' && (
          <div>
            <label className={labelCls}>Flujos asignados</label>
            <p className="text-[11px] text-text-hint mb-2">
              Selecciona los flujos que esta persona podrá evaluar.
            </p>
            <FlowCheckboxes flows={flows} selected={flowIds} onChange={setFlowIds} />
          </div>
        )}

        {error && (
          <p className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={cancelBtnCls}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !email.trim()}
            className={primaryBtnCls}
          >
            {saving ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({ user, flows, initialFlowIds, onClose, onSuccess }) {
  const [role,    setRole]    = useState(user.role ?? 'viewer')
  const [flowIds, setFlowIds] = useState(initialFlowIds)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // 1. Update role in auth.users + profiles
      const { error: roleErr } = await supabase.rpc('admin_update_user_role', {
        p_user_id: user.id,
        p_role:    role,
      })
      if (roleErr) throw roleErr

      // 2. Sync flow permissions
      // Always wipe existing permissions first
      const { error: delErr } = await supabase
        .from('flow_evaluator_permissions')
        .delete()
        .eq('user_id', user.id)
      if (delErr) throw delErr

      // Insert new ones only if evaluador with selections
      if (role === 'evaluador' && flowIds.length > 0) {
        const { error: insErr } = await supabase
          .from('flow_evaluator_permissions')
          .insert(flowIds.map(fid => ({ flow_id: fid, user_id: user.id })))
        if (insErr) throw insErr
      }

      onSuccess('Cambios guardados.')
    } catch (err) {
      setError(err.message || 'Error al guardar los cambios.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Editar persona" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email (read-only) */}
        <div>
          <label className={labelCls}>Email</label>
          <div className="px-3.5 py-2.5 bg-background-elevated border border-border-default rounded-lg text-[13px] text-text-secondary">
            {user.email}
          </div>
          <p className="text-[11px] text-text-hint mt-1">
            El email no puede modificarse desde aquí.
          </p>
        </div>

        {/* Role */}
        <div>
          <label className={labelCls}>Rol</label>
          <RoleSelector value={role} onChange={r => { setRole(r); if (r !== 'evaluador') setFlowIds([]) }} />
        </div>

        {/* Flows */}
        {role === 'evaluador' && (
          <div>
            <label className={labelCls}>Flujos asignados</label>
            <FlowCheckboxes flows={flows} selected={flowIds} onChange={setFlowIds} />
          </div>
        )}

        {error && (
          <p className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={cancelBtnCls}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryBtnCls}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── RevokeDialog ──────────────────────────────────────────────────────────────

function RevokeDialog({ user, onClose, onConfirm }) {
  const [revoking, setRevoking] = useState(false)
  const [error,    setError]    = useState('')

  async function handleConfirm() {
    setRevoking(true)
    setError('')
    try {
      const { error: banErr } = await supabase.rpc('admin_ban_user', {
        p_user_id: user.id,
      })
      if (banErr) throw banErr
      onConfirm()
    } catch (err) {
      setError(err.message || 'Error al revocar el acceso.')
      setRevoking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background-surface border border-border-default rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-[16px] font-bold text-text-primary mb-2">
          ¿Revocar acceso a {user.email}?
        </h3>
        <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">
          Esta persona ya no podrá ingresar a la plataforma.
          Sus evaluaciones anteriores se conservan.
        </p>
        {error && (
          <p className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={revoking}
            className={cancelBtnCls}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={revoking}
            className="flex-1 px-4 py-2.5 rounded-lg bg-danger text-white text-[13px] font-bold transition-opacity disabled:opacity-50"
          >
            {revoking ? 'Revocando…' : 'Sí, revocar acceso'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type }) {
  return (
    <div
      className="fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl border shadow-lg text-[13px] font-semibold max-w-sm animate-slide-down"
      style={
        type === 'success'
          ? { background: '#fff', borderColor: '#A7F3D0', color: '#065F46' }
          : { background: '#fff', borderColor: '#FECACA', color: '#DC2626' }
      }
    >
      {msg}
    </div>
  )
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user: currentUser } = useAuth()

  const [users,       setUsers]       = useState([])
  const [flows,       setFlows]       = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading,     setLoading]     = useState(true)

  const [showInvite,   setShowInvite]   = useState(false)
  const [editingUser,  setEditingUser]  = useState(null)  // user row object
  const [revokingUser, setRevokingUser] = useState(null)  // user row object
  const [toast,        setToast]        = useState(null)  // { type, msg }

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, flowsRes, permsRes] = await Promise.all([
      supabase.rpc('admin_get_users'),
      supabase.from('flows').select('id, name, product').order('created_at', { ascending: false }),
      supabase.from('flow_evaluator_permissions').select('*'),
    ])
    setUsers(usersRes.data ?? [])
    setFlows(flowsRes.data ?? [])
    setPermissions(permsRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived helpers ──────────────────────────────────────────────────────────

  function getUserFlowIds(userId) {
    return permissions.filter(p => p.user_id === userId).map(p => p.flow_id)
  }

  function getFlowsDisplay(user) {
    if (isBanned(user))             return null
    if (user.role === 'admin')      return 'Todos los flujos'
    if (user.role === 'evaluador') {
      const ids   = getUserFlowIds(user.id)
      const names = flows.filter(f => ids.includes(f.id)).map(f => f.name)
      return names.length > 0 ? names.join(', ') : null
    }
    return null  // viewer → "Sin flujos asignados"
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-24 bg-background-elevated rounded" />
        <div className="h-12 w-full bg-background-surface border border-border-default rounded-xl" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-background-surface border border-border-default rounded-xl" />
        ))}
      </div>
    )
  }

  // Other users (everyone except the current admin)
  const otherUsers = users.filter(u => u.id !== currentUser?.id)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Equipo</h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Gestiona las personas con acceso a la plataforma y los flujos que pueden evaluar.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex-shrink-0 px-4 py-2 bg-accent text-white text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          + Invitar persona
        </button>
      </div>

      {/* Empty state */}
      {otherUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 border border-dashed border-border-default rounded-xl text-center">
          <p className="text-[15px] text-text-secondary font-semibold mb-2">
            Aún no hay evaluadores registrados
          </p>
          <p className="text-[13px] text-text-hint mb-6">
            Invita a tu equipo para que puedan acceder y evaluar flujos.
          </p>
          <button
            onClick={() => setShowInvite(true)}
            className="px-5 py-2.5 bg-accent text-white text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            + Invitar primera persona
          </button>
        </div>
      ) : (
        /* ── Team table ── */
        <div className="bg-background-surface border border-border-default rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-background-elevated/40">
                {['Persona', 'Rol', 'Flujos asignados', 'Última sesión', 'Acciones'].map(h => (
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
              {users.map(u => {
                const banned        = isBanned(u)
                const isMe          = u.id === currentUser?.id
                const flowsDisplay  = getFlowsDisplay(u)
                const userFlowIds   = getUserFlowIds(u.id)
                const lastSeen      = fmtDate(u.last_sign_in_at)

                return (
                  <tr
                    key={u.id}
                    className="border-b border-border-default last:border-b-0"
                  >
                    {/* Persona */}
                    <td className="py-3.5 px-4 pl-5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-text-primary">
                          {u.email}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-semibold text-text-hint bg-background-elevated px-1.5 py-0.5 rounded border border-border-default">
                            Tú
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <RoleBadge role={u.role} banned={banned} />
                    </td>

                    {/* Flujos asignados */}
                    <td className="py-3.5 px-4 text-[13px] max-w-[200px]">
                      {banned ? (
                        <span className="text-text-hint">—</span>
                      ) : flowsDisplay ? (
                        <span className="text-text-secondary leading-snug line-clamp-2">
                          {flowsDisplay}
                        </span>
                      ) : (
                        <span className="text-text-hint">Sin flujos asignados</span>
                      )}
                    </td>

                    {/* Última sesión */}
                    <td className="py-3.5 px-4 text-[13px] text-text-hint whitespace-nowrap">
                      {lastSeen ?? 'Nunca'}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 pr-5">
                      <div className="flex items-center gap-2">
                        {!banned && (
                          <button
                            onClick={() => setEditingUser(u)}
                            className="text-[12px] font-semibold px-3 py-1 rounded-lg border transition-colors"
                            style={{ color: '#5B5FC7', borderColor: '#BBBDE8', background: '#EEEEF9' }}
                          >
                            Editar
                          </button>
                        )}
                        {!isMe && !banned && (
                          <button
                            onClick={() => setRevokingUser(u)}
                            className="text-[12px] font-semibold px-3 py-1 rounded-lg border border-danger/30 text-danger hover:bg-danger/8 transition-colors"
                          >
                            Revocar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}

      {showInvite && (
        <InviteModal
          flows={flows}
          onClose={() => setShowInvite(false)}
          onSuccess={(msg) => {
            setShowInvite(false)
            showToast('success', msg)
            load()
          }}
        />
      )}

      {editingUser && (
        <EditModal
          user={editingUser}
          flows={flows}
          initialFlowIds={getUserFlowIds(editingUser.id)}
          onClose={() => setEditingUser(null)}
          onSuccess={(msg) => {
            setEditingUser(null)
            showToast('success', msg)
            load()
          }}
        />
      )}

      {revokingUser && (
        <RevokeDialog
          user={revokingUser}
          onClose={() => setRevokingUser(null)}
          onConfirm={() => {
            setRevokingUser(null)
            showToast('success', 'Acceso revocado.')
            load()
          }}
        />
      )}
    </div>
  )
}
