import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function login(page: Page, email = "ceo@ops-verify.local") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

test("CEO manages existing inventory and staff module access controls navigation and editing", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await login(page);
  for (const name of ["Inventory", "Tenders", "Blog", "Water Project"])
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await page.goto("/inventory");
  const name = `UI asset ${Date.now()}`;
  await page.getByRole("button", { name: "Add asset", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Asset tag", { exact: true }).fill(name);
  await dialog.getByLabel("Asset name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByPlaceholder("Search assets in the selected filters").fill(name);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Condition", exact: true }).selectOption("faulty");
  await expect(page.getByText("No assets match these filters.")).toBeVisible();
  await page.getByRole("combobox", { name: "Condition", exact: true }).selectOption("good");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/admin?tab=Module%20access");
  await page.getByLabel("inventory access for staff@ops-verify.local").selectOption("view");
  await expect(page.getByText("Module access updated", { exact: true })).toBeVisible();
  const context = await browser.newContext();
  const staff = await context.newPage();
  await login(staff, "staff@ops-verify.local");
  await staff.goto("/inventory");
  await staff.getByPlaceholder("Search assets in the selected filters").fill(name);
  await expect(staff.locator("tbody tr")).toHaveCount(1);
  await expect(staff.getByRole("button", { name: "Add asset", exact: true })).toHaveCount(0);
  await expect(staff.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await context.close();
  const outsiderContext = await browser.newContext();
  const outsider = await outsiderContext.newPage();
  await login(outsider, "it@ops-verify.local");
  await expect(outsider.getByRole("link", { name: "Inventory", exact: true })).toHaveCount(0);
  await outsider.goto("/inventory");
  await expect(
    outsider.getByRole("heading", { name: "Access restricted", exact: true }),
  ).toBeVisible();
  await outsiderContext.close();
});

test("weekly work and subtasks flow into a scheduled monthly draft and the CEO review", async ({
  page,
  browser,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-20T16:00:00Z"));
  const suffix = Date.now();
  const taskName = `UI contingency ${suffix}`;
  const reportName = `UI monthly results ${suffix}`;
  const fileName = `monthly-evidence-${suffix}.txt`;
  await login(page, "staff@ops-verify.local");
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task name", { exact: true }).fill(taskName);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByPlaceholder("Search tasks").fill(taskName);
  await page.getByText("Details", { exact: true }).click();
  await page.getByRole("button", { name: `Edit ${taskName}`, exact: true }).click();
  await dialog
    .getByLabel("Subtasks (optional, one per line)", { exact: true })
    .fill("Check input\nSend results");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Check input", { exact: true }).check();
  await expect(page.getByText("Subtask updated", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByPlaceholder("Search tasks").fill(taskName);
  await page.getByText("Details", { exact: true }).click();
  await expect(page.getByLabel("Check input", { exact: true })).toBeChecked();
  await page.goto("/reports");
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Report title", { exact: true }).fill(reportName);
  await dialog
    .getByLabel("Progress and results", { exact: true })
    .fill("Completed the urgent work and recorded its checklist outcomes.");
  await dialog.getByLabel("Upload report attachment", { exact: true }).setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from("UI monthly evidence"),
  });
  await expect(dialog.getByText(fileName, { exact: true })).toBeVisible();
  await dialog.getByLabel("Submission time (EAT)").fill("2026-11-23T10:00");
  await dialog.getByRole("button", { name: "Save and schedule", exact: true }).click();
  await expect(dialog.getByText(/^pending:/)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByPlaceholder("Search reports within these filters").fill(reportName);
  await expect(page.getByRole("heading", { name: reportName, exact: true })).toBeVisible();
  const context = await browser.newContext();
  const ceo = await context.newPage();
  await login(ceo);
  await ceo.goto("/reports");
  await ceo.getByPlaceholder("Search reports within these filters").fill(reportName);
  await expect(ceo.getByText("No reports match your selection.")).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await ceo.reload();
  await ceo.getByPlaceholder("Search reports within these filters").fill(reportName);
  await expect(ceo.getByRole("heading", { name: reportName, exact: true })).toBeVisible();
  await expect(ceo.getByText(taskName, { exact: true })).toBeVisible();
  await expect(ceo.getByText("Medium", { exact: true }).first()).toBeVisible();
  const outcomes = ceo.locator("details").filter({ has: ceo.getByText(taskName, { exact: true }) });
  await expect(outcomes).not.toContainText(/\bdue\b/i);
  await expect(outcomes.getByLabel("Check input", { exact: true })).toBeChecked();
  await expect(outcomes.getByLabel("Send results", { exact: true })).not.toBeChecked();
  const download = ceo.waitForEvent("download");
  await ceo.getByRole("button", { name: fileName, exact: true }).click();
  const file = await download;
  expect((await readFile((await file.path())!)).toString()).toBe("UI monthly evidence");
  await ceo.screenshot({ path: "test-results/ops-monthly-ceo.png", fullPage: true });
  await ceo.getByLabel(`Review comment for ${reportName}`).fill("Reviewed by CEO in verification");
  await ceo.getByRole("button", { name: "Mark reviewed", exact: true }).click();
  await expect(ceo.getByText("Reviewed by CEO in verification", { exact: false })).toBeVisible();
  await context.close();
});

test("staff share documents, upload Version 2 and download both original and updated content", async ({
  page,
  browser,
}) => {
  const suffix = Date.now();
  const firstName = `shared-ui-${suffix}.txt`;
  const secondName = `shared-ui-v2-${suffix}.txt`;
  await login(page, "staff@ops-verify.local");
  await page.goto("/documents");
  await page.getByRole("button", { name: "Upload document", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: firstName,
    mimeType: "text/plain",
    buffer: Buffer.from("Original UI content"),
  });
  await dialog.getByLabel("Access", { exact: true }).selectOption("restricted");
  await dialog.getByRole("checkbox", { name: "Browser IT", exact: true }).check();
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByPlaceholder("Search documents").fill(firstName);
  await page.getByRole("button", { name: "Versions", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: secondName,
    mimeType: "text/plain",
    buffer: Buffer.from("Updated UI content"),
  });
  await expect(dialog.getByText("Version 2", { exact: true })).toBeVisible();
  const originalDownload = page.waitForEvent("download");
  await dialog
    .getByText("Version 1", { exact: true })
    .locator("..")
    .locator("..")
    .getByRole("button", { name: "Download", exact: true })
    .click();
  expect((await readFile((await (await originalDownload).path())!)).toString()).toBe(
    "Original UI content",
  );
  await page.keyboard.press("Escape");
  const context = await browser.newContext();
  const other = await context.newPage();
  await login(other, "it@ops-verify.local");
  await other.goto("/documents");
  await other.getByPlaceholder("Search documents").fill(secondName);
  const updatedDownload = other.waitForEvent("download");
  await other.getByRole("button", { name: `Download ${secondName}`, exact: true }).click();
  expect((await readFile((await (await updatedDownload).path())!)).toString()).toBe(
    "Updated UI content",
  );
  await context.close();
});
