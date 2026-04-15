import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Header from './components/Header'
import TabNav from './components/TabNav'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RubricTab from './pages/RubricTab'
import EvaluadorTab from './pages/EvaluadorTab'
import FrameworkTab from './pages/FrameworkTab'
import FlowsPage from './pages/FlowsPage'
import FlowDetailPage from './pages/FlowDetailPage'

// ── Shared layout for all authenticated routes ────────────────────────────────

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
        <span style={{ color: '#C1272D' }}>UX Evaluation Framework</span>
        {' '}· SCB Design &amp; Experience ·{' '}
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

            {/* All authenticated roles */}
            <Route path="/" element={
              <ProtectedRoute><RubricTab /></ProtectedRoute>
            } />
            <Route path="/framework" element={
              <ProtectedRoute><FrameworkTab /></ProtectedRoute>
            } />
            <Route path="/flows" element={
              <ProtectedRoute><FlowsPage /></ProtectedRoute>
            } />
            <Route path="/flows/:id" element={
              <ProtectedRoute><FlowDetailPage /></ProtectedRoute>
            } />

            {/* Admin + evaluador only */}
            <Route path="/evaluador" element={
              <ProtectedRoute allowedRoles={['admin', 'evaluador']}>
                <EvaluadorTab />
              </ProtectedRoute>
            } />
            <Route path="/flows/:id/evaluate" element={
              <ProtectedRoute allowedRoles={['admin', 'evaluador']}>
                <EvaluadorTab />
              </ProtectedRoute>
            } />

          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
