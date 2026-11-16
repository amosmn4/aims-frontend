import { describe, expect, it } from "vitest";
import { opsApiUrl } from "@/lib/api-url";

describe("existing production API address", () => {
  it.each([
    [undefined, "/api/v1/ops"],
    ["", "/api/v1/ops"],
    ["/api/v1", "/api/v1/ops"],
    ["/api/v1/ops/", "/api/v1/ops"],
    ["https://api.example.test/api/v1", "https://api.example.test/api/v1/ops"],
    ["https://api.example.test/api/v1/ops", "https://api.example.test/api/v1/ops"],
    [" https://api.example.test:8443/api/v1/// ", "https://api.example.test:8443/api/v1/ops"],
  ])("uses the configured API host and prefix for %s", (configured, expected) => {
    expect(opsApiUrl(configured)).toBe(expected);
  });
});
