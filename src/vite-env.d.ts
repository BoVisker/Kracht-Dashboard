/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Public by design (OAuth2 authorization-code flow) -- the client secret never leaves the server, see strava-exchange-token. */
  readonly VITE_STRAVA_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
