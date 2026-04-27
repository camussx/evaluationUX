import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useNavigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import AppHeader from './components/AppHeader'
import ProtectedRoute, { LoadingScreen } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import FlujosPage from './pages/FlujosPage'
import FlujosDetailPage from './pages/FlujosDetailPage'
import EvaluarPage from './pages/EvaluarPage'
import CriteriosPage from './pages/CriteriosPage'
import AdminPage from './pages/AdminPage'

// ── Shared layout ─────────────────────────────────────────────────────────────

function AppLayout() {
  return (
    <div className="min-h-screen bg-background-base text-text-primary">
      <AppHeader />
      <main className="max-w-[960px] mx-auto px-4 pt-8 pb-20">
        <Outlet />
      </main>
    </div>
  )
}

// ── FlowProtectedRoute ────────────────────────────────────────────────────────
//
// Guards /flujos/:id and /flujos/:id/evaluar
//   Admin     → always allowed
//   Evaluador → only if flow_id is in their flow_evaluator_permissions
//   Otherwise → redirect to / with accessDenied state

function FlowProtectedRoute({ children }) {
  const { user, role, loading: authLoading } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // 'checking' | 'allowed'

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login', { replace: true }); return }

    if (role === 'admin') {
      setStatus('allowed')
      return
    }

    if (role === 'evaluador') {
      supabase
        .from('flow_evaluator_permissions')
        .select('flow_id')
        .eq('user_id', user.id)
        .eq('flow_id', id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setStatus('allowed')
          } else {
            navigate('/', {
              replace: true,
              state: { accessDenied: 'No tienes acceso a ese flujo.' },
            })
          }
        })
      return
    }

    // No valid role → back to login
    navigate('/login', { replace: true })
  }, [authLoading, user, role, id, navigate])

  if (authLoading || status === 'checking') return <LoadingScreen />
  return status === 'allowed' ? children : null
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Protected ── */}
          <Route element={<AppLayout />}>

            {/* Dashboard — landing for all roles */}
            <Route path="/" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />

            {/* Flujos — admin only; evaluador is redirected to / */}
            <Route path="/flujos" element={
              <ProtectedRoute allowedRoles={['admin']} redirectTo="/">
                <FlujosPage />
              </ProtectedRoute>
            } />

            {/* Flow detail — admin always; evaluador only if assigned */}
            <Route path="/flujos/:id" element={
              <ProtectedRoute>
                <FlowProtectedRoute>
                  <FlujosDetailPage />
                </FlowProtectedRoute>
              </ProtectedRoute>
            } />

            {/* Evaluar — admin always; evaluador only if assigned */}
            <Route path="/flujos/:id/evaluar" element={
              <ProtectedRoute>
                <FlowProtectedRoute>
                  <EvaluarPage />
                </FlowProtectedRoute>
              </ProtectedRoute>
            } />

            {/* Criterios — all roles */}
            <Route path="/criterios" element={
              <ProtectedRoute><CriteriosPage /></ProtectedRoute>
            } />

            {/* Admin/Equipo — admin only; evaluador is redirected to / */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']} redirectTo="/">
                <AdminPage />
              </ProtectedRoute>
            } />

            {/* ── Legacy redirects ── */}
            <Route path="/flows"           element={<Navigate to="/flujos"    replace />} />
            <Route path="/flows/:id"       element={<Navigate to="/"          replace />} />
            <Route path="/referencia"      element={<Navigate to="/criterios" replace />} />
            <Route path="/framework"       element={<Navigate to="/criterios" replace />} />
            <Route path="/evaluador"       element={<Navigate to="/"          replace />} />

          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
