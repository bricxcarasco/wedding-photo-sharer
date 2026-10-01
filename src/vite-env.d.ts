/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
  readonly VITE_COUPLE?: string;
  readonly VITE_WEDDING_DATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
