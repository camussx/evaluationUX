import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ── ProtectedRoute ────────────────────────────────────────────────────────────
//
// Usage:
//   <ProtectedRoute>                           ← any authenticated role
//   <ProtectedRoute allowedRoles={['admin']}>  ← specific roles only
//
// Auth flow:
//   loading          → full-screen spinner (auth state not yet resolved)
//   no user          → redirect to /login (preserving the intended URL)
//   no role          → RoleSelector overlay (first-login, one-time screen)
//   disallowed role  → AccessDenied screen
//   pass             → render children

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading, setRole } = useAuth()
  const location = useLocation()

  if (loading)            return <LoadingScreen />
  if (!user)              return <Navigate to="/login" state={{ from: location }} replace />
  if (!role)              return <RoleSelector onConfirm={setRole} />
  if (allowedRoles && !allowedRoles.includes(role)) return <AccessDenied role={role} />

  return children
}

// ── LoadingScreen ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: '#0F1117' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <span className="text-[13px] text-text-hint">Verificando sesión…</span>
      </div>
    </div>
  )
}

// ── RoleSelector ──────────────────────────────────────────────────────────────
//
// Shown once — when the user is authenticated but has not yet chosen a role.
// The admin invites the user via Supabase Dashboard; the user picks their role
// here on first login.  An admin can later override it from the dashboard.

const ROLES = [
  {
    id: 'admin',
    icon: '🛡️',
    label: 'Administrador',
    desc: 'Crea flujos, gestiona evaluadores y accede a todo el historial del equipo.',
    color: '#93B4FA',
  },
  {
    id: 'evaluador',
    icon: '🎯',
    label: 'Evaluador',
    desc: 'Evalúa los flujos asignados y consulta el historial de evaluaciones.',
    color: '#34D399',
  },
  {
    id: 'viewer',
    icon: '👁️',
    label: 'Viewer',
    desc: 'Solo lectura. Puede explorar flujos y evaluaciones sin participar.',
    color: '#6B7280',
  },
]

function RoleSelector({ onConfirm }) {
  const [selected, setSelected] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)

  async function confirm() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await onConfirm(selected)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: '#0F1117' }}
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="text-[10px] font-bold tracking-[3px] uppercase mb-3"
            style={{ color: '#C1272D' }}
          >
            SCB · Design &amp; Experience
          </div>
          <h1 className="text-[22px] font-bold text-text-primary mb-2">
            Bienvenido al equipo
          </h1>
          <p className="text-[13px] text-text-secondary">
            Elige el rol que mejor describe tu función. Tu administrador
            puede ajustarlo en cualquier momento.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {ROLES.map(r => {
            const isSelected = selected === r.id
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={[
                  'text-left p-4 rounded-xl border-2 transition-all duration-150',
                  'focus:outline-none',
                  isSelected
                    ? 'bg-background-elevated'
                    : 'bg-background-surface border-border-default hover:border-text-hint',
                ].join(' ')}
                style={isSelected ? { borderColor: r.color } : {}}
              >
                <div className="text-2xl mb-2">{r.icon}</div>
                <div
                  className="text-[13px] font-bold mb-1"
                  style={{ color: isSelected ? r.color : '#F0F2F7' }}
                >
                  {r.label}
                </div>
                <p className="text-[11px] text-text-hint leading-relaxed">{r.desc}</p>
              </button>
            )
          })}
        </div>

        {error && (
          <p className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mb-4 text-center">
            {error}
          </p>
        )}

        <button
          onClick={confirm}
          disabled={!selected || saving}
          className="w-full py-3 rounded-lg bg-accent text-background-base text-[14px] font-bold transition-opacity disabled:opacity-40"
        >
          {saving ? 'Guardando…' : selected ? `Continuar como ${ROLES.find(r => r.id === selected)?.label}` : 'Selecciona un rol'}
        </button>

        <p className="text-center text-[11px] text-text-hint mt-4">
          ⚠️ Si no estás seguro, elige <strong className="text-text-secondary">Viewer</strong>.
          Un administrador puede elevar tu acceso después.
        </p>
      </div>
    </div>
  )
}

// ── AccessDenied ──────────────────────────────────────────────────────────────

const ROLE_LABELS = { admin: 'Administrador', evaluador: 'Evaluador', viewer: 'Viewer' }

function AccessDenied({ role }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="text-4xl mb-5">🔒</div>
      <h2 className="text-[18px] font-bold text-text-primary mb-2">Acceso restringido</h2>
      <p className="text-[13px] text-text-secondary max-w-sm mb-1">
        Tu rol actual —{' '}
        <span className="font-semibold text-text-primary">{ROLE_LABELS[role] ?? role}</span>
        {' '}— no tiene permiso para acceder a esta sección.
      </p>
      <p className="text-[12px] text-text-hint max-w-sm mb-6">
        Solicita a tu administrador que eleve tu nivel de acceso desde el panel de Supabase.
      </p>
      <a
        href="/"
        className="px-5 py-2.5 rounded-lg border border-border-default text-[13px] text-text-secondary hover:text-text-primary hover:border-text-hint transition-all"
      >
        ← Volver al inicio
      </a>
    </div>
  )
}
