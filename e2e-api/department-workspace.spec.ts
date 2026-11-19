import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("department workspace and task page share scope without revealing personal drafts or unrelated work", async ({
  page,
  request,
}) => {
  const base = "http://127.0.0.1:4001/api/v1/ops";
  const authenticate = async (email: string) =>
    (
      await (
        await request.post(`${base}/auth/login`, { data: { email, password: "OpsBrowser2026!" } })
      ).json()
    ).accessToken as string;
  const ceo = await authenticate("ceo@ops-verify.local");
  const staff = await authenticate("staff@ops-verify.local");
  const snapshot = async (token: string) =>
    await (
      await request.get(`${base}/workspace`, { headers: { Authorization: `Bearer ${token}` } })
    ).json();
  const data = (await snapshot(ceo)).workspace;
  const id = data.accounts.find(
    (row: { email: string }) => row.email === "staff@ops-verify.local",
  ).id;
  const other = data.accounts.find(
    (row: { email: string }) => row.email === "it@ops-verify.local",
  ).id;
  const save = async (
    collection: string,
    body: { id: string; [key: string]: unknown },
    token = ceo,
  ) => {
    const current = await snapshot(token);
    const response = await request.put(`${base}/records/${collection}/${body.id}`, {
      headers: { Authorization: `Bearer ${token}`, "If-Match": String(current.revision) },
      data: body,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  };
  const suffix = Date.now();
  const shared = randomUUID();
  const personal = randomUUID();
  const project = {
    name: `Department project ${suffix}`,
    lead: other,
    members: [id, other],
    depts: ["hr"],
    stage: "In progress",
    status: "on-track",
    progress: 20,
    due: "2026-11-22",
    summary: "Shared departmental work",
  };
  await save("projects", { ...project, id: shared });
  await save("projects", {
    ...project,
    id: personal,
    name: `Personal IT project ${suffix}`,
    depts: ["it"],
  });
  const task = {
    title: `Cross-team task ${suffix}`,
    project: shared,
    assignee: other,
    due: "2026-11-22",
    priority: "Urgent",
    status: "To do",
  };
  await save("tasks", { ...task, id: randomUUID() });
  await save("tasks", {
    ...task,
    id: randomUUID(),
    title: `Unrelated IT task ${suffix}`,
    project: personal,
    assignee: id,
  });
  await save(
    "reports",
    {
      id: randomUUID(),
      title: `Private draft ${suffix}`,
      author: id,
      dept: "hr",
      type: "Monthly",
      month: "2026-11",
      date: "2026-11-20",
      progress: "Private draft notes",
      blockers: "",
      next: "",
      reviewed: false,
      status: "draft",
    },
    staff,
  );
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("staff@ops-verify.local");
  await page.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  const tenderLinks = await page.getByRole("link", { name: "Tenders", exact: true }).count();
  await page.getByLabel("Workspace view").selectOption("department");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "HR Services workspace", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(`Cross-team task ${suffix}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Unrelated IT task ${suffix}`, { exact: true })).toHaveCount(0);
  await expect(page.getByText(`Private draft ${suffix}`, { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/department-workspace.png", fullPage: true });
  await page.getByRole("link", { name: "Open department tasks", exact: true }).click();
  await page.getByPlaceholder("Search tasks").fill(String(suffix));
  await expect(page.getByText(`Cross-team task ${suffix}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Unrelated IT task ${suffix}`, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Tenders", exact: true })).toHaveCount(tenderLinks);
  await page.screenshot({ path: "test-results/department-workspace-tasks.png", fullPage: true });
});
