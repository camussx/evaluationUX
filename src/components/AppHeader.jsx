import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ── AppHeader ─────────────────────────────────────────────────────────────────
//
// Single sticky top bar: brand · nav · role badge · email · logout
// Replaces the old Header + TabNav pair.

const ROLE_COLORS = {
  admin:     '#5B5FC7',
  evaluador: '#059669',
  viewer:    '#6B7280',
}

const ROLE_LABELS = {
  admin:     'Admin',
  evaluador: 'Evaluador',
  viewer:    'Viewer',
}

export default function AppHeader() {
  const { user, role, signOut } = useAuth()

  const NAV_TABS = [
    { to: '/',          label: 'Dashboard', end: true          },
    { to: '/flujos',    label: 'Flujos'                        },
    { to: '/criterios', label: 'Criterios'                     },
    ...(role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  const roleColor = ROLE_COLORS[role] ?? '#6B7280'

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: '#FFFFFF', borderBottomColor: '#E5E7EB' }}
    >
      <div className="max-w-[960px] mx-auto px-4 flex items-center h-12 gap-4">

        {/* ── Brand ── */}
        <span className="text-[13px] font-bold text-text-primary whitespace-nowrap flex-shrink-0">
          UX Evaluation
        </span>

        {/* ── Nav ── */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
          {NAV_TABS.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => [
                'px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap no-underline transition-colors duration-150',
                isActive
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated',
              ].join(' ')}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        {/* ── User info ── */}
        {user && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Role badge */}
            {role && (
              <span
                className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider"
                style={{
                  color:       roleColor,
                  borderColor: roleColor,
                  background:  `${roleColor}18`,
                }}
              >
                {ROLE_LABELS[role] ?? role}
              </span>
            )}

            {/* Email */}
            <span className="hidden md:block text-[12px] text-text-secondary truncate max-w-[150px]">
              {user.email}
            </span>

            {/* Logout — visible and clear */}
            <button
              onClick={signOut}
              className="text-[12px] font-semibold text-text-secondary border border-border-default rounded-md px-3 py-1 hover:text-danger hover:border-danger/60 transition-colors duration-150"
            >
              Salir
            </button>
          </div>
        )}

      </div>
    </header>
  )
}
