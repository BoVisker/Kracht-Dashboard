// Exchanges a Strava OAuth authorization code for access/refresh tokens.
// The client secret lives only here (Supabase secret STRAVA_CLIENT_SECRET),
// never in the frontend bundle -- see ARCHITECTURE.md "OAuth tokens".
//
// Called by the frontend right after Strava redirects back with ?code=...
// (see src/App.tsx's OAuth-callback effect). The frontend is already an
// authenticated Supabase session at that point, so this follows the same
// JWT-verification pattern as hevy-sync / save-provider-token rather than
// trying to identify the user from OAuth `state` (simpler, and avoids
// putting a bearer token in a URL that browsers/servers log).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

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

    const { code } = (await req.json()) as { code?: string }
    if (!code) return json({ error: 'Missing code' }, 400)

    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      return json({ error: 'Strava client credentials not configured server-side (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET).' }, 500)
    }

    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const detail = await tokenRes.text()
      return json({ error: `Strava token exchange failed (HTTP ${tokenRes.status}): ${detail}` }, 400)
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string
      refresh_token: string
      expires_at: number // unix seconds
    }

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error: upsertError } = await admin.from('provider_tokens').upsert(
      {
        user_id: userData.user.id,
        provider: 'strava',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    if (upsertError) return json({ error: upsertError.message }, 500)

    await admin
      .from('integrations')
      .upsert(
        { user_id: userData.user.id, provider: 'strava', status: 'connected', last_error: null },
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
