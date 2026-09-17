import { useEffect, useState } from "react";
import { useLayoutPreference, type LayoutMode } from "@/lib/layout-preference";

const STORAGE_KEY = "aims:layout-mode";

function hasSavedChoice() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "top" || v === "sidebar";
  } catch {
    return false;
  }
}

export function useMediaQuery(query: string, serverValue = true) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? serverValue : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** A saved choice wins; otherwise screens under 1536px get the sidebar so every item shows. */
export function useEffectiveLayout(preferSidebarWhenNarrow: boolean) {
  const { mode, setMode } = useLayoutPreference();
  const [saved, setSaved] = useState(hasSavedChoice);
  const wide = useMediaQuery("(min-width: 1536px)");

  const effective: LayoutMode = !saved && preferSidebarWhenNarrow && !wide ? "sidebar" : mode;
  const choose = (m: LayoutMode) => {
    setSaved(true);
    setMode(m);
  };
  return { mode: effective, setMode: choose };
}
