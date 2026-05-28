import { describe, expect, it } from "vitest";
import { defaultOnboardingGuide, onboardingGuideFromConfig, validateOnboardingGuideConfig } from "@/lib/onboarding-guide";

describe("onboarding guide config", () => {
  it("accepts valid cross-page anchored steps", () => {
    const validation = validateOnboardingGuideConfig({
      version: "custom",
      steps: [
        {
          id: "start",
          route: "/dashboard",
          targetSelector: '[data-onboarding-target="dashboard-profile-health"]',
          placement: "right",
          title: "Dashboard",
          body: "Start here."
        }
      ]
    });

    expect(validation.ok).toBe(true);
    expect(validation.guide).toMatchObject({
      version: "custom",
      steps: [{ id: "start", route: "/dashboard", placement: "right" }]
    });
  });

  it("falls back to default guide for legacy or malformed config", () => {
    expect(onboardingGuideFromConfig({ steps: ["完成 Profile", "加入 Course Board"] })).toEqual(defaultOnboardingGuide);
    expect(onboardingGuideFromConfig(null)).toEqual(defaultOnboardingGuide);
  });

  it("reports missing required fields and keeps the default guide as fallback", () => {
    const validation = validateOnboardingGuideConfig({
      version: "broken",
      steps: [{ route: "/courses", title: "Courses", body: "Missing target selector." }]
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors.join(" ")).toContain("targetSelector");
    expect(validation.guide).toEqual(defaultOnboardingGuide);
  });

  it("normalizes unknown placements without rejecting an otherwise valid step", () => {
    const validation = validateOnboardingGuideConfig({
      steps: [
        {
          route: "/support",
          targetSelector: '[data-onboarding-target="support-ticket"]',
          placement: "diagonal",
          title: "Support",
          body: "Send an actionable ticket."
        }
      ]
    });

    expect(validation.ok).toBe(true);
    expect(validation.guide.steps[0]).toMatchObject({ id: "step-1", placement: "bottom" });
  });
});
