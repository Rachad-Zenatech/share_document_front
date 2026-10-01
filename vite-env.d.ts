interface ImportMetaEnv {
  // Define your variables with the VITE_ prefix
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}