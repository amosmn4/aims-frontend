import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, setAccessToken } from "@/lib/api";

beforeEach(() => setAccessToken("current-token"));
afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe("Ops API transport", () => {
  it("refreshes an expired access token once and retries the request", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "renewed-token" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true })));
    vi.stubGlobal("fetch", request);
    await expect(api("/workspace")).resolves.toEqual({ saved: true });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[2]?.[1].headers.Authorization).toBe("Bearer renewed-token");
    expect(request.mock.calls[1]?.[1].credentials).toBe("include");
  });

  it("reports server validation and network failures without substituting demo data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Choose a project team member." }), {
          status: 400,
        }),
      ),
    );
    await expect(api("/records/tasks/task", { method: "PUT", body: "{}" })).rejects.toThrow(
      "project team member",
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api("/workspace")).rejects.toThrow("Cannot reach");
  });

  it("signals session expiry when refreshing an invalidated session", async () => {
    const expired = vi.fn();
    window.addEventListener("amsol-ops-session-expired", expired);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "Please sign in again." }), { status: 401 }),
        ),
    );
    await expect(api("/workspace")).rejects.toThrow("sign in again");
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener("amsol-ops-session-expired", expired);
  });
});
