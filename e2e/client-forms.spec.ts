import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("operations@amsol.local");
  await page.getByLabel("Password", { exact: true }).fill("AmsolDemo2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

async function save(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("description clicks preserve content and formatting, undo, redo and checklist changes persist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task title", { exact: true }).fill("Editor regression task");
  const description = dialog.getByRole("textbox", {
    name: "Description / deliverables (optional)",
    exact: true,
  });
  const undo = dialog.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();
  await description.fill("Prepare shortlist");
  await expect(undo).toBeEnabled();
  await description.click({ position: { x: 20, y: 160 } });
  await expect(description).toHaveText("Prepare shortlist");
  await description.press("Control+a");
  await dialog.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(description.locator("strong")).toHaveText("Prepare shortlist");
  await undo.click();
  await expect(description.locator("strong")).toHaveCount(0);
  await expect(description).toHaveText("Prepare shortlist");
  await dialog.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(description.locator("strong")).toHaveText("Prepare shortlist");
  await dialog.getByRole("button", { name: "Checklist", exact: true }).click();
  await expect(description.locator('ul[data-type="taskList"]')).toHaveCount(1);
  const firstItem = description.locator('li[data-type="taskItem"] > div > p').first();
  await expect(firstItem).toHaveText("Prepare shortlist");
  await firstItem.click();
  await description.press("End");
  await description.press("Enter");
  await expect(description.locator('li[data-type="taskItem"]')).toHaveCount(2);
  await description.pressSequentially("Check references");
  await dialog.getByRole("button", { name: "Indent list", exact: true }).click();
  await expect(description.locator("ul li ul li > div > p")).toHaveText("Check references");
  await description.getByRole("checkbox").last().check();
  await save(page);
  await page.reload();
  await page.getByLabel("Search tasks").fill("Editor regression task");
  await page.getByText("Details", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Check references", exact: true })).toBeChecked();
  await expect(page.getByText("1/2 completed", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("clients and existing or prospective requests save, edit, filter, refresh and delete", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  await page.getByLabel("Client name").fill("Forms regression client");
  await page.getByLabel("Contact person").fill("Contact person");
  await page.getByLabel("Services (comma separated)").fill("Payroll, Training, Payroll");
  await save(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Forms regression client", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Forms regression client", exact: true }).click();
  await expect(page.getByLabel("Services (comma separated)")).toHaveValue("Payroll, Training");
  await page.getByLabel("Contact person").fill("Updated contact");
  await save(page);
  await expect(page.getByText("Contact: Updated contact", { exact: true })).toBeVisible();
  await page.goto("/client-requests");
  await page.getByRole("button", { name: "Log request", exact: true }).click();
  await page.getByLabel("Request title").fill("Forms regression request");
  await page.getByLabel("Prospective client name").fill("Prospective company");
  await page.getByLabel("Notes", { exact: true }).fill("Findable request notes");
  await save(page);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "Forms regression request" })).toContainText(
    "Prospective company",
  );
  await page.getByLabel("Search client requests").fill("Findable request notes");
  await page.getByRole("button", { name: "Edit Forms regression request", exact: true }).click();
  await page.getByLabel("Client", { exact: true }).selectOption("existing");
  await page
    .getByLabel("Select client", { exact: true })
    .selectOption({ label: "Forms regression client" });
  await page.getByLabel("Status", { exact: true }).selectOption("Closed");
  await save(page);
  await page.reload();
  await page.getByLabel("Search client requests").fill("Forms regression request");
  const row = page.getByRole("row").filter({ hasText: "Forms regression request" });
  await expect(row).toContainText("Forms regression client");
  await expect(row).toContainText("Closed");
  await page.getByRole("button", { name: /^Received \(/ }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: /^Closed \(/ }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Delete Forms regression request", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Delete Forms regression request", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Forms regression request", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
