// Shared CORS headers for Edge Functions called directly from the
// GitHub Pages frontend (supabase-js sets these automatically for
// functions.invoke, but a manual fetch/preflight still needs them).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
