const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const LOGIN_AT_KEY = "login_at";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

export const ROLE_STUDENT = "student";
export const ROLE_INSTRUCTOR = "instructor";

export type SessionData = {
  token: string;
  role: string;
  loginAt: number;
};

export const saveSession = (token: string, role: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(LOGIN_AT_KEY);
};

export const getValidSession = (): SessionData | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const role = localStorage.getItem(ROLE_KEY);
  const loginAtRaw = localStorage.getItem(LOGIN_AT_KEY);
  const loginAt = Number(loginAtRaw);

  if (!token || !role || !Number.isFinite(loginAt)) {
    clearSession();
    return null;
  }

  if (Date.now() - loginAt > SESSION_TTL_MS) {
    clearSession();
    return null;
  }

  return { token, role, loginAt };
};

/** Valid bearer token only (null if session expired/missing). */
export const getAuthToken = (): string | null => getValidSession()?.token ?? null;

/** Authorization header object for axios calls. */
export const authHeaders = (): { Authorization: string } | Record<string, never> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Default home path for a role after login / wrong-portal bounce. */
export const getHomePath = (role?: string | null): string => {
  if (role === ROLE_INSTRUCTOR) return "/dashboard";
  if (role === ROLE_STUDENT) return "/student-dashboard";
  return "/login";
};

/** Login portal for a required role (used by route guards). */
export const getLoginPath = (requiredRole?: string | null): string => {
  if (requiredRole === ROLE_INSTRUCTOR) return "/admin-login";
  return "/login";
};

export const isStudent = (role?: string | null) => role === ROLE_STUDENT;
export const isInstructor = (role?: string | null) => role === ROLE_INSTRUCTOR;
