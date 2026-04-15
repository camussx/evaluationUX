import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ── LoginPage ─────────────────────────────────────────────────────────────────
//
// Magic-link (passwordless) login.
// There is no public registration: admins invite users from the Supabase
// dashboard (Authentication → Users → Invite user).  The invited user receives
// a magic link, clicks it, lands here (or on the app root), and chooses their
// role on the RoleSelector screen (rendered by ProtectedRoute).

export default function LoginPage() {
  const { user, loading } = useAuth()
  const navigate          = useNavigate()
  const location          = useLocation()

  const [email,   setEmail]   = useState('')
  const [status,  setStatus]  = useState('idle')   // 'idle' | 'sending' | 'sent' | 'error'
  const [errMsg,  setErrMsg]  = useState('')

  // Redirect away if already authenticated
  useEffect(() => {
    if (!loading && user) {
      const dest = location.state?.from?.pathname ?? '/'
      navigate(dest, { replace: true })
    }
  }, [loading, user, navigate, location.state])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setStatus('sending')
    setErrMsg('')

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        // After clicking the magic link the browser opens the app root;
        // the Supabase client picks up the token from the URL automatically.
        emailRedirectTo: window.location.origin,
        shouldCreateUser: false,  // only pre-invited users can sign in
      },
    })

    if (error) {
      setErrMsg(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  // ── Sent confirmation ────────────────────────────────────────────────────────
  if (status === 'sent') {
    return (
      <LoginShell>
        <div className="text-center">
          <div className="text-5xl mb-5">📬</div>
          <h2 className="text-[20px] font-bold text-text-primary mb-2">
            Revisa tu correo
          </h2>
          <p className="text-[14px] text-text-secondary mb-1">
            Enviamos un acceso a:
          </p>
          <p className="text-[14px] font-semibold text-accent mb-6">{email}</p>
          <p className="text-[12px] text-text-hint">
            El enlace expira en 60 minutos. Si no ves el correo, revisa tu carpeta de spam.
          </p>
          <button
            onClick={() => { setStatus('idle'); setEmail('') }}
            className="mt-6 text-[12px] text-text-hint hover:text-text-secondary transition-colors underline"
          >
            Usar otro correo
          </button>
        </div>
      </LoginShell>
    )
  }

  // ── Login form ───────────────────────────────────────────────────────────────
  return (
    <LoginShell>
      <div className="mb-7 text-center">
        <div
          className="text-[10px] font-bold tracking-[3px] uppercase mb-3"
          style={{ color: '#C1272D' }}
        >
          SCB · Design &amp; Experience
        </div>
        <h1 className="text-[22px] font-bold text-text-primary mb-1.5">
          UX Evaluation Framework
        </h1>
        <p className="text-[13px] text-text-secondary">
          Accede con tu correo institucional — sin contraseña.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            required
            autoFocus
            className="w-full bg-background-elevated border border-border-default rounded-lg px-3.5 py-2.5 text-[14px] text-text-primary placeholder:text-text-hint focus:outline-none focus:border-accent transition-colors duration-150"
          />
        </div>

        {status === 'error' && (
          <p className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {errMsg || 'No pudimos enviar el acceso. Verifica que tu correo esté registrado.'}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'sending' || !email.trim()}
          className="w-full py-3 rounded-lg bg-accent text-background-base text-[14px] font-bold transition-opacity disabled:opacity-50"
        >
          {status === 'sending' ? 'Enviando…' : 'Recibir acceso'}
        </button>
      </form>

      <p className="mt-6 text-center text-[11px] text-text-hint leading-relaxed">
        El acceso es solo por invitación.
        Contacta a tu administrador si necesitas una cuenta.
      </p>
    </LoginShell>
  )
}

// ── Shell layout (no app Header/TabNav) ──────────────────────────────────────

function LoginShell({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0F1117' }}
    >
      {/* Subtle decorative blobs */}
      <div
        className="pointer-events-none fixed top-0 left-0 w-full h-full overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 500, height: 500,
            top: '-120px', right: '-120px',
            background: 'radial-gradient(circle, rgba(147,180,250,0.06) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 400, height: 400,
            bottom: '-80px', left: '-80px',
            background: 'radial-gradient(circle, rgba(193,39,45,0.04) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative w-full max-w-sm bg-background-surface border border-border-default rounded-2xl p-8 shadow-2xl">
        {children}
      </div>
    </div>
  )
}
