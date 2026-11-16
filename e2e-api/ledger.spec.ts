import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

const api = "http://127.0.0.1:4001/api/v1/ops";
const owner = "ceo@ops-verify.local";
const viewer = "staff@ops-verify.local";
const allocation = "11111111-1111-4111-8111-111111111111";
const retry = "22222222-2222-4222-8222-222222222222";

async function login(page: Page, email = owner) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}
async function admin(request: APIRequestContext) {
  const response = await request.post(api + "/auth/login", {
    maxRetries: 1,
    data: { email: owner, password: "OpsBrowser2026!", remember: false },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).accessToken as string;
}
async function grant(request: APIRequestContext, token: string, email: string, access: string) {
  const headers = { Authorization: "Bearer " + token };
  const response = await request.get(api + "/workspace", { headers });
  const { workspace, revision } = await response.json();
  const account = workspace.accounts.find((row: { email: string }) => row.email === email);
  const updated = await request.put(api + "/accounts/" + account.id + "/modules", {
    headers: { ...headers, "If-Match": String(revision) },
    data: { module: "ledger", access },
  });
  expect(updated.ok()).toBeTruthy();
}

test.afterEach(async ({ request }) => {
  const token = await admin(request);
  await grant(request, token, owner, "none");
  await grant(request, token, viewer, "none");
  await request.post("http://127.0.0.1:4003/__verify/fail", { data: { fail: false } });
});

test("assigns Ledger in Admin and supports viewer filtering, details, exports and revocation", async ({
  page,
  request,
}) => {
  const token = await admin(request);
  await grant(request, token, owner, "none");
  await login(page);
  await expect(page.getByRole("link", { name: "Payment Ledger", exact: true })).toHaveCount(0);
  await page.goto("/payment-ledger");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  await page.goto("/admin?tab=Module%20access");
  await page.getByLabel("ledger access for ceo@ops-verify.local").selectOption("view");
  await page.getByRole("link", { name: "Payment Ledger", exact: true }).click();
  await expect(page.getByRole("link", { name: "Payment systems", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sync now", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "VERIFY-ALLOC", exact: true })).toBeVisible();
  await expect(page.getByText("Received: KES 125.50", { exact: true })).toBeVisible();
  await expect(page.getByText("Paid out: USD 15.00", { exact: true })).toBeVisible();
  await page.getByLabel("Direction", { exact: true }).selectOption("out");
  await expect(page.getByRole("link", { name: "VERIFY-ALLOC", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "VERIFY-RETRY", exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("aims-payment-ledger.csv");
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain("VERIFY-RETRY");
  expect(csv).not.toContain("VERIFY-ALLOC");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.getByRole("link", { name: "VERIFY-ALLOC", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Transaction details", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Allocate payment", exact: true })).toHaveCount(0);
  await page.getByText("Original provider payload", { exact: true }).click();
  await expect(page.getByText('"fixture": true', { exact: false }).first()).toBeVisible();
  await page.goto("/payment-ledger/systems");
  await expect(page.getByRole("alert")).toContainText("requires Manage access");
  await grant(request, token, owner, "none");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Payment Ledger", exact: true })).toHaveCount(0);
});

test("allocates payments and retries delivery with reasons through the mock gateway", async ({
  page,
  request,
}) => {
  const token = await admin(request);
  await grant(request, token, viewer, "manage");
  await login(page, viewer);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/payment-ledger/entries/" + allocation);
  await page.getByLabel("Destination", { exact: true }).selectOption("external");
  await page
    .getByLabel("Payment system", { exact: true })
    .selectOption({ label: "Fixture service" });
  await page.getByLabel("Destination", { exact: true }).selectOption("water");
  await page.getByLabel("Search meter", { exact: true }).fill("VERIFY");
  await page.getByLabel("Meter", { exact: true }).selectOption({ label: "VERIFY-METER" });
  await page.getByRole("button", { name: "Allocate payment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Allocate payment", exact: true })).toBeVisible();
  await page.getByLabel("Reason", { exact: true }).fill("Browser allocation verification");
  await page.getByRole("button", { name: "Allocate payment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Allocate payment", exact: true })).toHaveCount(0);
  await expect(page.getByText("VERIFY-METER", { exact: true })).toBeVisible();
  await page.goto("/payment-ledger/entries/" + retry);
  await page.getByLabel("Reason", { exact: true }).fill("Browser retry verification");
  await page.getByRole("button", { name: "Queue another delivery cycle", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Retry exhausted delivery", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("0 attempts. Delivery: pending.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Back to ledger", exact: true }).click();
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByText("Ledger synchronization completed", { exact: true })).toBeVisible();
  await page.goto("/payment-ledger/access");
  await expect(page.getByRole("alert")).toContainText("CEO");
  expect(errors).toEqual([]);
});

test("registers, edits and rotates payment system credentials and keeps records available offline", async ({
  page,
  request,
}) => {
  const token = await admin(request);
  await grant(request, token, owner, "manage");
  await login(page);
  await page.goto("/payment-ledger/systems");
  const name = "Browser system " + Date.now();
  for (const [label, value] of [
    ["System name", name],
    ["System code", "browser"],
    ["Paybill", "600001"],
    ["Account prefix", "brw"],
    ["HTTPS callback URL", "https://fixture.invalid/browser"],
  ])
    await page.getByLabel(label!, { exact: true }).fill(value!);
  await expect(page.getByLabel("Account prefix", { exact: true })).toHaveValue("BRW");
  await page.getByRole("button", { name: "Register system", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Save these credentials now", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("API key", { exact: true })).toHaveValue(/^fixture-api-key-/);
  await page.getByRole("button", { name: "Dismiss credentials", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("System code", { exact: true })).toBeDisabled();
  await page.getByLabel("System name", { exact: true }).fill(name + " updated");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(row).toContainText(name + " updated");
  await row.getByRole("button", { name: "Rotate keys", exact: true }).click();
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm rotation", exact: true })).toHaveCount(0);
  await row.getByRole("button", { name: "Rotate keys", exact: true }).click();
  await row.getByRole("button", { name: "Confirm rotation", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Save these credentials now", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Payment systems", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Save these credentials now", exact: true }),
  ).toHaveCount(0);
  await request.post("http://127.0.0.1:4003/__verify/fail", { data: { fail: true } });
  await page.goto("/payment-ledger");
  await expect(page.getByRole("link", { name: "VERIFY-ALLOC", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Module access", exact: true }).click();
  await page.getByRole("link", { name: "Manage module access", exact: true }).click();
  await expect(page.getByLabel("ledger access for ceo@ops-verify.local")).toBeVisible();
});
