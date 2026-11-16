import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "ceo@ops-verify.local") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

async function save(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test("persists client, project, task and CEO review across separate staff browsers", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const suffix = Date.now();
  const client = `Connected Client ${suffix}`;
  const project = `Connected Project ${suffix}`;
  const task = `Connected Task ${suffix}`;
  const report = `Connected Update ${suffix}`;
  await login(page);
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  await page.getByLabel("Client name").fill(client);
  await page.getByLabel("Contact person").fill("Connected Contact");
  await page.getByLabel("Services (comma separated)").fill("Recruitment, Training");
  await save(page);
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill(project);
  await page.getByLabel("Client", { exact: true }).selectOption({ label: client });
  await page.getByLabel("Project lead").selectOption({ label: "Browser Staff" });
  await page
    .getByRole("group", { name: "Departments" })
    .getByRole("checkbox", { name: "HR Services", exact: true })
    .check();
  await page.getByLabel("Summary").fill("A project saved through the real API.");
  await save(page);
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title").fill(task);
  await page.getByLabel("Project", { exact: true }).selectOption({ label: project });
  await page.getByLabel("Assignee", { exact: true }).selectOption({ label: "Browser Staff" });
  await save(page);
  const context = await browser.newContext();
  const staff = await context.newPage();
  staff.on("pageerror", (error) => errors.push(error.message));
  await login(staff, "staff@ops-verify.local");
  await staff.goto("/tasks");
  await staff.getByLabel(`Status for ${task}`).selectOption("Done");
  await expect(staff.getByLabel(`Status for ${task}`)).toHaveValue("Done");
  await staff.goto("/reports");
  await staff.getByRole("button", { name: "Submit report", exact: true }).click();
  await staff.getByLabel("Report title").fill(report);
  await staff.getByLabel("Report type").selectOption("Project update");
  await staff.getByLabel("Project", { exact: true }).selectOption({ label: project });
  await staff.getByLabel(/^Progress( made)?$/).fill("Task completed and ready for review.");
  await save(staff);
  await page.goto("/reports");
  await page.getByPlaceholder("Search reports").fill(report);
  await page.getByLabel(`Review comment for ${report}`).fill("Reviewed through the API");
  await page.getByRole("button", { name: "Mark reviewed", exact: true }).click();
  await expect(page.getByText("Reviewed through the API")).toBeVisible();
  await staff.reload();
  await staff.getByPlaceholder("Search reports").fill(report);
  await expect(staff.getByText("Reviewed through the API")).toBeVisible();
  await expect(staff.getByRole("button", { name: `Edit ${report}`, exact: true })).toHaveCount(0);
  await page.goto("/tasks");
  await expect(page.getByLabel(`Status for ${task}`)).toHaveValue("Done");
  expect(await page.evaluate(() => localStorage.getItem("amsol-ops-workspace-v1"))).toBeNull();
  expect(errors).toEqual([]);
  await context.close();
});

test("uploads original files, changes permissions and creates a usable invitation", async ({
  page,
  browser,
}) => {
  await login(page);
  const filename = `connected-${Date.now()}.txt`;
  await page.goto("/documents");
  await page.getByRole("button", { name: "Upload document", exact: true }).click();
  await page.getByLabel("File *", { exact: true }).setInputFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from("Connected document content"),
  });
  await page.getByLabel("Access", { exact: true }).selectOption("restricted");
  await page
    .getByRole("group", { name: "Allowed staff" })
    .getByRole("checkbox", { name: "Browser Staff", exact: true })
    .check();
  await save(page);
  await page.getByPlaceholder("Search documents").fill(filename);
  const row = page.getByRole("row").filter({ hasText: filename });
  const download = page.waitForEvent("download");
  await row.getByRole("button", { name: `Download ${filename}`, exact: true }).click();
  expect((await download).suggestedFilename()).toBe(filename);
  const context = await browser.newContext();
  const staff = await context.newPage();
  await login(staff, "staff@ops-verify.local");
  await staff.goto("/documents");
  await staff.getByPlaceholder("Search documents").fill(filename);
  await expect(staff.getByRole("row").filter({ hasText: filename })).toBeVisible();
  await row.getByRole("button", { name: `Edit ${filename}`, exact: true }).click();
  await page
    .getByRole("group", { name: "Allowed staff" })
    .getByRole("checkbox", { name: "Browser Staff", exact: true })
    .uncheck();
  await save(page);
  await staff.reload();
  await staff.getByPlaceholder("Search documents").fill(filename);
  await expect(staff.getByRole("row").filter({ hasText: filename })).toHaveCount(0);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Invite staff", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Connected Invitee");
  await page.getByLabel("Job title", { exact: true }).fill("Consultant");
  const invitedEmail = `connected-${Date.now()}@ops-verify.local`;
  await page.getByLabel("Email", { exact: true }).fill(invitedEmail);
  await save(page);
  const link = await page.getByLabel("Invitation link", { exact: true }).inputValue();
  const invitedContext = await browser.newContext();
  const invited = await invitedContext.newPage();
  await invited.goto(link);
  await expect(invited.getByLabel("Email", { exact: true })).toHaveValue(invitedEmail);
  await invited.getByLabel("Password", { exact: true }).fill("InvitedBrowser2026!");
  await invited.getByLabel("Confirm password", { exact: true }).fill("InvitedBrowser2026!");
  await invited.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(invited.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await context.close();
  await invitedContext.close();
});

test("keeps failed saves open and does not fall back to browser data", async ({ page }) => {
  await login(page);
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  await page.getByLabel("Client name").fill("Unsaved connected client");
  await page.getByLabel("Contact person").fill("Contact");
  await page.getByLabel("Services (comma separated)").fill("Training");
  await page.route("**/api/v1/ops/records/clients/*", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        message: "The workspace changed. Reload it and review your changes before saving again.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("workspace changed");
  await expect(page.getByLabel("Client name")).toHaveValue("Unsaved connected client");
  expect(await page.evaluate(() => localStorage.getItem("amsol-ops-workspace-v1"))).toBeNull();
});
