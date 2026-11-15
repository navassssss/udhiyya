const configuredBase =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000/api/v1";

const normalizedBase = configuredBase.replace(/\/+$/, "");

export const API_BASE = /\/api\/v1$/i.test(normalizedBase)
  ? normalizedBase
  : `${normalizedBase}/api/v1`;
