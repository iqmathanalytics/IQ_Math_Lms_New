// src/config.ts

function resolveApiBaseUrl(): string {
  const raw = String(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1").trim();
  // Strip accidental quotes from .env values: VITE_API_URL="http://..."
  const cleaned = raw.replace(/^['"]|['"]$/g, "").replace(/\/+$/, "");
  return cleaned || "http://127.0.0.1:8000/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();

export const endpoints = {
  login: `${API_BASE_URL}/login`,
  courses: `${API_BASE_URL}/courses`,
};

export default API_BASE_URL;
