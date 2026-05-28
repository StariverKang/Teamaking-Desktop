import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  siteConfigFindUnique: vi.fn(),
  siteConfigUpsert: vi.fn(),
  operationLogFindMany: vi.fn(),
  writeAudit: vi.fn(),
  getActiveAppVersionId: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteConfig: {
      findUnique: mocks.siteConfigFindUnique,
      upsert: mocks.siteConfigUpsert
    },
    operationLog: {
      findMany: mocks.operationLogFindMany
    }
  }
}));

vi.mock("@/lib/app-version", () => ({
  getActiveAppVersionId: mocks.getActiveAppVersionId
}));

vi.mock("@/lib/server/services/system-service", () => ({
  writeAudit: mocks.writeAudit,
  toJson: (value: unknown) => JSON.parse(JSON.stringify(value ?? null))
}));

import { handleAdminAiResumeResource } from "@/lib/server/api/admin-resources/ai-resume-resource";

describe("admin AI resume resource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveAppVersionId.mockResolvedValue("app-1");
    mocks.siteConfigFindUnique.mockResolvedValue({
      key: "resume_ai",
      value: {
        enabled: true,
        apiKey: "sk-test-secret",
        model: "gpt-admin",
        inputLimit: 12000
      }
    });
    mocks.siteConfigUpsert.mockImplementation(async ({ update, create }) => ({
      key: "resume_ai",
      value: update?.value ?? create?.value
    }));
    mocks.operationLogFindMany.mockResolvedValue([
      {
        id: "log-1",
        createdAt: new Date("2026-05-28T10:00:00Z"),
        actorUserId: "user-1",
        actorRole: "profile_completed_user",
        actor: { email: "student@mail.bnbu.edu.cn", profile: { displayName: "Student" } },
        action: "profile.resume.ai_analysis",
        targetType: "UserProfile",
        targetId: "profile-1",
        method: "POST",
        path: "/api/uploads",
        status: "success",
        summary: {
          trigger: "resume_upload",
          provider: "openai",
          model: "gpt-admin",
          status: "generated",
          summaryTitle: "内容运营候选人",
          highlightCount: 1,
          inputChars: 800,
          durationMs: 1200,
          apiKeySource: "site_config"
        },
        metadata: {
          analysisResult: {
            summaryTitle: "内容运营候选人",
            summaryBody: "可验证的内容运营和数据复盘能力。",
            highlights: [{ title: "KOL 协作", evidence: "建联10+KOL。", category: "增长运营", keywords: ["KOL"] }]
          }
        }
      }
    ]);
  });

  it("returns masked AI config and serialized resume analysis logs", async () => {
    const response = await handleAdminAiResumeResource("GET", ["admin", "ai-resume"], new NextRequest("http://test.local/api/admin/ai-resume"), {
      id: "admin-1",
      role: "school_admin"
    });
    const body = await response?.json();

    expect(body.config).toMatchObject({
      enabled: true,
      provider: "openai",
      model: "gpt-admin",
      apiKeySource: "site_config",
      apiKeySet: true
    });
    expect(JSON.stringify(body.config)).not.toContain("sk-test-secret");
    expect(body.logs[0]).toMatchObject({
      trigger: "resume_upload",
      summaryTitle: "内容运营候选人",
      analysisResult: expect.objectContaining({ summaryTitle: "内容运营候选人" })
    });
  });

  it("lets only super_admin patch the model and API key without auditing the raw key", async () => {
    await expect(handleAdminAiResumeResource("PATCH", ["admin", "ai-resume", "config"], new NextRequest("http://test.local/api/admin/ai-resume/config", {
      method: "PATCH",
      body: JSON.stringify({ model: "gpt-4.1-mini" })
    }), {
      id: "admin-2",
      role: "school_admin"
    })).rejects.toThrow("只有 super_admin");

    const response = await handleAdminAiResumeResource("PATCH", ["admin", "ai-resume", "config"], new NextRequest("http://test.local/api/admin/ai-resume/config", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: true,
        model: "gpt-4.1-mini",
        apiKey: "sk-new-secret",
        inputLimit: 9000
      })
    }), {
      id: "admin-1",
      role: "super_admin"
    });
    const body = await response?.json();

    expect(mocks.siteConfigUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "resume_ai" },
      update: expect.objectContaining({
        value: expect.objectContaining({
          apiKey: "sk-new-secret",
          model: "gpt-4.1-mini",
          inputLimit: 9000
        })
      })
    }));
    expect(body.config.apiKeyPreview).toBe("sk-...cret");
    expect(JSON.stringify(body)).not.toContain("sk-new-secret");
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      "admin-1",
      "admin.ai_resume.config.patch",
      "SiteConfig",
      "resume_ai",
      expect.objectContaining({ apiKeySet: true }),
      expect.objectContaining({ apiKeySet: true })
    );
    expect(JSON.stringify(mocks.writeAudit.mock.calls[0])).not.toContain("sk-new-secret");
    expect(JSON.stringify(mocks.writeAudit.mock.calls[0])).not.toContain("sk-test-secret");
  });
});
