import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultOnboardingGuide } from "@/lib/onboarding-guide";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  facultyFindMany: vi.fn(),
  majorFindMany: vi.fn(),
  semesterFindMany: vi.fn(),
  siteConfigFindUnique: vi.fn(),
  userProfileUpsert: vi.fn(),
  operationLog: vi.fn()
}));

vi.mock("@/lib/session", () => ({
  clearSessionCookie: vi.fn(),
  getCurrentUser: vi.fn(),
  isAdminRole: (role: string) => ["course_moderator", "school_admin", "super_admin"].includes(role),
  requireUser: mocks.requireUser,
  setDemoSessionCookie: vi.fn(),
  setSessionCookie: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    faculty: { findMany: mocks.facultyFindMany },
    major: { findMany: mocks.majorFindMany },
    semester: { findMany: mocks.semesterFindMany },
    siteConfig: { findUnique: mocks.siteConfigFindUnique },
    userProfile: { upsert: mocks.userProfileUpsert },
    user: { update: vi.fn() }
  }
}));

vi.mock("@/lib/server/services/system-service", () => ({
  operationLog: mocks.operationLog,
  safeStringEqual: (a: string, b: string) => a === b
}));

import { handleOnboarding } from "@/lib/server/api/auth-module";

function request(path = "/api/onboarding") {
  return { nextUrl: { pathname: path } } as any;
}

describe("onboarding API guide support", () => {
  beforeEach(() => {
    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      email: "s123@mail.bnbu.edu.cn",
      schoolId: "school-1",
      role: "verified_user",
      profile: null,
      skills: []
    });
    mocks.facultyFindMany.mockResolvedValue([]);
    mocks.majorFindMany.mockResolvedValue([]);
    mocks.semesterFindMany.mockResolvedValue([]);
    mocks.siteConfigFindUnique.mockResolvedValue({ key: "onboarding_guide", value: defaultOnboardingGuide });
    mocks.userProfileUpsert.mockResolvedValue({ id: "profile-1", userId: "user-1", onboardingTourDismissedAt: null });
    mocks.operationLog.mockResolvedValue(undefined);
  });

  it("returns the configured onboarding guide on GET", async () => {
    const response = await handleOnboarding("GET", ["onboarding"], request());
    const payload = await response.json();

    expect(payload.guide.steps[0]).toMatchObject({
      route: "/onboarding",
      targetSelector: '[data-onboarding-target="academic-form"]'
    });
  });

  it("resets tour dismissal state", async () => {
    const response = await handleOnboarding("POST", ["onboarding", "tour-reset"], request("/api/onboarding/tour-reset"));
    const payload = await response.json();

    expect(payload.message).toContain("已重置");
    expect(mocks.userProfileUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { onboardingTourDismissedAt: null }
    }));
  });
});
