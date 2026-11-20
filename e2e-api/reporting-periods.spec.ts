import { expect, test, type Page } from "@playwright/test";

const api = "http://127.0.0.1:4001/api/v1/ops";
const mail = "http://127.0.0.1:2527";
async function login(page: Page, email = "staff@ops-verify.local") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}
test.beforeAll(async ({ request }) => {
  await request.post(mail + "/reset", { data: {} });
  const session = await (
    await request.post(api + "/auth/login", {
      data: { email: "ceo@ops-verify.local", password: "OpsBrowser2026!", remember: false },
    })
  ).json();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const current = await (await request.get(api + "/weekly/settings", { headers })).json();
  expect(
    (
      await request.put(api + "/weekly/settings", {
        headers,
        data: {
          version: current.version,
          settings: { ...current.settings, startWeek: "2026-11-16" },
        },
      })
    ).ok(),
  ).toBeTruthy();
});
test.afterAll(async ({ request }) => {
  await request.post(mail + "/reset", { data: {} });
});

test("restores readable full-width reporting, prototype hints and optional task-to-plan periods", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-20T16:00:00Z"));
  await login(page);
  await expect(page.getByRole("img", { name: "Amsol", exact: true })).toHaveAttribute(
    "src",
    "/favicon.png",
  );
  await expect(page.getByRole("main").first()).toHaveClass(/reporting-active/);
  await expect(page.locator("header").getByText("Staff workspace", { exact: true })).toHaveCount(0);
  for (const width of [1920, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    await expect(
      page.getByRole("heading", { name: "My active weekly plan", exact: true }),
    ).toBeVisible();
    const bounds = await page.locator("main").boundingBox();
    expect(bounds!.width).toBeGreaterThan(width - 300);
    expect(bounds!.x + bounds!.width).toBeGreaterThan(width - 2);
  }
  await page.getByRole("link", { name: "Weekly Plan", exact: true }).click();
  await expect(page.locator("header").first()).not.toContainText(/Weekly Plan|Staff workspace/);
  await expect(page.getByLabel("Plan title", { exact: true })).toHaveValue(
    "Weekly Work Plan \u2013 Week 47",
  );
  await expect(page.getByLabel("Plan title", { exact: true })).toHaveCSS("font-size", "14px");
  await expect(page.getByLabel("Weekly objective", { exact: true })).toHaveAttribute(
    "placeholder",
    "Complete priority system improvements, support operations and provide timely updates to management.",
  );
  await page.getByLabel("Week to prepare", { exact: true }).fill("2026-11-23");
  await expect(page.getByLabel("Plan title", { exact: true })).toHaveValue(
    "Weekly Work Plan \u2013 Week 48",
  );
  await page.goto("/tasks");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 247, 251)");
  await expect(page.getByRole("main").first()).not.toHaveClass(/reporting-active/);
  await expect(page.locator("header").first()).not.toContainText(/Weekly Plan|Staff workspace/);
  await expect(page.locator("aside").first()).toHaveCSS("width", "224px");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Reporting period (optional)", { exact: true })).toHaveValue("");
  await dialog.getByLabel("Task name", { exact: true }).fill("Task waiting for next week's plan");
  await dialog.getByLabel("Reporting period (optional)", { exact: true }).fill("2026-11-24");
  await expect(dialog.getByText("No plan exists for this period.", { exact: false })).toBeVisible();
  await dialog.getByLabel("Due date", { exact: true }).fill("2026-11-27");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/reporting?view=weekly-plan&week=2026-11-23");
  await expect(page.getByLabel("Task 1", { exact: true })).toHaveValue(
    "Task waiting for next week's plan",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await dialog.getByLabel("Task name", { exact: true }).fill("Task added to an existing plan");
  await dialog.getByLabel("Reporting period (optional)", { exact: true }).fill("2026-11-23");
  await expect(
    dialog.getByText("This task will be added to the plan", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/reporting?view=weekly-plan&week=2026-11-23");
  await expect(page.getByLabel("Task 2", { exact: true })).toHaveValue(
    "Task added to an existing plan",
  );
  await page.screenshot({ path: test.info().outputPath("wide-plan.png"), fullPage: true });
  await page.goto("/reporting?view=weekly-report&week=2026-11-23");
  await expect(page.getByLabel("Executive summary", { exact: true })).toHaveAttribute(
    "placeholder",
    "Summarise key progress and outcomes...",
  );
  await expect(page.getByLabel("Challenges and blockers", { exact: true })).toHaveAttribute(
    "placeholder",
    "What slowed you down? What support do you need?",
  );
  await expect(page.getByLabel("Next week's priorities", { exact: true })).toHaveAttribute(
    "placeholder",
    "What will you focus on next week?",
  );
  const status = page.getByLabel("Status: Task waiting for next week's plan", { exact: true });
  await status.selectOption("completed");
  await expect(status).toHaveCSS("background-color", "rgb(232, 246, 239)");
  await expect(
    page.getByLabel("Outcome: Task waiting for next week's plan", { exact: true }),
  ).toHaveAttribute("placeholder", "Outcome / explanation");
  await page.screenshot({ path: test.info().outputPath("wide-report.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("mobile-report.png"), fullPage: true });
});

test("uses the normal page width for all CEO reporting views on large screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1080 });
  await login(page, "ceo@ops-verify.local");
  await expect(page.getByRole("main").first()).not.toHaveClass(/reporting-active/);
  for (const [view, title] of [
    ["overview", "Reporting overview"],
    ["submissions", "Submission inbox"],
    ["team-plans", "Team plans"],
    ["team-reports", "Team reports"],
    ["performance", "Staff performance"],
  ]) {
    await page.goto(`/reporting?view=${view}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("main").first()).toHaveClass(/reporting-active/);
    await expect(page.getByRole("img", { name: "Amsol", exact: true })).toBeVisible();
    const bounds = await page.locator("main").boundingBox();
    expect(bounds!.width).toBeGreaterThan(2260);
    expect(bounds!.x + bounds!.width).toBeGreaterThan(2558);
  }
  await page.screenshot({ path: test.info().outputPath("wide-ceo-reporting.png"), fullPage: true });
  await page.goto("/admin");
  await expect(page.getByRole("main").first()).not.toHaveClass(/reporting-active/);
  await expect(page.locator("header").first()).not.toContainText(/Overview|CEO workspace/);
  await expect(page.locator("aside").first()).toHaveCSS("width", "224px");
});
