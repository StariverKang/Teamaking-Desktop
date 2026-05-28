import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  storeProfileUpload: vi.fn(),
  parseResumeTextWithAi: vi.fn(),
  operationLog: vi.fn(),
  userProfileUpdate: vi.fn(),
  userFindUniqueOrThrow: vi.fn(),
  resumeBufferFromUrl: vi.fn()
}));

vi.mock("@/lib/session", () => ({
  requireUser: mocks.requireUser,
  isAdminRole: vi.fn(() => false)
}));

vi.mock("@/lib/upload-storage", () => ({
  storeProfileUpload: mocks.storeProfileUpload
}));

vi.mock("@/lib/server/services/resume-ai-service", () => ({
  parseResumeTextWithAi: mocks.parseResumeTextWithAi
}));

vi.mock("@/lib/server/services/system-service", () => ({
  toJson: (value: unknown) => JSON.parse(JSON.stringify(value)),
  operationLog: mocks.operationLog
}));

vi.mock("@/lib/server/services/profile-service", () => ({
  jsonObject: (value: unknown, fallback: Record<string, unknown> = {}) => value && typeof value === "object" && !Array.isArray(value) ? value : fallback,
  portfolioPayload: (body: Record<string, unknown>) => body,
  resumeBufferFromUrl: mocks.resumeBufferFromUrl
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: mocks.userFindUniqueOrThrow
    },
    userProfile: {
      update: mocks.userProfileUpdate
    },
    portfolioItem: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn()
    },
    contactInfo: {
      upsert: vi.fn()
    }
  }
}));

import { handleProfile, handleUploads } from "@/lib/server/api/profile-module";

const analyzedResume = {
  fileName: "resume.txt",
  parser: "text",
  parsedAt: "2026-05-28T00:00:00.000Z",
  summary: "local fallback summary",
  skills: ["content marketing"],
  highlights: ["legacy highlight"],
  sections: {},
  rawText: "用户增长：建联 10+ KOL 合作产出推广视频。",
  analysis: {
    parserVersion: "resume-ai-v1",
    summaryTitle: "内容运营与增长候选人",
    summaryBody: "围绕内容增长、KOL 协作和数据复盘形成可验证成果。",
    keywordGroups: [{ label: "核心能力", keywords: ["content marketing", "KOL"] }],
    highlights: [{
      title: "KOL 增长协作",
      evidence: "建联 10+ KOL 并跟进推广视频发布效果。",
      category: "增长 / 内容运营",
      keywords: ["KOL"]
    }],
    generatedAt: "2026-05-28T00:00:00.000Z",
    provider: "openai",
    model: "gpt-test",
    status: "generated"
  }
};

describe("profile resume API analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      role: "student",
      schoolId: "school-1",
      profile: {
        resumeUrl: "/uploads/user-1/resume.txt",
        resumeFileName: "resume.txt"
      }
    });
    mocks.userFindUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      role: "student",
      profile: {
        id: "profile-1",
        resumeUrl: "/uploads/user-1/resume.txt",
        resumeFileName: "resume.txt"
      }
    });
    mocks.storeProfileUpload.mockResolvedValue({
      fileUrl: "/uploads/user-1/resume.txt",
      storageKey: "profile/user-1/resume.txt",
      storageMode: "local",
      storageProvider: "local",
      objectKey: "profile/user-1/resume.txt"
    });
    mocks.parseResumeTextWithAi.mockResolvedValue(analyzedResume);
    mocks.resumeBufferFromUrl.mockResolvedValue(Buffer.from(analyzedResume.rawText));
    mocks.userProfileUpdate.mockImplementation(async ({ data }) => ({ resumeParsedData: data.resumeParsedData }));
  });

  it("runs AI analysis for resume uploads without blocking the upload response", async () => {
    const formData = new FormData();
    formData.set("purpose", "resume");
    formData.set("file", new File([analyzedResume.rawText], "resume.txt", { type: "text/plain" }));

    const response = await handleUploads("POST", new NextRequest("http://test.local/api/uploads", {
      method: "POST",
      body: formData
    }));
    const body = await response.json();

    expect(mocks.parseResumeTextWithAi).toHaveBeenCalledWith(expect.stringContaining("KOL"), "resume.txt", expect.objectContaining({
      actorUserId: "user-1",
      trigger: "resume_upload"
    }));
    expect(body.upload.resumeParsedData.analysis).toMatchObject({
      parserVersion: "resume-ai-v1",
      provider: "openai",
      status: "generated"
    });
  });

  it("logs only resume analysis metadata when reparsing an existing resume", async () => {
    const response = await handleProfile("POST", ["profile", "me", "reparse-resume"], new NextRequest("http://test.local/api/profile/me/reparse-resume", {
      method: "POST"
    }));
    const body = await response.json();

    expect(body.resumeParsedData.analysis.highlights).toHaveLength(1);
    expect(mocks.operationLog).toHaveBeenCalledTimes(1);
    const summary = mocks.operationLog.mock.calls[0]?.[0]?.summary;
    expect(summary).toMatchObject({
      resumeFileName: "resume.txt",
      analysis: {
        provider: "openai",
        model: "gpt-test",
        status: "generated",
        highlightCount: 1
      }
    });
    expect(JSON.stringify(summary)).not.toContain("建联 10+ KOL");
    expect(JSON.stringify(summary)).not.toContain(analyzedResume.rawText);
  });
});
