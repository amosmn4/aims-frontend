import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountProvider, useAccount } from "@/lib/account";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  restoreSession: vi.fn(),
  setAccessToken: vi.fn(),
  clearWorkspace: vi.fn(),
  loadWorkspace: vi.fn(),
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
  useWorkspace: () => ({ accounts: [] }),
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
}));

function Status() {
  const { ready, account } = useAccount();
  return <p>{ready ? account?.email || "Signed out" : "Loading"}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
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
