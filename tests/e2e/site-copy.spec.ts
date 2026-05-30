import { expect, type Page, test } from "@playwright/test";

type CopyValues = Record<string, { zh?: string; en?: string }>;

const defaults: CopyValues = {
  "courses.page.title": {
    zh: "Course Boards",
    en: "Course Boards"
  },
  "courses.search.placeholder": {
    zh: "搜索课程代码或课程名称，例如 COM3003；free elective 可直接打开课程板",
    en: "Search course code or course name, e.g. COM3003; free elective opens a board directly"
  }
};

function mergedValues(published: CopyValues, draft?: CopyValues) {
  return {
    ...defaults,
    ...published,
    ...(draft ?? {})
  };
}

async function installSiteCopyMocks(page: Page, state: { admin: boolean; published: CopyValues; draft: CopyValues }) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: state.admin ? "admin-1" : "user-1",
          role: state.admin ? "school_admin" : "profile_completed_user",
          profile: { onboardingTourDismissedAt: new Date().toISOString() }
        }
      })
    });
  });

  await page.route("**/api/onboarding", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { profile: { onboardingTourDismissedAt: new Date().toISOString() }, onboardingCompleted: true },
        guide: { steps: [] }
      })
    });
  });

  await page.route("**/api/notifications/summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ unread: 0 })
    });
  });

  await page.route("**/api/site-copy", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        values: mergedValues(state.published)
      })
    });
  });

  await page.route("**/api/admin/site-copy/draft", async (route) => {
    const body = route.request().postDataJSON() as { changes?: CopyValues };
    state.draft = { ...state.draft, ...(body.changes ?? {}) };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "界面文案草稿已保存。",
        values: mergedValues(state.published, state.draft),
        published: mergedValues(state.published),
        publishedValues: mergedValues(state.published),
        draft: mergedValues(state.published, state.draft),
        hasDraft: Object.keys(state.draft).length > 0,
        changedKeys: Object.keys(state.draft)
      })
    });
  });

  await page.route("**/api/admin/site-copy/publish", async (route) => {
    state.published = { ...state.published, ...state.draft };
    state.draft = {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "界面文案草稿已发布。",
        values: mergedValues(state.published),
        published: mergedValues(state.published),
        publishedValues: mergedValues(state.published),
        draft: mergedValues(state.published),
        hasDraft: false,
        changedKeys: []
      })
    });
  });

  await page.route("**/api/admin/site-copy", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        values: mergedValues(state.published, state.draft),
        published: mergedValues(state.published),
        publishedValues: mergedValues(state.published),
        draft: mergedValues(state.published, state.draft),
        hasDraft: Object.keys(state.draft).length > 0,
        changedKeys: Object.keys(state.draft)
      })
    });
  });

  await page.route("**/api/courses/recommended", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ courses: [], officialLinks: [], academicContext: { relativeTermCode: "Y2S1", semester: { name: "2026 Fall" } } })
    });
  });

  await page.route("**/api/courses/my", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ memberships: [], officialLinks: [] })
    });
  });

  await page.route("**/api/courses/search?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ courses: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } })
    });
  });
}

test("admin edits course interface copy as draft before publishing to users", async ({ page }) => {
  const state = {
    admin: true,
    published: {} as CopyValues,
    draft: {} as CopyValues
  };
  await installSiteCopyMocks(page, state);

  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: "课程板", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "编辑界面文案" }).click();
  await page.getByPlaceholder(defaults["courses.search.placeholder"].zh ?? "").click();
  await expect(page.getByRole("heading", { name: "Course search placeholder" })).toBeVisible();
  await page.getByLabel("中文").fill("搜索课程、关键词或 free elective");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect(page.getByText("界面文案草稿已保存。")).toBeVisible();

  state.admin = false;
  await page.reload();
  await expect(page.getByPlaceholder(defaults["courses.search.placeholder"].zh ?? "")).toBeVisible();
  await expect(page.getByPlaceholder("搜索课程、关键词或 free elective")).toHaveCount(0);

  state.admin = true;
  await page.reload();
  await page.getByRole("button", { name: "编辑界面文案" }).click();
  await page.getByRole("button", { name: "发布 1" }).click();
  await expect(page.getByText("界面文案草稿已发布。")).toBeVisible();

  state.admin = false;
  await page.reload();
  await expect(page.getByPlaceholder("搜索课程、关键词或 free elective")).toBeVisible();
});
