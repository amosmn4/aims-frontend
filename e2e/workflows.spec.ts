import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const errors = new WeakMap<Page, string[]>();
const external = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, context }) => {
  errors.set(page, []);
  external.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.continue();
    external.get(page)!.push(url.origin);
    return route.abort();
  });
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(external.get(page)).toEqual([]);
});

async function login(page: Page, email = "ceo@amsol.local", password = "AmsolDemo2026!") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

async function save(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test("delete confirmations preserve records on cancel and inactive invitations cannot activate", async ({
  page,
}) => {
  await login(page);
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  await page.getByLabel("Client name").fill("Disposable Client");
  await page.getByLabel("Contact person").fill("Contact");
  await page.getByLabel("Services (comma separated)").fill("Training");
  await save(page);
  await page.getByRole("button", { name: "Delete Disposable Client", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Disposable Client", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Disposable Client", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Disposable Client", exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Disposable Client", exact: true })).toHaveCount(
    0,
  );
  await page.goto("/admin");
  await page.getByRole("button", { name: "Invite staff", exact: true }).click();
  await page.getByLabel("Full name").fill("Disabled Invite");
  await page.getByLabel("Job title").fill("Test Officer");
  await page.getByRole("dialog").getByLabel("Email", { exact: true }).fill("disabled@amsol.local");
  await save(page);
  const invitation = await page.getByLabel("Invitation link").inputValue();
  await page
    .getByRole("row")
    .filter({ hasText: "disabled@amsol.local" })
    .getByRole("button", { name: "Deactivate", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto(invitation);
  await expect(page.getByRole("alert")).toContainText("invalid or expired");
});

test("login validates credentials, restores deep links, and logs out", async ({ page }) => {
  await page.goto("/projects/pr2");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill("ceo@amsol.local");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await page.getByLabel("Password", { exact: true }).fill("AmsolDemo2026!");
  await page.getByLabel("Remember me for 7 days").check();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/pr2$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Savanna Foods payroll migration", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("client, project and task forms persist and project PDFs use current data", async ({
  page,
}) => {
  await login(page);
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  await page.getByLabel("Client name").fill("Local Test Client");
  await page.getByLabel("Contact person").fill("Local Contact");
  await page.getByLabel("Services (comma separated)").fill("Payroll, Training");
  await save(page);
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Local Test Project");
  await page.getByLabel("Client", { exact: true }).selectOption({ label: "Local Test Client" });
  await page.getByLabel("Project lead").selectOption("p4");
  await page
    .getByRole("group", { name: "Departments" })
    .getByLabel("Finance", { exact: true })
    .check();
  await page.getByLabel("Progress (%)").fill("35");
  await page.getByLabel("Summary").fill("Locally saved project summary");
  await save(page);
  await page.getByRole("link").filter({ hasText: "Local Test Project" }).click();
  await expect(
    page.getByRole("heading", { name: "Local Test Project", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title").fill("Local Test Task");
  await page.getByLabel("Assignee").selectOption("p4");
  await save(page);
  await page.goto("/tasks");
  await page.getByLabel("Status for Local Test Task").selectOption("Done");
  await page.reload();
  await expect(page.getByLabel("Status for Local Test Task")).toHaveValue("Done");
  await page.getByRole("link", { name: "Local Test Project", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download progress PDF" }).click();
  const file = await downloaded;
  const content = await readFile((await file.path())!);
  expect(content.toString()).toContain("Local Test Client");
  expect(content.toString()).toContain("Kevin Mutua");
  expect(content.toString().startsWith("%PDF")).toBe(true);
});

test("tenders, requests and reports support creation, review and refresh", async ({ page }) => {
  await login(page);
  await page.goto("/tenders");
  await page.getByRole("button", { name: "Log tender", exact: true }).click();
  await page.getByLabel("Tender title").fill("Local Tender");
  await page.getByLabel("Issuer").fill("Test Issuer");
  await page.getByLabel("Stage", { exact: true }).selectOption("Submitted");
  await save(page);
  await expect(page.getByRole("heading", { name: "Local Tender", exact: true })).toBeVisible();
  await page.goto("/client-requests");
  await page.getByRole("button", { name: "Log request", exact: true }).click();
  await page.getByLabel("Request title").fill("Local Request");
  await save(page);
  await page.getByRole("button", { name: "Edit Local Request", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("Closed");
  await save(page);
  await page.goto("/reports");
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  await page.getByLabel("Report title").fill("Local Report");
  await page.getByLabel("Progress made").fill("Saved local progress");
  await save(page);
  await page.getByLabel("Review comment for Local Report").fill("Reviewed locally");
  const report = page.locator("div[id^='report-']").filter({ hasText: "Local Report" });
  await report.getByRole("button", { name: "Mark reviewed", exact: true }).click();
  await page.reload();
  await expect(report).toContainText("Reviewed locally");
  await page.goto("/assistant");
  await page.getByLabel("Search project updates").fill("Local Report");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("link", { name: "Local Report", exact: true }).click();
  await expect(page).toHaveURL(/reports#report-/);
  await expect(report).toBeVisible();
});

test("finance permits zero entries and keeps staff charts scoped", async ({ page }) => {
  await login(page);
  await page.goto("/businesses");
  await page.getByRole("button", { name: "Add business", exact: true }).click();
  await page.getByLabel("Business name").fill("Local Zero Business");
  await page.getByLabel("Sector", { exact: true }).fill("Testing");
  await save(page);
  await page.getByRole("button", { name: "Log finances", exact: true }).click();
  await page.getByLabel("Business", { exact: true }).selectOption({ label: "Local Zero Business" });
  await page.getByLabel("Month", { exact: true }).fill("2027-01");
  await page.getByLabel("Revenue (KES)").fill("0");
  await page.getByLabel("Expenses (KES)").fill("0");
  await save(page);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "Local Zero Business" })).toContainText(
    "Jan 2027",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "it@amsol.local");
  await page.goto("/businesses");
  await expect(page.getByRole("heading", { name: "Water project", exact: true })).toBeVisible();
  await expect(page.getByText("Amsol (core)", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Local Zero Business", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Monthly revenue for Water project", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  await page.goto("/departments/it");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
});

test("uploaded files preserve their content and document access survives refresh", async ({
  page,
}) => {
  await login(page);
  await page.goto("/documents");
  await page.getByRole("button", { name: "Upload document", exact: true }).click();
  await page.getByLabel("File *", { exact: true }).setInputFiles({
    name: "local-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Original local upload content"),
  });
  await save(page);
  await page.reload();
  await page.getByRole("button", { name: "local-notes.txt", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Original local upload content");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download local-notes.txt", exact: true }).click();
  expect((await readFile((await (await downloaded).path())!)).toString()).toBe(
    "Original local upload content",
  );
  await page.getByRole("button", { name: "Edit local-notes.txt", exact: true }).click();
  await page.getByLabel("Access", { exact: true }).selectOption("restricted");
  await save(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "brian@amsol.local");
  await page.goto("/documents");
  await expect(page.getByRole("button", { name: "local-notes.txt", exact: true })).toHaveCount(0);
  await expect(page.getByText("Restricted document", { exact: true }).first()).toBeVisible();
});

test("department modules and admin settings save real records", async ({ page }) => {
  await login(page);
  await page.goto("/departments/it");
  await page.getByRole("button", { name: /Systems register/ }).click();
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await page.getByLabel("Title / reference").fill("Local System Record");
  await page.getByLabel("Details / notes").fill("Local system tracking details");
  await save(page);
  await page.reload();
  await page.getByRole("button", { name: /Systems register/ }).click();
  await expect(
    page.getByRole("heading", { name: "Local System Record", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Report templates", exact: true }).click();
  await page.getByRole("button", { name: "Add template", exact: true }).click();
  await page.getByLabel("Template name").fill("Local Template");
  await page.getByLabel("Progress field label").fill("Local progress label");
  await save(page);
  await page.goto("/reports");
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  await page.getByLabel("Template", { exact: true }).selectOption({ label: "Local Template" });
  await expect(page.getByLabel("Local progress label")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/admin");
  await page
    .getByRole("row")
    .filter({ hasText: "ceo@amsol.local" })
    .getByRole("button", { name: "Deactivate", exact: true })
    .click();
  await expect(
    page.getByText("Keep at least one active CEO account.", { exact: true }),
  ).toBeVisible();
});

test("local invitations activate accounts and passwords can be changed", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Invite staff", exact: true }).click();
  await page.getByLabel("Full name").fill("Local Invited Staff");
  await page.getByLabel("Job title").fill("Test Officer");
  await page.getByRole("dialog").getByLabel("Email", { exact: true }).fill("invited@amsol.local");
  await save(page);
  const invitation = await page.getByLabel("Invitation link").inputValue();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto(invitation);
  await page.getByLabel("Password", { exact: true }).fill("NewPassword2026!");
  await page.getByLabel("Confirm password", { exact: true }).fill("NewPassword2026!");
  await page.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Local", exact: true })).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("Current password").fill("NewPassword2026!");
  await page.getByLabel("New password", { exact: true }).fill("ChangedPassword2026!");
  await page.getByLabel("Confirm new password").fill("ChangedPassword2026!");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.getByText("Password changed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "invited@amsol.local", "ChangedPassword2026!");
  await expect(page.getByRole("heading", { name: "Welcome, Local", exact: true })).toBeVisible();
});

test("all primary links load locally and mobile navigation works", async ({ page }) => {
  await login(page);
  for (const path of [
    "/tasks",
    "/projects",
    "/reports",
    "/tenders",
    "/client-requests",
    "/departments",
    "/clients",
    "/businesses",
    "/documents",
    "/people",
    "/assistant",
    "/admin",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("This page could not load", { exact: true })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-projects.png", fullPage: true });
});
