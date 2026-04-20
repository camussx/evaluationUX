import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Header from './components/Header'
import TabNav from './components/TabNav'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import ReferencePage from './pages/ReferencePage'
import EvaluadorTab from './pages/EvaluadorTab'
import FlowsPage from './pages/FlowsPage'
import FlowDetailPage from './pages/FlowDetailPage'
import AdminPage from './pages/AdminPage'

// ── Shared layout ─────────────────────────────────────────────────────────────

function AppLayout() {
  return (
    <div className="min-h-screen bg-background-base text-text-primary">
      <Header />
      <TabNav />

      <main className="max-w-[920px] mx-auto px-4 pt-7 pb-16">
        <Outlet />
      </main>

      <footer
        className="border-t border-border-default text-center py-3.5 px-4 text-[11px] text-text-hint"
        style={{ background: '#1A1D27' }}
      >
        UX Evaluation Framework · SCB Design &amp; Experience ·{' '}
        Refs: Nielsen (1994) · Fogg (2002) · Kurosu (1995) · Baymard Institute (2023) · WCAG 2.1 · RAIL Model (Google)
      </footer>
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

          {/* ── Protected (all share the Header + TabNav layout) ── */}
          <Route element={<AppLayout />}>

            {/* Dashboard: FlowsPage as landing */}
            <Route path="/" element={
              <ProtectedRoute><FlowsPage /></ProtectedRoute>
            } />

            {/* Redirect legacy /flows to root */}
            <Route path="/flows" element={<Navigate to="/" replace />} />

            {/* Flow detail + evaluate */}
            <Route path="/flows/:id" element={
              <ProtectedRoute><FlowDetailPage /></ProtectedRoute>
            } />
            <Route path="/flows/:id/evaluate" element={
              <ProtectedRoute allowedRoles={['admin', 'evaluador']}>
                <EvaluadorTab />
              </ProtectedRoute>
            } />

            {/* Reference: merged Rúbrica + Framework */}
            <Route path="/referencia" element={
              <ProtectedRoute><ReferencePage /></ProtectedRoute>
            } />

            {/* Admin: evaluator permissions — admin only */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            } />

            {/* Redirect legacy standalone evaluador route */}
            <Route path="/evaluador" element={<Navigate to="/" replace />} />

            {/* Redirect legacy framework tab */}
            <Route path="/framework" element={<Navigate to="/referencia" replace />} />

          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
