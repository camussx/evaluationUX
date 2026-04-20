import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import AppHeader from './components/AppHeader'
import ProtectedRoute from './components/ProtectedRoute'
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

            {/* Dashboard — landing */}
            <Route path="/" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />

            {/* Flujos */}
            <Route path="/flujos" element={
              <ProtectedRoute><FlujosPage /></ProtectedRoute>
            } />
            <Route path="/flujos/:id" element={
              <ProtectedRoute><FlujosDetailPage /></ProtectedRoute>
            } />
            <Route path="/flujos/:id/evaluar" element={
              <ProtectedRoute allowedRoles={['admin', 'evaluador']}>
                <EvaluarPage />
              </ProtectedRoute>
            } />

            {/* Criterios */}
            <Route path="/criterios" element={
              <ProtectedRoute><CriteriosPage /></ProtectedRoute>
            } />

            {/* Admin */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
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
