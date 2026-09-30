import { useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

/**
 * True once no real user interaction (mouse/keyboard/touch/scroll) has happened for
 * `thresholdMs`. TanStack Query already pauses `refetchInterval` polling for a backgrounded/
 * minimized tab, but not for a tab that's still focused and visible while the person has simply
 * stepped away — left unchecked, that background polling silently refreshes the access token
 * forever and defeats the server's inactivity timeout (see AuthService.refreshAccessToken).
 * Consumers use this to pause their own `refetchInterval` while idle.
 */
export function useIsIdle(thresholdMs: number): boolean {
  const lastActivity = useRef(Date.now());
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    const markActive = () => {
      lastActivity.current = Date.now();
      setIsIdle(false);
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    const check = setInterval(() => {
      if (Date.now() - lastActivity.current >= thresholdMs) setIsIdle(true);
    }, 15_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      clearInterval(check);
    };
  }, [thresholdMs]);

  return isIdle;
}
