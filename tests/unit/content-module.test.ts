import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getActiveAppVersionId: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentDocument: {
      findMany: mocks.findMany
    }
  }
}));

vi.mock("@/lib/app-version", () => ({
  getActiveAppVersionId: mocks.getActiveAppVersionId
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(async () => null)
}));

import { handleContent } from "@/lib/server/api/content-module";

function contentRequest(kind: string) {
  return new NextRequest(`https://teamingapp.org/api/content?kind=${kind}`);
}

describe("public content API", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.getActiveAppVersionId.mockReset();
    mocks.getActiveAppVersionId.mockResolvedValue("active-version");
  });

  it("serves a built-in help document when the content table is not deployed yet", async () => {
    mocks.findMany.mockRejectedValue({ code: "P2021" });

    const response = await handleContent("GET", contentRequest("help"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.documents).toHaveLength(1);
    expect(payload.documents[0].kind).toBe("help");
    expect(payload.documents[0].title).toContain("帮助文档");
  });

  it("serves contact developer as a single fallback document when no document is published", async () => {
    mocks.findMany.mockResolvedValue([]);

    const response = await handleContent("GET", contentRequest("developer_contact"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.documents).toHaveLength(1);
    expect(payload.documents[0].kind).toBe("developer_contact");
    expect(payload.documents[0].children).toEqual([]);
    expect(payload.documents[0].bodyMarkdown).toContain("WeChat");
  });
});
