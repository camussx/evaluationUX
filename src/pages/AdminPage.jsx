import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ── AdminPage (ruta /admin, UI label "Equipo") ────────────────────────────────
//
// Tabla unificada de personas con acceso a la plataforma.
// Todos los invitados entran como Evaluador — no hay selector de rol.
// Acciones: Editar flujos asignados · Revocar acceso.
//
// Requiere RPCs en Supabase (supabase/team_management.sql):
//   admin_get_users()
//   admin_set_user_role_by_email(p_email, p_role) → uuid
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
  admin:     { color: '#5B5FC7', bg: '#EEEEF9', border: '#BBBDE8', label: 'Admin'     },
  evaluador: { color: '#065F46', bg: '#D1FAE5', border: '#A7F3D0', label: 'Evaluador' },
}

function RoleBadge({ role, banned }) {
  if (banned) {
    return (
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider"
        style={{ color: '#DC2626', background: '#FEE2E2', borderColor: '#FECACA' }}
      >
        Acceso revocado
      </span>
    )
  }
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.evaluador
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {s.label}
    </span>
  )
}

// ── Flow checkboxes ───────────────────────────────────────────────────────────

function FlowCheckboxes({ flows, selected, onChange }) {
  if (flows.length === 0) {
    return (
      <p className="text-[12px] text-text-hint px-1 py-2">
        Primero crea al menos un flujo antes de invitar a un evaluador.
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
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ── InviteModal ───────────────────────────────────────────────────────────────
// All invitees enter as Evaluador — no role selector.
// At least one flow must be selected before sending.

function InviteModal({ flows, onClose, onSuccess }) {
  const [email,   setEmail]   = useState('')
  const [flowIds, setFlowIds] = useState([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const noFlows   = flows.length === 0
  const canSubmit = !saving && email.trim() && flowIds.length > 0 && !noFlows

  async function handleSubmit(e) {
    e.preventDefault()
    const normalEmail = email.trim().toLowerCase()
    if (!normalEmail || flowIds.length === 0) return

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

      // 2. Set role as evaluador via SECURITY DEFINER RPC → returns user UUID
      const { data: userId, error: roleErr } = await supabase
        .rpc('admin_set_user_role_by_email', {
          p_email: normalEmail,
          p_role:  'evaluador',
        })
      if (roleErr) throw roleErr

      // 3. Insert flow permissions
      const { error: permErr } = await supabase
        .from('flow_evaluator_permissions')
        .upsert(
          flowIds.map(fid => ({ flow_id: fid, user_id: userId })),
          { onConflict: 'flow_id,user_id', ignoreDuplicates: true }
        )
      if (permErr) throw permErr

      onSuccess(
        `Invitación enviada a ${normalEmail}. ` +
        `Cuando ingrese, verá los flujos que le asignaste.`
      )
    } catch (err) {
      setError(err.message || 'Error al enviar la invitación.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Invitar evaluador" onClose={onClose}>
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

        {/* Flujos asignados */}
        <div>
          <label className={labelCls}>
            Flujos asignados <span className="text-danger">*</span>
          </label>
          <p className="text-[11px] text-text-hint mb-2">
            Selecciona al menos un flujo que esta persona podrá evaluar.
          </p>
          <FlowCheckboxes flows={flows} selected={flowIds} onChange={setFlowIds} />
          {!noFlows && flowIds.length === 0 && (
            <p className="text-[11px] text-warning mt-1">
              Debes seleccionar al menos un flujo.
            </p>
          )}
        </div>

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
            disabled={!canSubmit}
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
// Only edits the evaluador's assigned flows — role is fixed as evaluador.

function EditModal({ user, flows, initialFlowIds, onClose, onSuccess }) {
  const [flowIds, setFlowIds] = useState(initialFlowIds)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Wipe existing permissions then re-insert selected ones
      const { error: delErr } = await supabase
        .from('flow_evaluator_permissions')
        .delete()
        .eq('user_id', user.id)
      if (delErr) throw delErr

      if (flowIds.length > 0) {
        const { error: insErr } = await supabase
          .from('flow_evaluator_permissions')
          .insert(flowIds.map(fid => ({ flow_id: fid, user_id: user.id })))
        if (insErr) throw insErr
      }

      onSuccess('Flujos asignados actualizados.')
    } catch (err) {
      setError(err.message || 'Error al guardar los cambios.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Editar flujos asignados" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Email (read-only) */}
        <div>
          <label className={labelCls}>Evaluador</label>
          <div className="px-3.5 py-2.5 bg-background-elevated border border-border-default rounded-lg text-[13px] text-text-secondary">
            {user.email}
          </div>
        </div>

        {/* Flujos */}
        <div>
          <label className={labelCls}>Flujos asignados</label>
          <FlowCheckboxes flows={flows} selected={flowIds} onChange={setFlowIds} />
        </div>

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
          <button onClick={onClose} disabled={revoking} className={cancelBtnCls}>
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
  const [editingUser,  setEditingUser]  = useState(null)
  const [revokingUser, setRevokingUser] = useState(null)
  const [toast,        setToast]        = useState(null)

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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getUserFlowIds(userId) {
    return permissions.filter(p => p.user_id === userId).map(p => p.flow_id)
  }

  function getFlowsDisplay(u) {
    if (isBanned(u)) return null
    if (u.role === 'admin') return 'Todos los flujos'
    const ids   = getUserFlowIds(u.id)
    const names = flows.filter(f => ids.includes(f.id)).map(f => f.name)
    return names.length > 0 ? names.join(', ') : null
  }

  // ── Loading state ────────────────────────────────────────────────────────────

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

  // Evaluadores: everyone except the current admin
  const evaluadores = users.filter(u => u.id !== currentUser?.id)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Equipo</h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Gestiona los evaluadores y los flujos que pueden evaluar.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex-shrink-0 px-4 py-2 bg-accent text-white text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          + Invitar evaluador
        </button>
      </div>

      {/* Empty state */}
      {evaluadores.length === 0 ? (
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
            + Invitar primer evaluador
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
              {evaluadores.map(u => {
                const banned       = isBanned(u)
                const flowsDisplay = getFlowsDisplay(u)
                const userFlowIds  = getUserFlowIds(u.id)
                const lastSeen     = fmtDate(u.last_sign_in_at)

                return (
                  <tr
                    key={u.id}
                    className="border-b border-border-default last:border-b-0"
                  >
                    {/* Persona */}
                    <td className="py-3.5 px-4 pl-5">
                      <span className="text-[13px] font-medium text-text-primary">
                        {u.email}
                      </span>
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
                        {!banned && (
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
