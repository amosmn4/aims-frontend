import { describe, expect, it } from "vitest";
import { plainText, validDate } from "@/lib/text";

describe("Readable fields", () => {
  it("removes existing markup and escaped markup while retaining readable content", () => {
    expect(plainText("<p>Kitengela Water Project</p><p>KeNHA Certificate&nbsp;</p>")).toBe(
      "Kitengela Water Project\nKeNHA Certificate",
    );
    expect(plainText("&lt;p&gt;KeNHA Certificate&lt;/p&gt;&#x20;")).toBe("KeNHA Certificate");
    expect(plainText("Budget < 50k &amp; follow-up")).toBe("Budget < 50k & follow-up");
  });
  it("rejects incomplete years and impossible dates before loading a period", () => {
    expect(validDate("0002-11-20")).toBe(false);
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-11-20")).toBe(true);
  });
});
