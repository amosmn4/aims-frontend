import { expect, test, type Page } from "@playwright/test";
import type { Workspace } from "../src/lib/models";
import type { WeeklyDetail, WeeklyPhase, WeeklySubmission } from "../src/lib/weekly";
import type { TaskDelegation } from "../src/lib/task-delegations";

const staffId = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
const taskId = "10000000-0000-4000-8000-000000000003";
const week = "2026-11-23";

async function workspaceApi(page: Page, incoming = false) {
  const account = {
    id: staffId,
    personId: staffId,
    email: "staff@example.test",
    role: "staff" as const,
    active: true,
    salt: "",
    passwordHash: "",
    hasPassword: true,
  };
  const workspace: Workspace = {
    version: 1,
    departments: [{ id: "hr", name: "Human resources", blurb: "", modules: [] }],
    people: [
      { id: staffId, name: "Test Staff", title: "Consultant", dept: "hr" },
      { id: otherId, name: "Other Staff", title: "Consultant", dept: "hr" },
    ],
    accounts: [account],
    clients: [],
    projects: [],
    reports: [],
    documents: [],
    tenders: [],
    clientRequests: [],
    businessFinance: [],
    businessAccess: [],
    staffBusiness: [],
    moduleRecords: [],
    templates: [],
    businesses: [{ id: "b0", name: "Amsol", sector: "Operations" }],
    tasks: incoming
      ? []
      : [
          {
            id: taskId,
            title: "Existing staff task",
            description: "<p>Existing instructions</p>",
            project: "",
            assignee: staffId,
            due: "2026-11-20",
            weekStart: "2026-11-16",
            priority: "High",
            status: "To do",
            source: "planned",
          },
        ],
    settings: {
      company: "Amsol Ops",
      reminderDays: 7,
      remindersEnabled: true,
      defaultDocumentAccess: "department",
    },
  };
  const detail: WeeklyDetail = {
    person: { id: staffId, name: "Test Staff", dept: "hr" },
    weekStart: week,
    weekEnd: "2026-11-29",
    now: "2026-11-27T16:00:00Z",
    configured: true,
    reportOpensAt: "2026-11-27T12:00:00Z",
    deadlines: { plan: "2026-11-23T14:00:00Z", report: "2026-11-27T14:00:00Z" },
    plan: null,
    report: null,
    tasks: [],
  };
  const delegation: TaskDelegation = {
    id: "request",
    taskId,
    taskTitle: "Delegated follow-up",
    senderId: incoming ? otherId : staffId,
    recipientId: incoming ? staffId : otherId,
    weekStart: week,
    status: "pending",
    createdAt: detail.now,
    respondedAt: null,
    sender: { id: incoming ? otherId : staffId, name: incoming ? "Other Staff" : "Test Staff" },
    recipient: { id: incoming ? staffId : otherId, name: incoming ? "Test Staff" : "Other Staff" },
  };
  if (incoming)
    detail.plan = {
      id: "existing-plan",
      staffId,
      weekStart: week,
      phase: "plan",
      version: 1,
      submission: {
        title: "Existing plan",
        summary: "",
        items: [],
        blockers: "",
        nextWeek: "",
        noWorkReason: "",
      },
      submittedAt: null,
      updatedAt: detail.now,
      late: false,
      reviewedAt: null,
      reviewComment: null,
      returnedAt: null,
      returnComment: null,
      editable: true,
      counts: {},
    };
  let requests = incoming ? [delegation] : [];
  let expired = false;
  let minutes = 60;
  let revision = 1;
  const submissions: {
    phase: WeeklyPhase;
    submit: boolean;
    lateReason?: string;
    submission: WeeklySubmission;
  }[] = [];
  const unknown: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/ops/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split("/ops")[1]!;
    const method = request.method();
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/login") {
      expired = false;
      return reply({ accessToken: "test-token" });
    }
    if (path === "/auth/refresh" && expired)
      return reply({ message: "Your session has expired." }, 401);
    if (path === "/auth/refresh") return reply({ accessToken: "test-token" });
    if (expired) return reply({ message: "Your session has expired." }, 401);
    if (path === "/auth/me") return reply(account);
    if (path === "/workspace") return reply({ workspace, revision });
    if (path === "/submission-schedules") return reply([]);
    if (path === "/submission-reminder") {
      if (method === "PUT") {
        minutes = request.postDataJSON().minutes;
        revision++;
      }
      return reply({ minutes });
    }
    if (path === "/task-delegations") return reply(requests);
    if (path === `/tasks/${taskId}/delegation-recipients`)
      return reply([{ id: otherId, name: "Other Staff" }]);
    if (path.endsWith("/delegate")) {
      requests = [delegation];
      revision++;
      return reply({ id: delegation.id, status: "pending", weekStart: week });
    }
    if (path === "/task-delegations/request/respond") {
      delegation.status = request.postDataJSON().decision;
      delegation.respondedAt = detail.now;
      revision++;
      if (delegation.status === "accepted")
        workspace.tasks.push({
          id: taskId,
          title: delegation.taskTitle,
          description: "<p>Accepted instructions</p>",
          assignee: staffId,
          project: "",
          due: "2026-11-27",
          weekStart: week,
          priority: "High",
          status: "To do",
        });
      if (delegation.status === "accepted" && detail.plan) {
        detail.plan.version++;
        detail.plan.submission.items.push({
          id: taskId,
          taskId,
          title: delegation.taskTitle,
          detail: "<p>Accepted instructions</p>",
          status: "planned",
          due: "2026-11-27",
          priority: "High",
        });
      }
      return reply({ status: delegation.status });
    }
    if (path === "/weekly/notifications")
      return reply(
        incoming
          ? [
              {
                id: "notification",
                title: "Task delegation request",
                body: "Other Staff would like to delegate a task to you.",
                createdAt: detail.now,
                isRead: false,
                resourceType: "ops-delegation",
                resourceId: delegation.id,
              },
            ]
          : [],
      );
    if (path === "/weekly/submissions")
      return reply({
        items: [detail.plan, detail.report].filter(Boolean),
        total: 0,
        page: 1,
        limit: 20,
      });
    if (path.endsWith("/history")) return reply([]);
    if (path === `/weekly/reports/${week}/${staffId}`)
      return reply({ ...detail, tasks: workspace.tasks });
    if (method === "PUT" && (path.endsWith("/plan") || path.endsWith("/report"))) {
      const phase = path.endsWith("/plan") ? "plan" : "report";
      const body = request.postDataJSON();
      submissions.push({ ...body, phase });
      detail[phase] = {
        id: `${phase}-entry`,
        staffId,
        weekStart: week,
        phase,
        version: (detail[phase]?.version ?? 0) + 1,
        submission: body.submission,
        submittedAt: body.submit ? detail.now : null,
        updatedAt: detail.now,
        late: !!body.submit,
        lateReason: body.lateReason,
        reviewedAt: null,
        reviewComment: null,
        returnedAt: null,
        returnComment: null,
        editable: true,
        counts: {},
      };
      return reply(detail[phase]);
    }
    unknown.push(`${method} ${path}`);
    return reply({ message: `Unhandled test API: ${path}` }, 500);
  });
  return {
    workspace,
    submissions,
    errors,
    unknown,
    expire: () => {
      expired = true;
    },
  };
}

async function login(page: Page, phase: WeeklyPhase = "plan") {
  await page.goto(
    `/login?redirect=${encodeURIComponent(`/reporting?view=weekly-${phase}&week=${week}`)}`,
  );
  await page.getByLabel("Email", { exact: true }).fill("staff@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByLabel(phase === "plan" ? "Weekly objective" : "Executive summary", { exact: true }),
  ).toBeVisible();
}

test("report deliverables keep separate outcomes and future dates after reload", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-27T16:00:00Z"));
  const state = await workspaceApi(page);
  await login(page, "report");
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  await page.getByLabel("Task 1", { exact: true }).fill("Recruitment outcomes");
  const editor = page.getByRole("textbox", { name: "Description for task 1", exact: true });
  await editor.fill("Campaign");
  await page.getByRole("button", { name: "Checklist", exact: true }).click();
  for (const title of ["References", "Approval", "Old opening", "Certificate"]) {
    await editor.press("End");
    await editor.press("Enter");
    await editor.pressSequentially(title);
  }
  for (const name of [
    "Campaign",
    "Forward: References",
    "Blocked: Approval",
    "Cancelled: Old opening",
  ])
    await editor.getByRole("checkbox", { name, exact: true }).check();
  await editor.getByRole("checkbox", { name: "Postpone: Certificate", exact: true }).click();
  const postpone = page.getByRole("dialog", { name: "Postpone deliverable", exact: true });
  await postpone.getByLabel("New due date", { exact: true }).fill("2027-01-13");
  await postpone.getByRole("button", { name: "Postpone deliverable", exact: true }).click();
  await expect(
    editor.getByRole("checkbox", { name: "Forward: Certificate", exact: true }),
  ).not.toBeChecked();
  const before = await editor
    .locator('li[data-type="taskItem"]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-did")));
  expect(new Set(before).size).toBe(5);
  await page.screenshot({ path: "test-results/deliverable-outcomes-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: "test-results/deliverable-outcomes-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  expect(state.submissions.at(-1)!.submit).toBe(false);
  const saved = state.submissions.at(-1)!.submission.items[0]!.detail;
  for (const status of ["completed", "forwarded", "blocked", "cancelled", "postponed"])
    expect(saved).toContain(`data-status="${status}"`);
  expect(saved).toContain('data-target-date="2027-01-13"');
  expect(saved).toContain('data-target-date="2026-12-04"');
  expect(saved).not.toContain("deliverable-actions");
  await page.reload();
  await page.getByRole("button", { name: "Edit task 1", exact: true }).click();
  for (const name of [
    "Campaign",
    "Forward: References",
    "Blocked: Approval",
    "Cancelled: Old opening",
    "Postpone: Certificate",
  ])
    await expect(editor.getByRole("checkbox", { name, exact: true })).toBeChecked();
  expect(
    await editor
      .locator('li[data-type="taskItem"]')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-did"))),
  ).toEqual(before);
  expect(state.errors).toEqual([]);
  expect(state.unknown).toEqual([]);
});

test("several nested deliverables keep their identities and only the selected item moves", async ({
  page,
}) => {
  const state = await workspaceApi(page);
  await login(page);
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  await page.getByLabel("Task 1", { exact: true }).fill("Nested work");
  const editor = page.getByRole("textbox", { name: "Description for task 1", exact: true });
  await editor.fill("Parent deliverable");
  await page.getByRole("button", { name: "Checklist", exact: true }).click();
  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("First child");
  await editor.press("Tab");
  await editor.press("Enter");
  await editor.pressSequentially("Second child");
  await editor.press("Enter");
  await editor.pressSequentially("Third child");
  await expect(editor.locator("li li")).toHaveCount(3);
  const before = await editor
    .locator('li[data-type="taskItem"]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-did")));
  expect(new Set(before).size).toBe(4);
  await editor.press("Shift+Tab");
  await expect(editor.locator("li li")).toHaveCount(2);
  await expect(editor.locator("li li").nth(0)).toContainText("First child");
  await expect(editor.locator("li li").nth(1)).toContainText("Second child");
  expect(
    await editor
      .locator('li[data-type="taskItem"]')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-did"))),
  ).toEqual(before);
  await editor.getByRole("checkbox", { name: "Forward: First child", exact: true }).check();
  await expect(
    editor.getByRole("checkbox", { name: "Forward: Second child", exact: true }),
  ).not.toBeChecked();
  await expect(
    editor.getByRole("checkbox", { name: "Forward: Parent deliverable", exact: true }),
  ).not.toBeChecked();
  expect(state.errors).toEqual([]);
});

for (const phase of ["plan", "report"] as const) {
  test(`${phase} uses one task editor, supports nested checklists and preserves saved content`, async ({
    page,
  }) => {
    const state = await workspaceApi(page);
    await login(page, phase);
    await page.getByRole("button", { name: "Add task", exact: true }).first().click();
    if (phase === "plan") {
      await page.getByLabel("Choose an existing task").selectOption(taskId);
      await page.getByRole("button", { name: "Add selected task", exact: true }).click();
      await expect(page.getByLabel("Task 1", { exact: true })).toHaveValue("Existing staff task");
    }
    await page.getByLabel("Task 1", { exact: true }).fill("Checklist work");
    const editor = page.getByRole("textbox", { name: "Description for task 1", exact: true });
    await editor.fill("First deliverable");
    await page.getByRole("button", { name: "Checklist", exact: true }).click();
    await editor.press("End");
    await editor.press("Enter");
    await editor.pressSequentially("Second deliverable");
    await editor.press("Tab");
    await expect(editor.locator("ul li ul li")).toHaveCount(1);
    await editor.press("Shift+Enter");
    await editor.pressSequentially("Supporting detail");
    await expect(editor.locator("li li")).toContainText("Supporting detail");
    await editor.press("Shift+Tab");
    await expect(editor.locator("li li")).toHaveCount(0);
    const alignment = await editor.evaluate((element) => {
      const box = element.querySelector("input")!.getBoundingClientRect();
      const text = element.querySelector(".deliverable-content p")!.getBoundingClientRect();
      return Math.abs(box.top - text.top);
    });
    expect(alignment).toBeLessThan(8);
    await editor.press("End");
    await editor.press("Enter");
    await editor.press("Enter");
    await editor.pressSequentially("Paragraph below checklist");
    await expect(
      editor.locator(":scope > p").filter({ hasText: "Paragraph below checklist" }),
    ).toHaveText("Paragraph below checklist");
    await page.getByRole("button", { name: "Bullet list", exact: true }).click();
    await editor.press("End");
    await editor.press("Enter");
    await editor.pressSequentially("Nested bullet");
    await editor.press("Tab");
    await expect(editor.locator('ul:not([data-type="taskList"]) ul li')).toHaveText(
      "Nested bullet",
    );
    await editor.press("Shift+Tab");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add task", exact: true })).toHaveCount(2);
    await page.screenshot({ path: `test-results/weekly-${phase}-layout.png`, fullPage: true });
    if (phase === "report") {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: "test-results/weekly-report-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1366, height: 768 });
    }
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Edit task 1", exact: true }).click();
    await expect(editor).toContainText("First deliverable");
    await expect(editor).toContainText("Supporting detail");
    await page.getByRole("button", { name: "Cancel task", exact: true }).click();
    await page.getByRole("button", { name: `Submit ${phase} to CEO`, exact: true }).click();
    const late = page.getByRole("dialog", { name: "Reason for late submission" });
    await expect(late.getByRole("button", { name: `Submit ${phase}`, exact: true })).toBeDisabled();
    await late
      .getByLabel("Reason", { exact: true })
      .fill("Client confirmation arrived after the deadline.");
    await late.getByRole("button", { name: `Submit ${phase}`, exact: true }).click();
    await expect(
      page.getByRole("button", { name: `Submit ${phase} update`, exact: true }),
    ).toBeVisible();
    expect(state.submissions.at(-1)).toMatchObject({
      submit: true,
      lateReason: "Client confirmation arrived after the deadline.",
    });
    expect(state.errors).toEqual([]);
    expect(state.unknown).toEqual([]);
  });
}

test("expired sessions sign back in on the same form and reminders save", async ({ page }) => {
  const state = await workspaceApi(page);
  await login(page, "report");
  const summary = page.getByRole("textbox", { name: "Executive summary", exact: true });
  await summary.fill("Unsaved work survives inactivity");
  await page.getByLabel("Reminder before weekly submission deadline").selectOption("20");
  await expect(
    page.getByText("Submission reminder preference saved", { exact: true }),
  ).toBeVisible();
  state.expire();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const recovery = page.getByRole("dialog", { name: "Welcome back" });
  await recovery.getByLabel("Password to continue").fill("TestPassword2026!");
  await recovery.getByRole("button", { name: "Continue working", exact: true }).click();
  await expect(recovery).toHaveCount(0);
  await expect(summary).toHaveValue("Unsaved work survives inactivity");
  await expect(page.getByLabel("Reminder before weekly submission deadline")).toHaveValue("20");
  expect(state.errors).toEqual([]);
  expect(state.unknown).toEqual([]);
});

test("delegation opens in a dialog and waits for acceptance", async ({ page }) => {
  const state = await workspaceApi(page);
  await login(page);
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Delegate task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delegate task" });
  await dialog.getByLabel("Delegate to").selectOption(otherId);
  await dialog.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByText("Task delegations (1 pending)", { exact: true }).click();
  await expect(page.getByText("To Other Staff", { exact: false })).toBeVisible();
  expect(state.workspace.tasks[0]!.assignee).toBe(staffId);
  expect(state.errors).toEqual([]);
  expect(state.unknown).toEqual([]);
});

test("accepting an incoming delegation adds it to the recipient plan", async ({ page }) => {
  const state = await workspaceApi(page, true);
  await login(page);
  const objective = page.getByRole("textbox", { name: "Weekly objective", exact: true });
  await objective.fill("Keep my unsaved objectives");
  await expect(page.getByText("From Other Staff", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Accept task", exact: true }).click();
  await expect(page.getByText("1. Delegated follow-up", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept task", exact: true })).toHaveCount(0);
  expect(state.workspace.tasks[0]!.assignee).toBe(staffId);
  await expect(objective).toHaveValue("Keep my unsaved objectives");
  await expect(
    page.getByText("Saved changes are available. Your current edits are kept here.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(state.errors).toEqual([]);
  expect(state.unknown).toEqual([]);
});
