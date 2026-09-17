import { ApiError } from "@/lib/api-client";

/** Same minimum the backend enforces when a password is set or changed. */
export const MIN_PASSWORD_LENGTH = 8;

/** Reset and setup links stay valid this long (backend SETUP_TOKEN_TTL_MS). */
export const LINK_TTL_HOURS = 72;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

/** Checks the email field; returns an error message or undefined. */
export function emailError(value: string) {
  if (!value.trim()) return "Enter your work email.";
  if (!isEmail(value)) return "Enter a full email address, like jane@example.com.";
  return undefined;
}

const AUTH_PAGES = ["/auth", "/set-password", "/forgot-password"];

/** Returns a same-site path to open after sign-in, or null when the value isn't safe. */
export function safeRedirectPath(value: string | undefined | null): string | null {
  if (!value || !value.startsWith("/") || typeof window === "undefined") return null;
  let url: URL;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (AUTH_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return null;
  return url.pathname + url.search + url.hash;
}

/** Plain message for failures that aren't about what the person typed. */
export function requestErrorMessage(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Too many attempts. Wait a minute, then try again.";
    if (err.status >= 500) return "AIMS had a problem. Try again in a moment.";
    return err.message;
  }
  return "Couldn't reach AIMS. Check your connection and try again.";
}
