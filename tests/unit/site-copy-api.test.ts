import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  siteConfigFindUnique: vi.fn(),
  siteConfigUpsert: vi.fn(),
  siteConfigDeleteMany: vi.fn(),
  writeAudit: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteConfig: {
      findUnique: mocks.siteConfigFindUnique,
      upsert: mocks.siteConfigUpsert,
      deleteMany: mocks.siteConfigDeleteMany
    }
  }
}));

vi.mock("@/lib/server/services/system-service", () => ({
  writeAudit: mocks.writeAudit
}));

import { handleSiteCopy } from "@/lib/server/api/site-copy-module";
import { handleAdminSiteCopyResource } from "@/lib/server/api/admin-resources/site-copy-resource";

function request(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`https://teamaking.local${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("site copy API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.siteConfigFindUnique.mockResolvedValue(null);
    mocks.siteConfigUpsert.mockImplementation(async ({ where, update, create }) => ({
      key: where.key,
      value: update?.value ?? create?.value,
      updatedAt: new Date("2026-05-29T00:00:00Z")
    }));
    mocks.siteConfigDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("serves published copy without draft values on the public endpoint", async () => {
    mocks.siteConfigFindUnique.mockResolvedValueOnce({
      key: "site_ui_copy_published",
      value: { values: { "courses.page.title": { zh: "课程中心", en: "Course Hub" } } },
      updatedAt: new Date("2026-05-29T00:00:00Z")
    });

    const response = await handleSiteCopy("GET");
    const payload = await response.json();

    expect(payload.values["courses.page.title"]).toMatchObject({ zh: "课程中心", en: "Course Hub" });
    expect(payload.values["courses.search.placeholder"].zh).toContain("搜索课程代码");
  });

  it("saves draft changes and audits the admin action", async () => {
    const response = await handleAdminSiteCopyResource("PATCH", ["admin", "site-copy", "draft"], request("/api/admin/site-copy/draft", "PATCH", {
      changes: {
        "courses.tab.mine": { zh: "我的课", en: "My classes" }
      }
    }), { id: "admin-1", role: "school_admin" });
    const payload = await response?.json();

    expect(mocks.siteConfigUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "site_ui_copy_draft" },
      update: expect.objectContaining({
        value: expect.objectContaining({
          values: expect.objectContaining({
            "courses.tab.mine": { zh: "我的课", en: "My classes" }
          })
        })
      })
    }));
    expect(mocks.writeAudit).toHaveBeenCalledWith("admin-1", "admin.site_copy.draft.patch", "SiteConfig", "site_ui_copy_draft", null, expect.anything());
    expect(payload.message).toContain("草稿");
  });

  it("rejects unknown keys before writing a draft", async () => {
    await expect(handleAdminSiteCopyResource("PATCH", ["admin", "site-copy", "draft"], request("/api/admin/site-copy/draft", "PATCH", {
      changes: {
        "content.document.body": { zh: "not allowed" }
      }
    }), { id: "admin-1", role: "school_admin" })).rejects.toThrow("未知界面文案字段");

    expect(mocks.siteConfigUpsert).not.toHaveBeenCalled();
  });

  it("publishes draft copy and clears the draft row", async () => {
    mocks.siteConfigFindUnique.mockImplementation(async ({ where }) => {
      if (where.key === "site_ui_copy_draft") {
        return { key: where.key, value: { values: { "courses.tab.mine": { zh: "我的课" } } }, updatedAt: new Date() };
      }
      return null;
    });

    const response = await handleAdminSiteCopyResource("POST", ["admin", "site-copy", "publish"], request("/api/admin/site-copy/publish", "POST", {}), {
      id: "admin-1",
      role: "school_admin"
    });
    const payload = await response?.json();

    expect(mocks.siteConfigUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "site_ui_copy_published" }
    }));
    expect(mocks.siteConfigDeleteMany).toHaveBeenCalledWith({ where: { key: "site_ui_copy_draft" } });
    expect(payload.message).toContain("发布");
  });
});
