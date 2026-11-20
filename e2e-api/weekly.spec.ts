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

test("matches the reporting prototype, recalls and updates a plan, and reports all weekly work", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-20T16:00:00Z"));
  await login(page, "staff@ops-verify.local");
  await expect(page.getByRole("heading", { name: "Good afternoon, Browser" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reporting", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("link", { name: "Weekly Plan", exact: true }).click();
  await page.getByLabel("Plan title", { exact: true }).fill("Payroll and recruitment commitments");
  await page
    .getByLabel("Weekly objective", { exact: true })
    .fill("Complete payroll and recruitment updates.");
  for (const [index, title] of [
    [1, "Prepare payroll summaries"],
    [2, "Update recruitment pipeline"],
  ] as const) {
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await page.getByLabel(`Task ${index}`, { exact: true }).fill(title);
  }
  await page.getByLabel("Priority for task 1").selectOption("High");
  await page.getByLabel("Due day for task 1").selectOption("2026-11-20");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Task 2", { exact: true })).toHaveValue(
    "Update recruitment pipeline",
  );
  await page.getByRole("button", { name: "Submit plan to CEO", exact: true }).click();
  await expect(page.getByRole("button", { name: "Submit plan update", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Recall plan", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Recall submission", exact: true })
    .click();
  await expect(page.getByText("Recalled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task 3", { exact: true }).fill("Urgent follow-up");
  await page.getByLabel("Priority for task 3").selectOption("Urgent");
  await page.getByRole("button", { name: "Submit plan to CEO", exact: true }).click();
  await expect(page.getByRole("button", { name: "Submit plan update", exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/prototype-staff-plan.png", fullPage: true });
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task title", { exact: true }).fill("Standalone weekly work");
  await expect(dialog.getByLabel("Project", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(`/reporting?view=weekly-report&week=${week}`);
  await expect(page.getByLabel("Status: Standalone weekly work", { exact: true })).toBeVisible();
  await page.getByLabel("Report title", { exact: true }).fill("Payroll and recruitment results");
  await page
    .getByLabel("Executive summary", { exact: true })
    .fill("Payroll was completed. Recruitment needs client input.");
  await page
    .getByLabel("Status: Prepare payroll summaries", { exact: true })
    .selectOption("completed");
  await page
    .getByLabel("Outcome: Prepare payroll summaries", { exact: true })
    .fill("Payroll reconciled and sent.");
  await page.getByLabel("Status: Urgent follow-up", { exact: true }).selectOption("blocked");
  await page
    .getByLabel("Challenges and blockers", { exact: true })
    .fill("Client shortlist is pending.");
  await page
    .getByLabel("Next week's priorities", { exact: true })
    .fill("Finish the shortlist with the client.");
  await page
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Payroll was completed. Recruitment updates need client input.");
  await page.screenshot({ path: "test-results/prototype-staff-report.png", fullPage: true });
  await page.getByRole("button", { name: "Submit report to CEO", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Submit report update", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My Submissions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My submissions", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "My active weekly plan", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/prototype-staff-dashboard.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("link", { name: "Monthly Reporting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Monthly Reports", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/prototype-monthly-mobile.png", fullPage: true });
});

test("lets the CEO review prototype submissions, preserves history and notifies staff", async ({
  page,
  request,
  browser,
}) => {
  const id = await staffId(request);
  await login(page);
  await page.goto(`/reporting?view=overview&from=${week}&to=2026-11-22`);
  await expect(
    page.getByRole("heading", { name: "Reporting overview", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/prototype-ceo-overview.png", fullPage: true });
  await page.goto(`/weekly-reports?week=${week}&phase=report&staff=${id}`);
  await expect(
    page.getByText("Payroll reconciled and sent.", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Review decision", { exact: true }).selectOption("return");
  await page
    .getByLabel("CEO feedback", { exact: true })
    .fill("Explain who is following up on the client shortlist.");
  await page.getByRole("button", { name: "Save review and notify staff", exact: true }).click();
  await expect(page.getByText("Review saved and staff notified", { exact: true })).toBeVisible();
  const context = await browser.newContext();
  try {
    const staff = await context.newPage();
    await login(staff, "staff@ops-verify.local");
    await staff.goto(`/reporting?view=weekly-report&week=${week}`);
    await expect(staff.getByText("Correction requested:", { exact: false })).toContainText(
      "Explain who",
    );
    await staff
      .getByLabel("Notes (optional)", { exact: true })
      .fill("Amos is following up with the client on Monday.");
    await staff.getByRole("button", { name: "Submit report to CEO", exact: true }).click();
    await expect(
      staff.getByRole("button", { name: "Submit report update", exact: true }),
    ).toBeVisible();
    await staff.getByRole("button", { name: /Reporting notifications/ }).click();
    await expect(
      staff.getByText("Weekly report needs attention", { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await context.close();
  }
  await page.reload();
  await page.getByLabel("CEO feedback", { exact: true }).fill("Thank you. Follow up on Monday.");
  await page.getByRole("button", { name: "Save review and notify staff", exact: true }).click();
  await expect(page.getByText("Review saved and staff notified", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Thank you. Follow up on Monday.", { exact: true }).first(),
  ).toBeVisible();
  await page.getByText("Submitted snapshot", { exact: true }).first().click();
  await expect(
    page
      .getByText("Payroll was completed. Recruitment updates need client input.", { exact: true })
      .first(),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/prototype-ceo-review.png", fullPage: true });
  await page.getByRole("link", { name: "Staff Performance", exact: true }).click();
  await expect(page.getByLabel("From date", { exact: true })).toBeVisible();
  await page.getByLabel("Search reporting", { exact: true }).fill("Browser Staff");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Browser Staff");
  await expect(page.locator("tbody tr")).toContainText("%");
  await page.screenshot({ path: "test-results/prototype-ceo-performance.png", fullPage: true });
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
  await expect(reportEmail.getByRole("columnheader")).toHaveText(["Task", "Status", "Notes"]);
  await expect(reportEmail).toContainText("Amos is following up with the client on Monday.");
  await expect(reportEmail).toContainText("Client shortlist is pending.");
  await expect(reportEmail).toContainText("Medium");
  await expect(reportEmail).toContainText("Payroll reconciled and sent.");
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
    await expect(recipient).toHaveURL(/reporting.*phase=report/);
    await expect(
      recipient.getByRole("heading", {
        name: "Payroll and recruitment results",
        exact: true,
        level: 1,
      }),
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

test("schedules a prototype plan draft and deletes it with its pending schedule", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-20T16:00:00Z"));
  await login(page, "staff@ops-verify.local");
  await page.goto("/reporting?view=weekly-plan&week=2026-11-23");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task 1", { exact: true }).fill("Next week preparation");
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page.getByLabel("Submission time (EAT)").fill("2026-11-23T10:00");
  await page.getByRole("button", { name: "Save and schedule", exact: true }).click();
  await expect(page.getByText("Submission scheduled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete draft", exact: true })
    .click();
  await expect(page.getByLabel("Task 1", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Task 1", { exact: true })).toHaveCount(0);
});

test("paginates personal reporting and monthly records after applying search and type filters", async ({
  page,
  request,
}) => {
  const response = await request.post(api + "/auth/login", {
    data: { email: "staff@ops-verify.local", password: "OpsBrowser2026!", remember: false },
  });
  const { accessToken, account } = await response.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const profile = account ?? (await (await request.get(api + "/auth/me", { headers })).json());
  const prefix = `Pagination browser ${Date.now()}`;
  for (let index = 0; index < 12; index++) {
    const snapshot = await (await request.get(api + "/workspace", { headers })).json();
    const id = randomUUID();
    const saved = await request.put(`${api}/records/reports/${id}`, {
      headers: { ...headers, "If-Match": String(snapshot.revision) },
      data: {
        id,
        title: `${prefix} ${String(index).padStart(2, "0")}`,
        type: "Monthly",
        dept: "hr",
        author: profile.id,
        date: "2026-11-20",
        month: "2026-11",
        progress: "Draft results",
        reviewed: false,
        status: "draft",
        business: "b0",
        taskIds: [],
        attachments: [],
      },
    });
    expect(saved.status()).toBe(200);
  }
  await login(page, "staff@ops-verify.local");
  await page.goto(
    `/reporting?view=submissions&from=${week}&to=2026-11-22&type=monthly&search=${encodeURIComponent(prefix)}`,
  );
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page).toHaveURL(/page=2/);
  await page.getByLabel("Search reporting", { exact: true }).fill(prefix + " 00");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  await page.goto("/reports");
  await page.getByPlaceholder("Search reports within these filters").fill(prefix);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(10);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(2);
});
