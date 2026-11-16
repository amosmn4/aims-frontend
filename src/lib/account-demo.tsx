import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getWorkspace, updateWorkspace, useWorkspace } from "./workspace";
import type { Account } from "./models";

const SESSION_KEY = "amsol-ops-session";
type LocalSession = { accountId: string; expires: number };
type AccountContext = {
  account: Account | null;
  ready: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => void;
  acceptInvitation: (token: string, password: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};
const Context = createContext<AccountContext | null>(null);

export async function passwordHash(password: string, salt: string) {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" },
    material,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readSession(): LocalSession | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    const value: unknown = saved ? JSON.parse(saved) : null;
    if (
      value &&
      typeof value === "object" &&
      "accountId" in value &&
      typeof value.accountId === "string" &&
      "expires" in value &&
      typeof value.expires === "number" &&
      value.expires > Date.now()
    )
      return value as LocalSession;
  } catch {
    return null;
  }
  return null;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { accounts } = useWorkspace();
  const [session, setSession] = useState<LocalSession | null>(readSession);
  const account =
    accounts.find((item) => item.id === session?.accountId && item.active && !!item.passwordHash) ??
    null;
  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === SESSION_KEY) setSession(readSession());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () => setSession(null),
      Math.max(0, session.expires - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session]);
  const signIn = async (email: string, password: string, remember: boolean) => {
    const candidate = getWorkspace().accounts.find(
      (item) =>
        item.email.toLowerCase() === email.trim().toLowerCase() &&
        item.active &&
        !!item.passwordHash,
    );
    if (!candidate || (await passwordHash(password, candidate.salt)) !== candidate.passwordHash)
      throw new Error("The email or password is incorrect.");
    updateWorkspace((previous) => previous);
    const next = {
      accountId: candidate.id,
      expires: Date.now() + (remember ? 7 * 24 : 12) * 60 * 60 * 1000,
    };
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };
  const acceptInvitation = async (token: string, password: string) => {
    if (password.length < 8) throw new Error("Use at least 8 characters.");
    const candidate = getWorkspace().accounts.find(
      (item) =>
        item.active && item.invitation === token && (item.invitationExpires ?? 0) > Date.now(),
    );
    if (!candidate) throw new Error("This local invitation is invalid or has expired.");
    const salt = crypto.randomUUID();
    const hash = await passwordHash(password, salt);
    updateWorkspace((previous) => ({
      ...previous,
      accounts: previous.accounts.map((item) =>
        item.id === candidate.id
          ? {
              ...item,
              salt,
              passwordHash: hash,
              invitation: undefined,
              invitationExpires: undefined,
              active: true,
            }
          : item,
      ),
    }));
    await signIn(candidate.email, password, false);
  };
  const changePassword = async (oldPassword: string, nextPassword: string) => {
    if (!account || (await passwordHash(oldPassword, account.salt)) !== account.passwordHash)
      throw new Error("Your current password is incorrect.");
    if (nextPassword.length < 8) throw new Error("Use at least 8 characters.");
    const salt = crypto.randomUUID();
    const hash = await passwordHash(nextPassword, salt);
    updateWorkspace((previous) => ({
      ...previous,
      accounts: previous.accounts.map((item) =>
        item.id === account.id ? { ...item, salt, passwordHash: hash } : item,
      ),
    }));
  };
  return (
    <Context.Provider
      value={{ account, ready: true, signIn, signOut, acceptInvitation, changePassword }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAccount() {
  const context = useContext(Context);
  if (!context) throw new Error("AccountProvider is required");
  return context;
}
