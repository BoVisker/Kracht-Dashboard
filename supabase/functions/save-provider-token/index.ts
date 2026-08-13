// The path for a manually-entered provider secret (currently just Hevy's
// API key) to get into provider_tokens. That table has no RLS policies for
// anon/authenticated (see migration 0001) -- writing to it requires
// service_role, which only this function holds. Strava's tokens take a
// different path (strava-exchange-token, since OAuth's authorization-code
// exchange needs the client secret too, not just a plain upsert), and
// Garmin has no real integration to write tokens for at all -- see
// README.md "Garmin research findings". `provider` still accepts all three
// so this stays a general-purpose write path if that ever changes.
//
// The frontend calls this once, when the user pastes their Hevy API key
// into Settings/Sync. The key itself still passes through the browser at
// that moment (there's no way around that -- the user has to type it
// somewhere), but it is sent straight to this function over HTTPS and
// never written to localStorage, never logged, and never appears in the
// GitHub Pages bundle the way the old dashboard.html's embedded key did.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const ALLOWED_PROVIDERS = ['hevy', 'strava', 'garmin']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await anonClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid or expired session' }, 401)

    const body = await req.json()
    const { provider, accessToken, refreshToken, expiresAt } = body as {
      provider?: string
      accessToken?: string
      refreshToken?: string
      expiresAt?: string
    }

    if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
      return json({ error: `provider must be one of ${ALLOWED_PROVIDERS.join(', ')}` }, 400)
    }
    if (!accessToken) return json({ error: 'accessToken is required' }, 400)

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error } = await admin.from('provider_tokens').upsert(
      {
        user_id: userData.user.id,
        provider,
        access_token: accessToken,
        refresh_token: refreshToken ?? null,
        expires_at: expiresAt ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    if (error) return json({ error: error.message }, 500)

    await admin
      .from('integrations')
      .upsert(
        { user_id: userData.user.id, provider, status: 'connected', last_error: null },
        { onConflict: 'user_id,provider' },
      )

    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
