import { expect, test } from "@playwright/test";

test("login and support surfaces render", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /已注册用户登录|学校邮箱注册|找回密码/ })).toBeVisible();

  await page.goto("/support");
  await expect(page.getByRole("heading", { name: "Support Ticket" })).toBeVisible();
  await expect(page.getByRole("button", { name: "提交工单" })).toBeVisible();
});

test("admin login and error events surfaces render", async ({ page }) => {
  await page.goto("/admin-login");
  await expect(page.getByRole("heading", { name: "管理入口" })).toBeVisible();

  await page.goto("/admin/error-events");
  await expect(page.getByRole("heading", { name: /Error Events|错误事件/ })).toBeVisible();
});

test("admin and crawler pages use viewport-bounded workspaces", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/crawler");
  const crawlerWorkspace = page.locator('[data-workspace-scroll="true"]');
  await expect(crawlerWorkspace).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Download outputs" })).toBeVisible();
  await expect
    .poll(() => crawlerWorkspace.evaluate((node) => window.getComputedStyle(node).overflowY))
    .toBe("auto");

  await page.goto("/admin/error-events");
  const adminWorkspace = page.locator('[data-workspace-scroll="true"]');
  await expect(adminWorkspace).toBeVisible();
  await expect
    .poll(() => adminWorkspace.evaluate((node) => window.getComputedStyle(node).overflowY))
    .toBe("auto");
});

test("dashboard shows official reference links for logged-in users", async ({ page }) => {
  const response = await page.request.post("/api/demo/login", { data: { account: "media" } });
  expect(response.ok()).toBeTruthy();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "官方查询入口" })).toBeVisible();
  await expect(page.getByRole("link", { name: /BNBU 专业介绍/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /AR 官方四年课程安排/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /MIS 本学期真实选课 \/ 课表/ })).toBeVisible();
});
