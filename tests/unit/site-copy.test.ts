import { describe, expect, it } from "vitest";
import {
  changedSiteCopyKeys,
  mergeSiteCopyValues,
  normalizeSiteCopyValues,
  siteCopyDefaultValues,
  siteCopyEntries,
  siteCopyText
} from "@/lib/site-copy";

describe("site UI copy registry", () => {
  it("contains stable defaults for field-level user interface copy", () => {
    expect(siteCopyEntries.length).toBeGreaterThan(40);
    expect(siteCopyDefaultValues["landing.cta.demo"]?.zh).toBe("了解TEAMAKING");
    expect(siteCopyDefaultValues["landing.feature.profile.title"]?.zh).toBe("通过作品展示个人工作能力");
    expect(siteCopyDefaultValues["landing.feature.team.title"]?.zh).toBe("基于个人履历与真实水平的课程/赛事学术匹配");
    expect(siteCopyDefaultValues["landing.feature.course.title"]?.zh).toBe("课程内容讨论与共学");
    expect(siteCopyDefaultValues["courses.search.placeholder"]?.zh).toContain("搜索课程代码");
    expect(siteCopyDefaultValues["onboarding.tour.academic-form.title"]?.zh).toContain("基础学业信息");
  });

  it("merges defaults, published copy, and draft copy with locale fallback", () => {
    const merged = mergeSiteCopyValues(
      siteCopyDefaultValues,
      { "courses.page.title": { zh: "课程板" } },
      { "courses.page.title": { en: "Course Hub" } }
    );

    expect(siteCopyText(merged, "courses.page.title", "Course Boards", "zh")).toBe("课程板");
    expect(siteCopyText(merged, "courses.page.title", "Course Boards", "en")).toBe("Course Hub");
    expect(siteCopyText(merged, "courses.page.description", "fallback", "en")).toBeTruthy();
  });

  it("normalizes only registered copy values", () => {
    const normalized = normalizeSiteCopyValues({
      values: {
        "courses.tab.mine": { zh: "我的课", en: "My classes" },
        unknown: { zh: "should drop" },
        "courses.tab.search": { zh: "   " }
      }
    });

    expect(normalized).toEqual({
      "courses.tab.mine": { zh: "我的课", en: "My classes" }
    });
  });

  it("reports keys changed between published and draft views", () => {
    const changed = changedSiteCopyKeys(
      mergeSiteCopyValues(siteCopyDefaultValues, { "courses.tab.mine": { zh: "我的课程" } }),
      mergeSiteCopyValues(siteCopyDefaultValues, { "courses.tab.mine": { zh: "我的课" } })
    );

    expect(changed).toContain("courses.tab.mine");
  });
});
