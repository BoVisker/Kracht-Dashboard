import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { AuthContext, type AuthState } from './context'

/**
 * Single-user app: one Supabase Auth account, created manually by the
 * owner (see README setup step 1.5). This provider just tracks that one
 * session so RLS-protected queries and Edge Function calls carry a JWT.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const signInWithPassword: AuthState['signInWithPassword'] = async (email, password) => {
    if (!supabase) return { error: 'Supabase is niet geconfigureerd.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signInWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
