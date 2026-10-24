/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GEMINI_API_KEY: string
  readonly GEMINI_API_KEY: string
  readonly VITE_ENCRYPTION_KEY: string
  readonly VITE_PASSWORD_SALT: string
  readonly VITE_API_TOKEN: string
  readonly VITE_BROWSER_PREVIEW?: string
  readonly VITE_SIGNATURE_SECRET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
