import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

async function login(page: Page, email = "ceo@ops-verify.local") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

async function admin(request: APIRequestContext) {
  const response = await request.post("http://127.0.0.1:4001/api/v1/ops/auth/login", {
    data: { email: "ceo@ops-verify.local", password: "OpsBrowser2026!", remember: false },
  });
  return (await response.json()).accessToken as string;
}
async function grant(
  request: APIRequestContext,
  token: string,
  email: string,
  module: string,
  access: string,
) {
  const headers = { Authorization: "Bearer " + token };
  const response = await request.get("http://127.0.0.1:4001/api/v1/ops/workspace", { headers });
  const { workspace, revision } = await response.json();
  const account = workspace.accounts.find((row: { email: string }) => row.email === email);
  const updated = await request.put(
    "http://127.0.0.1:4001/api/v1/ops/accounts/" + account.id + "/modules",
    { headers: { ...headers, "If-Match": String(revision) }, data: { module, access } },
  );
  expect(updated.ok()).toBeTruthy();
}

test("assigns modules individually in Admin and blocks direct routes after revocation", async ({
  page,
  request,
}) => {
  const token = await admin(request);
  await grant(request, token, "ceo@ops-verify.local", "water", "none");
  await grant(request, token, "ceo@ops-verify.local", "blog", "none");
  await login(page);
  await expect(page.getByRole("link", { name: "Water Project", exact: true })).toHaveCount(0);
  await page.goto("/water");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Module access", exact: true }).click();
  await page.getByLabel("water access for ceo@ops-verify.local").selectOption("manage");
  await expect(page.getByRole("link", { name: "Water Project", exact: true })).toBeVisible();
  await page.getByLabel("blog access for ceo@ops-verify.local").selectOption("manage");
  await expect(page.getByRole("link", { name: "Blog", exact: true })).toBeVisible();
  await grant(request, token, "staff@ops-verify.local", "water", "view");
  await grant(request, token, "staff@ops-verify.local", "blog", "none");
});

test("opens every Water screen and downloads PDF and Word reports", async ({ page, request }) => {
  const token = await admin(request);
  await grant(request, token, "ceo@ops-verify.local", "water", "manage");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  for (const path of [
    "/water",
    "/water/zones",
    "/water/meters",
    "/water/customers",
    "/water/balances",
    "/water/readings",
    "/water/upload",
    "/water/expenses",
    "/water/reports",
    "/water/ai",
  ]) {
    await page.goto(path);
    await expect(page.locator(".production-module").first()).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("This page could not load", { exact: true })).toHaveCount(0);
  }
  await page.goto("/water/reports");
  await expect(page.getByText("Month summary -", { exact: false })).toBeVisible();
  for (const [label, extension] of [
    ["PDF (.pdf)", ".pdf"],
    ["Word (.docx)", ".docx"],
  ]) {
    await page.getByRole("button", { name: "Download report", exact: true }).click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    expect((await downloaded).suggestedFilename()).toContain(extension);
  }
  expect(errors).toEqual([]);
});

test("preserves the Blog editor, preview, publishing and unsaved-change dialog", async ({
  page,
  request,
}) => {
  const token = await admin(request);
  await grant(request, token, "ceo@ops-verify.local", "blog", "manage");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.goto("/marketing/blog");
  await page.getByRole("button", { name: "New post", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Enter a title", { exact: false })).toBeVisible();
  const title = "Module browser verification " + Date.now();
  await page.getByLabel("Title", { exact: false }).fill(title);
  await page.getByLabel("Excerpt", { exact: false }).fill("A production-compatible Blog workflow.");
  await page
    .locator('[contenteditable="true"]')
    .fill("The original rich text editor is available inside Amsol Ops.");
  await page.getByLabel("Author name", { exact: false }).fill("Verification Author");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/marketing\/blog\/[^/]+$/);
  await expect(page.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();
  const editorUrl = page.url();
  const postId = editorUrl.split("/").pop()!;
  try {
    await page.getByRole("button", { name: "Publish post", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Publish post", exact: true })
      .click();
    await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Preview post", exact: true }).click();
    await expect(page.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();
    await page.goto(editorUrl);
    await page.getByLabel("Title", { exact: false }).fill(title + " changed");
    await page.getByRole("link", { name: "Blog", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Stay on this page", exact: true }).click();
    await expect(page).toHaveURL(editorUrl);
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page.getByRole("button", { name: "Unpublish post", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Unpublish post", exact: true })
      .click();
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
  } finally {
    await request.delete("http://127.0.0.1:4001/api/v1/ops/blog/posts/" + postId, {
      headers: { Authorization: "Bearer " + token },
    });
  }
  expect(errors).toEqual([]);
});

test("gives viewers read access and clears module visibility after revocation", async ({
  page,
  request,
}) => {
  const token = await admin(request);
  await grant(request, token, "staff@ops-verify.local", "water", "view");
  await grant(request, token, "staff@ops-verify.local", "blog", "view");
  await login(page, "staff@ops-verify.local");
  await page.goto("/water/zones");
  await expect(page.getByRole("button", { name: "Add zone", exact: true })).toHaveCount(0);
  await page.goto("/marketing/blog");
  await expect(page.getByRole("button", { name: "New post", exact: true })).toHaveCount(0);
  await grant(request, token, "staff@ops-verify.local", "blog", "none");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("link", { name: "Blog", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  await grant(request, token, "staff@ops-verify.local", "water", "none");
});
