import { test, expect } from "@playwright/test";

test("server-rendered data controls stay disabled before hydration", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".workspace")).toHaveAttribute("data-state", "loading");
    await expect(page.getByRole("button", { name: "Export JSON", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reset to example", exact: true })).toBeDisabled();
    await expect(page.locator('input[type="file"]')).toBeDisabled();
  } finally {
    await context.close();
  }
});

test("restores the local workspace before enabling export", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Data stays in this browser.", { exact: true })).toBeVisible();
  await expect(page.locator(".workspace")).toHaveAttribute("data-state", "ready");
  const button = page.getByRole("button", { name: "Export JSON", exact: true });
  await expect(button).toBeEnabled();
  const download = page.waitForEvent("download");
  await button.click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});
