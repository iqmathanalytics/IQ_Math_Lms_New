/**
 * Vite BASE_URL is "/" in local dev and "/lms/" in production.
 * React Router basename already covers <Link>/<Navigate>/navigate().
 * Use these helpers for absolute URLs, window.open, and location.href.
 */

export function appBasePath(): string {
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return base || "";
}

/** App-relative path with base prefix, e.g. "/share/courses/1" → "/lms/share/courses/1". */
export function withBasePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = appBasePath();
  if (!base) return normalized;
  if (normalized === "/") return `${base}/`;
  return `${base}${normalized}`;
}

/** Full URL for sharing / clipboard, e.g. https://www.iqmath.in/lms/share/courses/1 */
export function absoluteAppUrl(path: string): string {
  if (typeof window === "undefined") return withBasePath(path);
  return `${window.location.origin}${withBasePath(path)}`;
}

/** Public asset under Vite base, e.g. "iqmath-logo.png" → "/lms/iqmath-logo.png" */
export function publicAsset(file: string): string {
  const name = file.replace(/^\//, "");
  const base = String(import.meta.env.BASE_URL || "/");
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
}
