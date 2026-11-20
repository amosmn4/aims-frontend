import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://127.0.0.1:4001/api/v1/ops";
const mail = "http://127.0.0.1:2527";
const week = "2026-11-16";
test.describe.configure({ mode: "serial" });
async function login(page: Page, email = "ceo@ops-verify.local") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}
async function staffId(request: APIRequestContext) {
  const response = await request.post(api + "/auth/login", {
    maxRetries: 1,
    data: { email: "ceo@ops-verify.local", password: "OpsBrowser2026!", remember: false },
  });
  const { accessToken } = await response.json();
  const snapshot = await request.get(api + "/workspace", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  const { workspace } = await snapshot.json();
  return workspace.accounts.find(
    (account: { email: string }) => account.email === "staff@ops-verify.local",
  ).id as string;
}
test.beforeAll(async ({ request }) => {
  expect((await request.post(mail + "/reset", { data: {} })).ok()).toBeTruthy();
});
test.afterAll(async ({ request }) => {
  await request.post(mail + "/reset", { data: {} });
});

test("lets the CEO set independent submission and email schedules", async ({ page }) => {
  await login(page);
  await page.goto("/weekly-settings");
  await page.getByLabel("First reporting week", { exact: true }).fill(week);
  await page.getByLabel("Plan submission day", { exact: true }).selectOption("1");
  await page.getByLabel("Plan submission time", { exact: true }).fill("16:30");
  await page.getByLabel("Plans email day", { exact: true }).selectOption("2");
  await page.getByLabel("Plans email time", { exact: true }).fill("09:15");
  await page.getByLabel("Report submission day", { exact: true }).selectOption("5");
  await page.getByLabel("Report submission time", { exact: true }).fill("17:30");
  await page.getByLabel("Reports email day", { exact: true }).selectOption("1");
  await page.getByLabel("Reports email time", { exact: true }).fill("08:00");
  await page.getByLabel("Enable the consolidated plans email", { exact: true }).check();
  await page.getByLabel("Enable the consolidated reports email", { exact: true }).check();
  await page.getByRole("button", { name: "Save reporting schedules", exact: true }).click();
  await expect(page.getByText("Weekly reporting schedules saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Plans email day", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Plans email time", { exact: true })).toHaveValue("09:15");
  await expect(page.getByLabel("Reports email day", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("Reports email time", { exact: true })).toHaveValue("08:00");
});

test("keeps weekly forms simple, edits submitted plans and reports all weekly work", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-20T16:00:00Z"));
  await login(page, "staff@ops-verify.local");
  await page.goto(`/weekly-reports?week=${week}`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "New plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Week to prepare")).toBeVisible();
  await expect(dialog.getByText("Plan summary", { exact: true })).toHaveCount(0);
  await expect(dialog.locator('input[type="date"]')).toHaveCount(1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.getByRole("button", { name: "New plan", exact: true }).click();
  for (const [index, title] of [
    [1, "Prepare payroll summaries"],
    [2, "Update recruitment pipeline"],
  ] as const) {
    await dialog.getByRole("button", { name: "Add task", exact: true }).click();
    await dialog.getByLabel(`Task ${index}`, { exact: true }).fill(title);
  }
  await page.screenshot({ path: "test-results/weekly-plan-modal.png", fullPage: true });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await expect(dialog.getByLabel("Task 2", { exact: true })).toHaveValue(
    "Update recruitment pipeline",
  );
  await dialog.getByRole("button", { name: "Submit plan", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Edit / add tasks", exact: true }).click();
  await dialog.getByLabel("Task 1", { exact: true }).fill("Prepare payroll summaries");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await dialog.getByLabel("Task 3", { exact: true }).fill("Urgent follow-up");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: "test-results/weekly-staff-plans.png", fullPage: true });
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await dialog.getByLabel("Task name", { exact: true }).fill("Standalone weekly work");
  await expect(dialog.getByLabel("Due date", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Project", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder("Search tasks").fill("Standalone weekly work");
  await expect(page.getByText("Standalone weekly work", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/weekly-compact-tasks.png", fullPage: true });
  await page.goto(`/weekly-reports?week=${week}&phase=report`);
  await page.getByRole("button", { name: "New report", exact: true }).click();
  await expect(
    dialog.getByRole("checkbox", { name: "Done: Standalone weekly work", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("checkbox", { name: "Done: Prepare payroll summaries", exact: true })
    .check();
  await dialog
    .getByLabel("Blockers (optional)", { exact: true })
    .fill("Client shortlist is pending.");
  await dialog
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Payroll was completed. Recruitment updates need client input.");
  await page.screenshot({ path: "test-results/weekly-simple-report.png", fullPage: true });
  await dialog.getByRole("button", { name: "Submit report", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Edit report", exact: true }).click();
  await expect(
    dialog.getByRole("checkbox", { name: "Done: Prepare payroll summaries", exact: true }),
  ).toBeChecked();
  await dialog.getByRole("checkbox", { name: "Done: Urgent follow-up", exact: true }).check();
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "View report", exact: true }).click();
  await expect(dialog.getByText("Completed", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("Pending", { exact: true }).first()).toBeVisible();
});

test("lets the CEO return a report, preserves its history and reviews the correction", async ({
  page,
  request,
  browser,
}) => {
  const id = await staffId(request);
  await login(page);
  await page.goto(`/weekly-reports?week=${week}&phase=report&staff=${id}`);
  await page
    .getByLabel("CEO feedback", { exact: true })
    .fill("Explain who is following up on the client shortlist.");
  await page.getByRole("button", { name: "Return for correction", exact: true }).click();
  await expect(page.getByText("Returned for correction", { exact: true }).first()).toBeVisible();
  const context = await browser.newContext();
  try {
    const staff = await context.newPage();
    await login(staff, "staff@ops-verify.local");
    await staff.goto(`/weekly-reports?week=${week}&phase=report`);
    await expect(
      staff.getByText("Explain who is following up on the client shortlist.", { exact: false }),
    ).toBeVisible();
    await staff.getByRole("button", { name: "Update and resubmit", exact: true }).click();
    await staff
      .getByLabel("Notes (optional)", { exact: true })
      .fill("Amos is following up with the client on Monday.");
    await staff.getByRole("button", { name: "Submit report", exact: true }).click();
    await staff.getByRole("button", { name: "View report", exact: true }).click();
    await expect(staff.getByRole("heading", { name: "Weekly report", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
  await page.reload();
  await page.getByLabel("CEO feedback", { exact: true }).fill("Thank you. Follow up on Monday.");
  await page.getByRole("button", { name: "Mark reviewed", exact: true }).click();
  await expect(page.getByText("Reviewed", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "View submission history", exact: true }).click();
  await expect(page.getByText("returned |", { exact: false })).toBeVisible();
  await page.getByText("Submitted snapshot", { exact: true }).first().click();
  await expect(
    page
      .getByText("Payroll was completed. Recruitment updates need client input.", { exact: true })
      .first(),
  ).toBeVisible();
});

test("sends two distinct consolidated emails and returns email links through sign-in", async ({
  page,
  request,
  browser,
}) => {
  await login(page);
  await page.goto(`/weekly-brief?week=${week}&phase=plan`);
  await expect(page.getByRole("row").filter({ hasText: "Browser IT" })).toContainText(
    "Not submitted",
  );
  await page.getByRole("button", { name: "Preview email", exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="Weekly email preview"]')
      .getByRole("heading", { name: "Weekly staff plans", exact: true }),
  ).toBeVisible();
  const planEmail = page
    .frameLocator('iframe[title="Weekly email preview"]')
    .locator("section")
    .filter({ hasText: "Browser Staff" });
  await expect(planEmail.getByRole("columnheader")).toHaveText(["Task", "Status"]);
  await expect(planEmail).not.toContainText("No additional notes");
  await page.getByRole("button", { name: "Send brief to me now", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Send brief", exact: true })
    .click();
  await expect(
    page.getByText("One consolidated brief was sent to your email", { exact: true }),
  ).toBeVisible();
  expect((await (await request.get(mail + "/messages")).json()).messages).toHaveLength(1);
  await page.getByRole("button", { name: "Send brief to me now", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Send brief", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  expect((await (await request.get(mail + "/messages")).json()).messages).toHaveLength(1);
  await page.getByLabel("Brief type", { exact: true }).selectOption("report");
  await expect(page.getByRole("row").filter({ hasText: "Browser Staff" })).toContainText(
    "Prepare payroll summaries",
  );
  await page.getByRole("button", { name: "Send brief to me now", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Send brief", exact: true })
    .click();
  await expect
    .poll(async () => (await (await request.get(mail + "/messages")).json()).messages.length)
    .toBe(2);
  await expect(
    page
      .frameLocator('iframe[title="Weekly email preview"]')
      .getByRole("heading", { name: "Weekly staff reports", exact: true }),
  ).toBeVisible();
  const reportEmail = page
    .frameLocator('iframe[title="Weekly email preview"]')
    .locator("section")
    .filter({ hasText: "Browser Staff" });
  await expect(reportEmail.getByRole("columnheader")).toHaveText(["Task", "Status"]);
  await expect(reportEmail).toContainText("Amos is following up with the client on Monday.");
  await expect(reportEmail).toContainText("Client shortlist is pending.");
  await expect(reportEmail).not.toContainText("Medium");
  const href = await page
    .frameLocator('iframe[title="Weekly email preview"]')
    .getByRole("link", { name: "Browser Staff", exact: true })
    .getAttribute("href");
  const context = await browser.newContext();
  try {
    const recipient = await context.newPage();
    await recipient.goto(href!);
    await expect(recipient).toHaveURL(/\/login\?redirect=/);
    await recipient.getByLabel("Email", { exact: true }).fill("ceo@ops-verify.local");
    await recipient.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
    await recipient.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(recipient).toHaveURL(/weekly-reports.*phase=report/);
    await expect(
      recipient.getByRole("heading", { name: "Weekly report", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("shows unconfirmed email delivery and retries only after CEO confirmation", async ({
  page,
  request,
}) => {
  await login(page);
  await request.post(mail + "/fail", { data: { fail: true } });
  await page.goto("/weekly-brief?week=2026-11-23&phase=plan");
  await page.getByRole("button", { name: "Send brief to me now", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Send brief", exact: true })
    .click();
  await expect(page.getByText("uncertain", { exact: true })).toBeVisible();
  await request.post(mail + "/fail", { data: { fail: false } });
  await page.getByRole("button", { name: "Retry delivery", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Retry delivery", exact: true })
    .click();
  await expect(page.getByText("uncertain", { exact: true })).toHaveCount(0);
  await expect
    .poll(async () => (await (await request.get(mail + "/messages")).json()).messages.length)
    .toBe(3);
});

test("schedules a plan draft and deletes it together with its pending schedule", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-20T16:00:00Z"));
  await login(page, "staff@ops-verify.local");
  await page.goto("/weekly-reports?week=2026-11-23&phase=plan");
  await page.getByRole("button", { name: "New plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await dialog.getByLabel("Task 1", { exact: true }).fill("Next week preparation");
  await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
  await dialog.getByLabel("Submission time (EAT)").fill("2026-11-23T10:00");
  await dialog.getByRole("button", { name: "Save and schedule", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete draft", exact: true })
    .click();
  await expect(page.getByText("No weekly plans match this view.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Next week preparation", { exact: true })).toHaveCount(0);
});
