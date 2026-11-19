import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountProvider, useAccount } from "@/lib/account";
import type { Account } from "@/lib/models";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  restoreSession: vi.fn(),
  setAccessToken: vi.fn(),
  clearWorkspace: vi.fn(),
  loadWorkspace: vi.fn(),
  accounts: [] as Account[],
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  isDemo: false,
  api: mocks.api,
  restoreSession: mocks.restoreSession,
  setAccessToken: mocks.setAccessToken,
}));
vi.mock("@/lib/workspace", () => ({
  clearWorkspace: mocks.clearWorkspace,
  loadWorkspace: mocks.loadWorkspace,
  useWorkspace: () => ({ accounts: mocks.accounts }),
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
}));

function Status() {
  const { ready, account } = useAccount();
  return <p>{ready ? account?.email || "Signed out" : "Loading"}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accounts = [];
  localStorage.clear();
  sessionStorage.clear();
  mocks.restoreSession.mockResolvedValue(undefined);
  mocks.loadWorkspace.mockResolvedValue(undefined);
  mocks.api.mockResolvedValue({
    id: "owner",
    personId: "owner",
    email: "owner@ops.test",
    role: "ceo",
    active: true,
    hasPassword: true,
  });
});

it("restores a valid server session after reload under React StrictMode", async () => {
  sessionStorage.setItem("amsol-ops-api-session", "1");
  render(
    <StrictMode>
      <AccountProvider>
        <Status />
      </AccountProvider>
    </StrictMode>,
  );
  expect(await screen.findByText("owner@ops.test")).toBeInTheDocument();
  expect(mocks.restoreSession).toHaveBeenCalledTimes(1);
  expect(mocks.api).toHaveBeenCalledTimes(1);
  expect(mocks.loadWorkspace).toHaveBeenCalledTimes(1);
  expect(mocks.clearWorkspace).toHaveBeenCalledTimes(1);
});

it("renders signed out without contacting the backend when there is no saved session", async () => {
  render(
    <StrictMode>
      <AccountProvider>
        <Status />
      </AccountProvider>
    </StrictMode>,
  );
  expect(screen.getByText("Signed out")).toBeInTheDocument();
  expect(mocks.restoreSession).not.toHaveBeenCalled();
  expect(mocks.api).not.toHaveBeenCalled();
});

function ImpersonationStatus() {
  const { account, ready, startImpersonation, stopImpersonation } = useAccount();
  return (
    <>
      <p>{ready ? (account?.email ?? "Signed out") : "Loading"}</p>
      <p>{account?.impersonation?.email ?? "Original account"}</p>
      <button onClick={() => void startImpersonation?.("ceo")}>Enter</button>
      <button onClick={() => void stopImpersonation?.()}>Return</button>
    </>
  );
}

it("switches into CEO access, retains the original actor with cached accounts, and returns to System Admin", async () => {
  sessionStorage.setItem("amsol-ops-api-session", "1");
  let acting = false;
  const admin = {
    id: "admin",
    personId: "admin",
    email: "admin@ops.test",
    role: "system_admin",
    active: true,
  };
  const ceo = { id: "ceo", personId: "ceo", email: "ceo@ops.test", role: "ceo", active: true };
  mocks.accounts = [ceo as Account];
  mocks.api.mockImplementation(async (path: string) => {
    if (path === "/auth/impersonation") {
      acting = true;
      return { accessToken: "ceo-token" };
    }
    if (path === "/auth/impersonation/stop") {
      acting = false;
      return { accessToken: "admin-token" };
    }
    return acting
      ? {
          ...ceo,
          impersonation: {
            staffId: "admin",
            userId: "admin-user",
            name: "Admin",
            email: admin.email,
          },
        }
      : admin;
  });
  render(
    <AccountProvider>
      <ImpersonationStatus />
    </AccountProvider>,
  );
  expect(await screen.findByText(admin.email)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Enter" }));
  expect(await screen.findByText(ceo.email)).toBeInTheDocument();
  expect(screen.getByText(admin.email)).toBeInTheDocument();
  expect(mocks.setAccessToken).toHaveBeenLastCalledWith("ceo-token");
  expect(mocks.api).toHaveBeenCalledWith("/auth/impersonation", {
    method: "POST",
    body: JSON.stringify({ staffId: "ceo" }),
  });
  fireEvent.click(screen.getByRole("button", { name: "Return" }));
  expect(await screen.findByText(admin.email)).toBeInTheDocument();
  expect(screen.getByText("Original account")).toBeInTheDocument();
  expect(mocks.setAccessToken).toHaveBeenLastCalledWith("admin-token");
  expect(mocks.loadWorkspace).toHaveBeenCalledTimes(3);
});

it("reloads the effective account and workspace when the session is refreshed in another view", async () => {
  sessionStorage.setItem("amsol-ops-api-session", "1");
  render(
    <AccountProvider>
      <Status />
    </AccountProvider>,
  );
  expect(await screen.findByText("owner@ops.test")).toBeInTheDocument();
  mocks.api.mockResolvedValue({
    id: "admin",
    personId: "admin",
    email: "admin@ops.test",
    role: "system_admin",
    active: true,
  });
  window.dispatchEvent(new Event("amsol-ops-session-refreshed"));
  expect(await screen.findByText("admin@ops.test")).toBeInTheDocument();
  await waitFor(() => expect(mocks.loadWorkspace).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("owner@ops.test")).not.toBeInTheDocument();
});

it("preserves the current workspace and open forms during an ordinary token refresh", async () => {
  sessionStorage.setItem("amsol-ops-api-session", "1");
  render(
    <AccountProvider>
      <Status />
    </AccountProvider>,
  );
  expect(await screen.findByText("owner@ops.test")).toBeInTheDocument();
  window.dispatchEvent(new Event("amsol-ops-session-refreshed"));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
  expect(screen.getByText("owner@ops.test")).toBeInTheDocument();
  expect(mocks.clearWorkspace).toHaveBeenCalledTimes(1);
  expect(mocks.loadWorkspace).toHaveBeenCalledTimes(1);
});
