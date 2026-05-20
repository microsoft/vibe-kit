/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXTERNAL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
