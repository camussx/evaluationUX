import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext(null)

// ── AuthProvider ──────────────────────────────────────────────────────────────
//
// Mount once at the root of the app (outside BrowserRouter so all routes share
// the same auth state without re-subscribing on navigation).
//
// Role is read from user_metadata.role — it is set once by the user on their
// first login (role-selector screen) and can be overridden by an admin via the
// Supabase dashboard or a service-role call.

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)  // undefined = not yet resolved
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Resolve the current session immediately (also handles magic-link tokens
    //    embedded in the URL hash on first redirect after clicking the link).
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })

    // 2. Keep state in sync with every future auth event (sign-in, sign-out,
    //    token refresh, magic-link callback…).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)   // covers the case where the event fires before getSession
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Derived values ──────────────────────────────────────────────────────────

  const user = session?.user ?? null
  const role = user?.user_metadata?.role ?? null   // 'admin' | 'evaluador' | 'viewer' | null

  // ── Actions ─────────────────────────────────────────────────────────────────

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  /**
   * setRole(role) – persists the chosen role to user_metadata.
   * Called once from the RoleSelector on first login.
   * Triggers a session refresh so the new JWT carries the updated metadata.
   */
  const setRole = useCallback(async (newRole) => {
    const { data, error } = await supabase.auth.updateUser({ data: { role: newRole } })
    if (error) throw error
    // updateUser emits an onAuthStateChange event that updates `session` for us,
    // but we also set it synchronously to avoid a render gap.
    setSession(prev => prev ? { ...prev, user: data.user } : prev)
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut, setRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── useAuth ───────────────────────────────────────────────────────────────────

/**
 * useAuth() → { user, role, loading, signOut, setRole }
 *
 * Must be called inside a component tree wrapped by <AuthProvider>.
 *
 * - user    Supabase User object or null
 * - role    'admin' | 'evaluador' | 'viewer' | null (null = not chosen yet)
 * - loading true while the initial session is being resolved
 * - signOut () => Promise — ends the session
 * - setRole (role: string) => Promise — saves role to user_metadata (first-login use)
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === null) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
