import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const TABS = [
  { to: '/',           label: '📂 Flujos',    end: true                       },
  { to: '/referencia', label: '📋 Referencia'                                 },
  { to: '/admin',      label: '⚙️ Admin',     roles: ['admin']                },
]

const ROLE_META = {
  admin:     { label: 'Admin',     color: '#93B4FA' },
  evaluador: { label: 'Evaluador', color: '#34D399' },
  viewer:    { label: 'Viewer',    color: '#6B7280' },
}

export default function TabNav() {
  const { user, role, signOut } = useAuth()

  // Hide tabs the current role cannot access
  const visibleTabs = TABS.filter(t => !t.roles || !role || t.roles.includes(role))

  const meta = ROLE_META[role] ?? null

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{ background: '#1A1D27', borderBottomColor: '#2E3347' }}
    >
      <div className="max-w-[920px] mx-auto flex items-stretch overflow-x-auto">

        {/* ── Left: navigation tabs ── */}
        {visibleTabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => [
              'px-5 py-3.5 text-[13px] font-semibold font-sans cursor-pointer whitespace-nowrap no-underline flex-shrink-0',
              'border-b-[3px] transition-all duration-200',
              isActive
                ? 'text-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary',
            ].join(' ')}
          >
            {t.label}
          </NavLink>
        ))}

        {/* ── Right: user info + sign-out ── */}
        {user && (
          <div className="ml-auto flex items-center gap-3 pl-4 pr-3 flex-shrink-0">
            {/* Role badge */}
            {meta && (
              <span
                className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider"
                style={{
                  color:       meta.color,
                  borderColor: meta.color,
                  background:  `${meta.color}18`,
                }}
              >
                {meta.label}
              </span>
            )}

            {/* Email (desktop only) */}
            <span className="hidden md:block text-[11px] text-text-hint truncate max-w-[160px]">
              {user.email}
            </span>

            {/* Sign-out */}
            <button
              onClick={signOut}
              title="Cerrar sesión"
              className="text-[12px] text-text-hint hover:text-danger transition-colors px-2 py-1 rounded hover:bg-danger/10"
            >
              Salir
            </button>
          </div>
        )}

      </div>
    </nav>
  )
}
