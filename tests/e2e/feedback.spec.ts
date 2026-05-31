import { expect, test } from "@playwright/test";

test("login failures show a toast and nearby form feedback", async ({ page }) => {
  await page.route("**/api/auth/password-login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: "账号或密码错误",
        errorCode: "AUTH_INVALID_CREDENTIALS",
        requestId: "feedback-login-test"
      })
    });
  });

  await page.goto("/login?mode=login");
  await page.getByPlaceholder("your.name@mail.bnbu.edu.cn").fill("wrong@mail.bnbu.edu.cn");
  await page.getByPlaceholder("输入密码").fill("wrong-password");
  const loginForm = page.locator("form").filter({ has: page.getByRole("button", { name: "登录", exact: true }) });
  await loginForm.getByRole("button", { name: "登录", exact: true }).click();

  await expect(page.getByTestId("feedback-toast").filter({ hasText: "账号或密码错误" })).toBeVisible();
  await expect(loginForm.getByText("账号或密码错误")).toBeVisible();
});

test("read failures keep inline errors and dedupe repeated toast notifications", async ({ page }) => {
  await page.route("**/api/friends?query=", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Friends read failed", errorCode: "FRIENDS_READ_FAILED", requestId: "feedback-read-test" })
    });
  });
  await page.route("**/api/friends?query=a", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ friends: [] })
    });
  });

  await page.goto("/friends");
  const readToast = page.getByTestId("feedback-toast").filter({ hasText: "Friends read failed" });
  await expect(readToast).toHaveCount(1);
  await expect(page.getByRole("main").getByText("Friends read failed")).toBeVisible();

  const search = page.getByPlaceholder("搜索姓名、邮箱、专业、年级");
  await search.fill("a");
  await search.fill("");
  await expect(readToast).toHaveCount(1);
});
