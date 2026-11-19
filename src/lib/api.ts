import { opsApiUrl } from "./api-url";

export const isDemo = import.meta.env["VITE_WORKSPACE_MODE"] === "demo";
const base = opsApiUrl(import.meta.env["VITE_API_URL"]);
let accessToken: string | null = null;
let refreshing: Promise<void> | undefined;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function failure(response: Response): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(
    Array.isArray(body?.message)
      ? body.message.join(". ")
      : typeof body?.message === "string"
        ? body.message
        : `The server could not complete this request (${response.status}).`,
    response.status,
  );
}

export async function restoreSession() {
  if (!refreshing) {
    refreshing = (async () => {
      const response = await fetch(`${base}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "X-Ops-Request": "1" },
      });
      if (!response.ok) await failure(response);
      const body = await response.json();
      accessToken = body.accessToken;
      window.dispatchEvent(new Event("amsol-ops-session-refreshed"));
    })().finally(() => {
      refreshing = undefined;
    });
  }
  return refreshing;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<Response> {
  const request = () =>
    fetch(`${base}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "X-Ops-Request": "1",
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(authenticated && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  let response: Response;
  try {
    response = await request();
    if (authenticated && response.status === 401) {
      await restoreSession();
      response = await request();
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      accessToken = null;
      window.dispatchEvent(new Event("amsol-ops-session-expired"));
      throw error;
    }
    throw new Error(
      "Cannot reach the Amsol Ops server. Check that the backend is running and try again.",
    );
  }
  if (!response.ok) {
    if (authenticated && response.status === 401) {
      accessToken = null;
      window.dispatchEvent(new Event("amsol-ops-session-expired"));
    }
    await failure(response);
  }
  return response;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const response = await apiFetch(path, options, authenticated);
  if (options.headers && new Headers(options.headers).get("Accept") === "application/octet-stream")
    return (await response.blob()) as T;
  return response.status === 204 ? (undefined as T) : response.json();
}
