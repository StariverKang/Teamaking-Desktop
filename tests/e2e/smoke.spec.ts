import { expect, test } from "@playwright/test";

test("public entry, contact, help and support surfaces render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "联系开发者" })).toHaveAttribute("href", "/contact-developer");
  await expect(page.getByRole("link", { name: "先看看 Course Boards" })).toHaveCount(0);

  await page.goto("/contact-developer");
  await expect(page.getByRole("heading", { name: "联系开发者", level: 1 })).toBeVisible();
  await expect(page.getByText("查看开发者简介、微信和邮箱")).toBeVisible();
  const contactResponse = await page.request.get("/api/content?kind=developer_contact");
  expect(contactResponse.ok()).toBeTruthy();
  expect(((await contactResponse.json()).documents ?? []).length).toBeGreaterThan(0);

  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "帮助中心", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "文档目录" })).toBeVisible();
  const helpResponse = await page.request.get("/api/content?kind=help");
  expect(helpResponse.ok()).toBeTruthy();
  expect(((await helpResponse.json()).documents ?? []).length).toBeGreaterThan(0);

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

test("matches pagination avoids support widget and hides same-school tag", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route("**/api/matches?**", async (route) => {
    const users = Array.from({ length: 9 }, (_, index) => ({
      user: {
        id: `mock-user-${index}`,
        email: `mock-user-${index}@mail.bnbu.edu.cn`,
        profile: {
          displayName: `Mock User ${index + 1}`,
          grade: "Year 1",
          major: { name: index % 2 ? "Accounting Programme" : "Artificial Intelligence Programme" },
          bio: "还没有填写个人介绍。"
        },
        skills: []
      },
      score: 100 - index,
      reasons: index === 0
        ? ["同一课程记录", "同校可发现"]
        : index === 1
          ? ["二度"]
          : index === 2
            ? ["三度"]
            : ["同校可发现"]
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        posts: [],
        users: users.slice(0, 8),
        usersPagination: { page: 1, pageSize: 8, total: users.length, totalPages: 2 }
      })
    });
  });

  await page.goto("/matches");
  await expect(page.getByText("Mock User 1")).toBeVisible();
  await expect(page.getByText("同一课程记录", { exact: true })).toBeVisible();
  await expect(page.getByText("二度", { exact: true })).toBeVisible();
  await expect(page.getByText("三度", { exact: true })).toBeVisible();
  await expect(page.getByText("同校可发现", { exact: true })).toHaveCount(0);

  const supportButton = page.getByTestId("support-widget-toggle");
  const nextButton = page.getByTestId("matches-users-pagination").getByRole("button", { name: "Next" });
  await expect(supportButton).toBeVisible();
  await expect(nextButton).toBeVisible();

  const supportBox = await supportButton.boundingBox();
  const nextBox = await nextButton.boundingBox();
  expect(supportBox).not.toBeNull();
  expect(nextBox).not.toBeNull();
  const overlaps = Boolean(
    supportBox &&
    nextBox &&
    supportBox.x < nextBox.x + nextBox.width &&
    supportBox.x + supportBox.width > nextBox.x &&
    supportBox.y < nextBox.y + nextBox.height &&
    supportBox.y + supportBox.height > nextBox.y
  );
  expect(overlaps).toBe(false);
});
