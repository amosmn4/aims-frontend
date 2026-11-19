import { test, expect } from "@playwright/test";

test("System Admin uses the profile icon to correct staff email and resend an invitation as CEO", async ({
  page,
}) => {
  const renderingErrors: string[] = [];
  page.on("pageerror", (error) => renderingErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Maximum update depth"))
      renderingErrors.push(message.text());
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@ops-verify.local");
  await page.getByLabel("Password", { exact: true }).fill("OpsBrowser2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "System administration", exact: true }),
  ).toBeVisible();
  const enter = page.getByRole("button", { name: "Open CEO workspace", exact: true });
  await expect(enter).toBeVisible();
  await expect(enter).toHaveText("");
  await page.screenshot({ path: test.info().outputPath("system-admin-icon.png") });
  await expect(page.getByRole("link", { name: "Staff", exact: true })).toHaveCount(0);
  await enter.click();
  const chooser = page.getByRole("dialog", { name: "CEO account", exact: true });
  await expect(
    chooser.or(page.getByRole("button", { name: "Return to System Admin", exact: true })),
  ).toBeVisible();
  if (await chooser.isVisible())
    await chooser.getByRole("button", { name: /ceo@ops-verify.local/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText("System administration is restricted to the System Admin account.", {
      exact: true,
    }),
  ).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Staff", exact: true })).toBeVisible();
  const exit = page.getByRole("button", { name: "Return to System Admin", exact: true });
  await expect(exit).toHaveAttribute("aria-pressed", "true");
  await expect(exit).toHaveText("");
  await exit.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("ceo-session-icon.png") });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Return to System Admin", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  const staff = page.getByRole("row").filter({ hasText: "invite-ui@ops-verify.local" });
  await staff.getByRole("button", { name: "Edit invite-ui@ops-verify.local", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const corrected = `invite-corrected-${Date.now()}@ops-verify.local`;
  await dialog.getByLabel("Email", { exact: true }).fill(corrected);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const updated = page.getByRole("row").filter({ hasText: corrected });
  await updated.getByRole("button", { name: "Resend invitation", exact: true }).click();
  await expect(page.getByLabel("Invitation link", { exact: true })).toHaveValue(/\/login\?token=/);
  await updated.getByRole("button", { name: `Edit ${corrected}`, exact: true }).click();
  await dialog.getByLabel("Email", { exact: true }).fill("invite-ui@ops-verify.local");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Return to System Admin", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "System administration", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Open CEO workspace", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff", exact: true })).toHaveCount(0);
  await page.goto("/");
  await expect(page).toHaveURL(/\/system-admin$/);
  await expect(
    page.getByRole("heading", { name: "System administration", exact: true }),
  ).toBeVisible();
  expect(renderingErrors).toEqual([]);
});
