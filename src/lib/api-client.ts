const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
// Caches the outcome of the last session check (see ensureSession below). Kept in sync by
// setAccessToken so a route guard checked right after login/demoLogin, or right after a
// refresh failure, never sees a stale result from before that state change.
let sessionPromise: Promise<boolean> | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  sessionPromise = Promise.resolve(token !== null);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseError(res: Response) {
  try {
    const body = await res.json();
    return body.message
      ? Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message
      : res.statusText;
  } catch {
    return res.statusText;
  }
}

/** Exchanges the httpOnly refresh cookie for a new access token. Deduped across concurrent callers. */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null;
          return false;
        }
        const body = await res.json();
        accessToken = body.accessToken;
        return true;
      })
      .catch(() => {
        accessToken = null;
        return false;
      })
      .then((ok) => {
        sessionPromise = Promise.resolve(ok);
        return ok;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Runs the initial silent refresh exactly once per page load, shared by AuthProvider and route guards. */
export function ensureSession(): Promise<boolean> {
  if (!sessionPromise) sessionPromise = refreshAccessToken();
  return sessionPromise;
}

export function resetSession() {
  sessionPromise = null;
  accessToken = null;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  _retried = false,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  // FormData sets its own multipart boundary in the Content-Type header — the browser only
  // does this correctly if we leave the header unset entirely.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });

  if (res.status === 401 && !_retried && path !== "/auth/refresh" && path !== "/auth/login") {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch(path, init, true);
  }

  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}
