import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/useAuth'
import { isSupabaseConfigured } from '../../lib/supabase'

/**
 * Without Supabase configured there's no auth to gate on -- the app still
 * renders (showing its honest "not connected" states everywhere) rather
 * than blocking on a login screen that can't possibly work yet.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured()) return <>{children}</>
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
