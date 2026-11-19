import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccountProvider as DemoProvider, useAccount as useDemoAccount } from "./account-demo";
import { api, ApiError, isDemo, restoreSession, setAccessToken } from "./api";
import { clearWorkspace, loadWorkspace, useWorkspace } from "./workspace";
import { accountSchema, type Account } from "./models";

export { passwordHash } from "./account-demo";
const SESSION_HINT = "amsol-ops-api-session";

function hasSessionHint() {
  return localStorage.getItem(SESSION_HINT) === "1" || sessionStorage.getItem(SESSION_HINT) === "1";
}

function rememberApiSession(remember: boolean) {
  localStorage.removeItem(SESSION_HINT);
  sessionStorage.removeItem(SESSION_HINT);
  (remember ? localStorage : sessionStorage).setItem(SESSION_HINT, "1");
}

function clearApiSessionHint() {
  localStorage.removeItem(SESSION_HINT);
  sessionStorage.removeItem(SESSION_HINT);
}

type AccountContext = {
  account: Account | null;
  ready: boolean;
  error?: string;
  retry?: () => void;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => void;
  acceptInvitation: (token: string, password: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  startImpersonation?: (staffId: string, onSwitched?: () => Promise<void>) => Promise<void>;
  stopImpersonation?: (onSwitched?: () => Promise<void>) => Promise<void>;
};
const Context = createContext<AccountContext | null>(null);

function DemoBridge({ children }: { children: ReactNode }) {
  const account = useDemoAccount();
  return <Context.Provider value={account}>{children}</Context.Provider>;
}

function ApiProvider({ children }: { children: ReactNode }) {
  const { accounts } = useWorkspace();
  const [identity, setIdentity] = useState<Account | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState("");
  const refreshFlight = useRef<Promise<void> | null>(null);
  const authGeneration = useRef(0);
  const account = useMemo(
    () =>
      identity
        ? {
            ...(accounts.find((item) => item.id === identity.id) ?? identity),
            impersonation: identity.impersonation,
          }
        : null,
    [accounts, identity],
  );
  const completeSignIn = useCallback(
    async (generation = authGeneration.current, suppliedProfile?: Account) => {
      const profile = suppliedProfile ?? accountSchema.parse(await api("/auth/me"));
      if (generation !== authGeneration.current) return;
      clearWorkspace();
      await loadWorkspace();
      if (generation !== authGeneration.current) return;
      setIdentity(profile);
      setError("");
    },
    [],
  );
  const restore = useCallback(async () => {
    const generation = authGeneration.current;
    setReady(false);
    setError("");
    try {
      refreshFlight.current ??= restoreSession().then(() => completeSignIn(generation));
      await refreshFlight.current;
    } catch (error) {
      refreshFlight.current = null;
      if (generation !== authGeneration.current) return;
      if (error instanceof ApiError && error.status === 401) clearApiSessionHint();
      if (!(error instanceof ApiError && error.status === 401))
        setError(error instanceof Error ? error.message : "The workspace could not load.");
      setIdentity(null);
      clearWorkspace();
    } finally {
      if (generation === authGeneration.current) setReady(true);
    }
  }, [completeSignIn]);
  useEffect(() => {
    if (hasSessionHint()) void restore();
    const expired = () => {
      authGeneration.current++;
      refreshFlight.current = null;
      clearApiSessionHint();
      setIdentity(null);
      setAccessToken(null);
      clearWorkspace();
      setReady(true);
    };
    window.addEventListener("amsol-ops-session-expired", expired);
    return () => {
      window.removeEventListener("amsol-ops-session-expired", expired);
    };
  }, [restore]);
  useEffect(() => {
    if (!identity) return;
    const refreshed = () => {
      let generation = authGeneration.current;
      let switched = false;
      void api("/auth/me")
        .then(async (raw) => {
          if (generation !== authGeneration.current) return;
          const profile = accountSchema.parse(raw);
          if (
            profile.id === identity.id &&
            profile.role === identity.role &&
            profile.impersonation?.staffId === identity.impersonation?.staffId
          ) {
            setIdentity(profile);
            return;
          }
          generation = ++authGeneration.current;
          switched = true;
          refreshFlight.current = null;
          setReady(false);
          setIdentity(null);
          clearWorkspace();
          await completeSignIn(generation, profile);
        })
        .catch((error: unknown) => {
          if (generation === authGeneration.current)
            setError(error instanceof Error ? error.message : "The account could not refresh.");
        })
        .finally(() => {
          if (switched && generation === authGeneration.current) setReady(true);
        });
    };
    window.addEventListener("amsol-ops-session-refreshed", refreshed);
    return () => window.removeEventListener("amsol-ops-session-refreshed", refreshed);
  }, [identity, completeSignIn]);
  useEffect(() => {
    if (!identity) return;
    const refresh = () => {
      void loadWorkspace()
        .then(() => setError(""))
        .catch((error: unknown) =>
          setError(error instanceof Error ? error.message : "The workspace could not refresh."),
        );
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [identity]);
  const signIn = async (email: string, password: string, remember: boolean) => {
    const generation = ++authGeneration.current;
    refreshFlight.current = null;
    try {
      const result = await api<{ accessToken: string }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password, remember }) },
        false,
      );
      setAccessToken(result.accessToken);
      rememberApiSession(remember);
      await completeSignIn(generation);
    } finally {
      if (generation === authGeneration.current) setReady(true);
    }
  };
  const signOut = () => {
    const generation = ++authGeneration.current;
    refreshFlight.current = null;
    void api("/auth/logout", { method: "POST" })
      .then(() => {
        if (generation !== authGeneration.current) return;
        clearApiSessionHint();
        setIdentity(null);
        setAccessToken(null);
        clearWorkspace();
        setReady(true);
      })
      .catch((error: unknown) =>
        setError(error instanceof Error ? error.message : "Sign out failed. Try again."),
      );
  };
  const acceptInvitation = async (token: string, password: string) => {
    const generation = ++authGeneration.current;
    refreshFlight.current = null;
    try {
      const result = await api<{ accessToken: string }>(
        "/auth/accept-invitation",
        { method: "POST", body: JSON.stringify({ token, password }) },
        false,
      );
      setAccessToken(result.accessToken);
      rememberApiSession(false);
      await completeSignIn(generation);
    } finally {
      if (generation === authGeneration.current) setReady(true);
    }
  };
  const changePassword = async (currentPassword: string, newPassword: string) => {
    await api("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  };
  const switchIdentity = async (
    path: string,
    body?: { staffId: string },
    onSwitched?: () => Promise<void>,
  ) => {
    const result = await api<{ accessToken: string }>(path, {
      method: "POST",
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const generation = ++authGeneration.current;
    refreshFlight.current = null;
    setAccessToken(result.accessToken);
    setIdentity(null);
    setReady(false);
    clearWorkspace();
    try {
      await completeSignIn(generation);
      if (generation === authGeneration.current) await onSwitched?.();
    } catch (error) {
      if (generation === authGeneration.current)
        setError(error instanceof Error ? error.message : "The workspace could not load.");
      throw error;
    } finally {
      if (generation === authGeneration.current) setReady(true);
    }
  };
  return (
    <Context.Provider
      value={{
        account,
        ready,
        error,
        retry: () => void restore(),
        signIn,
        signOut,
        acceptInvitation,
        changePassword,
        startImpersonation: (staffId, onSwitched) =>
          switchIdentity("/auth/impersonation", { staffId }, onSwitched),
        stopImpersonation: (onSwitched) =>
          switchIdentity("/auth/impersonation/stop", undefined, onSwitched),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function AccountProvider({ children }: { children: ReactNode }) {
  return isDemo ? (
    <DemoProvider>
      <DemoBridge>{children}</DemoBridge>
    </DemoProvider>
  ) : (
    <ApiProvider>{children}</ApiProvider>
  );
}

export function useAccount() {
  const context = useContext(Context);
  if (!context) throw new Error("AccountProvider is required");
  return context;
}
