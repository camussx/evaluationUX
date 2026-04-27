import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ── ProtectedRoute ────────────────────────────────────────────────────────────
//
// Usage:
//   <ProtectedRoute>                                      ← any authenticated role
//   <ProtectedRoute allowedRoles={['admin']}>             ← specific roles only
//   <ProtectedRoute allowedRoles={['admin']} redirectTo="/">  ← redirect on deny
//
// Auth flow:
//   loading          → full-screen spinner
//   no user          → redirect to /login
//   no role          → NoRole screen (contact admin — self-selection removed)
//   disallowed role  → redirectTo (if set) or AccessDenied screen
//   pass             → render children

export default function ProtectedRoute({ children, allowedRoles, redirectTo }) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />
  if (!role)   return <NoRole />

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (redirectTo) return <Navigate to={redirectTo} replace />
    return <AccessDenied role={role} />
  }

  return children
}

// ── LoadingScreen ─────────────────────────────────────────────────────────────

export function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: '#F0F2F7' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <span className="text-[13px] text-text-hint">Verificando sesión…</span>
      </div>
    </div>
  )
}

// ── NoRole ────────────────────────────────────────────────────────────────────
//
// Shown when the user is authenticated but has no role assigned.
// With the new model, roles are always assigned by an admin before first login.
// This screen is a safety net for edge cases.

function NoRole() {
  const { signOut } = useAuth()
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: '#F0F2F7' }}
    >
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-5">🔒</div>
        <h1 className="text-[20px] font-bold text-text-primary mb-2">
          Sin rol asignado
        </h1>
        <p className="text-[13px] text-text-secondary mb-6 leading-relaxed max-w-xs mx-auto">
          Tu cuenta no tiene un rol asignado. Contacta al administrador
          de la plataforma para que te otorgue acceso.
        </p>
        <button
          onClick={signOut}
          className="px-5 py-2.5 rounded-lg border border-border-default text-[13px] text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

// ── AccessDenied ──────────────────────────────────────────────────────────────

const ROLE_LABELS = { admin: 'Administrador', evaluador: 'Evaluador' }

function AccessDenied({ role }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="text-4xl mb-5">🔒</div>
      <h2 className="text-[18px] font-bold text-text-primary mb-2">
        Acceso restringido
      </h2>
      <p className="text-[13px] text-text-secondary max-w-sm mb-6">
        Tu rol —{' '}
        <span className="font-semibold text-text-primary">
          {ROLE_LABELS[role] ?? role}
        </span>
        {' '}— no tiene permiso para acceder a esta sección.
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
