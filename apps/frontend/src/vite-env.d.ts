/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_SUPERADMIN_URL?: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
