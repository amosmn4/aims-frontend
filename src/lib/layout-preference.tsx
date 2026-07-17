import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type LayoutMode = "top" | "sidebar";

interface LayoutPreferenceValue {
  mode: LayoutMode;
  setMode: (m: LayoutMode) => void;
  toggle: () => void;
}

const LayoutContext = createContext<LayoutPreferenceValue | undefined>(undefined);
const STORAGE_KEY = "aims:layout-mode";

export function LayoutPreferenceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LayoutMode>("top");

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === "top" || v === "sidebar") setModeState(v);
    } catch {
      /* noop */
    }
  }, []);

  const setMode = (m: LayoutMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* noop */
    }
  };

  return (
    <LayoutContext.Provider
      value={{ mode, setMode, toggle: () => setMode(mode === "top" ? "sidebar" : "top") }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayoutPreference() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayoutPreference must be used within LayoutPreferenceProvider");
  return ctx;
}
