import { describe, expect, it } from "vitest";
import {
  buildCourseFieldDiffsForCourse,
  buildRetirementCandidates,
  courseCatalogFingerprint,
  courseEffectiveYearFromPayload,
  unresolvedBlockingCourseChanges
} from "@/lib/server/course-import/course-lifecycle";

const existingCourse = {
  code: "AI1003",
  title: "Python Programming",
  description: "Old official description.",
  credits: 3,
  ownerUnit: { type: "faculty", code: "FST" },
  categoryTags: ["Official Course Description Catalogue"],
  sourceRefIds: ["catalog-2025"],
  status: "active",
  source: "bnbu_import",
  catalogEffectiveYear: 2025,
  catalogValidThroughYear: null,
  catalogFingerprint: "old",
  manualOverrideFields: []
};

const catalogPayload = {
  importMode: "course_catalog",
  catalogEffectiveYear: 2026,
  crawlerMeta: { snapshotCompleteness: "near_full", limit: "all", selectedCourses: 2, parsedCourses: 2 }
};

describe("course import lifecycle diff", () => {
  it("uses the course catalog effective year from the payload", () => {
    expect(courseEffectiveYearFromPayload(catalogPayload)).toBe(2026);
  });

  it("does not infer course catalog effective year from semester or admission context", () => {
    expect(courseEffectiveYearFromPayload({
      importMode: "course_catalog",
      semester: { academicYear: 2026 },
      cohortYears: [2025]
    })).toBeNull();
  });

  it("recommends accepting newer course catalog metadata", () => {
    const diffs = buildCourseFieldDiffsForCourse({
      importMode: "course_catalog",
      payload: catalogPayload,
      existing: existingCourse,
      incoming: {
        code: "AI1003",
        title: "Python Programming",
        description: "New official description.",
        credits: 3,
        ownerUnit: { type: "faculty", code: "FST" },
        categoryTags: ["Official Course Description Catalogue"],
        sourceRefIds: ["catalog-2026"]
      }
    });

    expect(diffs).toContainEqual(expect.objectContaining({
      code: "AI1003",
      field: "description",
      existingEffectiveYear: 2025,
      incomingEffectiveYear: 2026,
      recommendation: "accept_incoming",
      blocking: false
    }));
  });

  it("blocks manual override conflicts until an admin chooses a resolution", () => {
    const diffs = buildCourseFieldDiffsForCourse({
      importMode: "course_catalog",
      payload: catalogPayload,
      existing: { ...existingCourse, manualOverrideFields: ["description"] },
      incoming: { ...existingCourse, description: "New official description.", sourceRefIds: ["catalog-2026"] }
    });

    expect(diffs).toContainEqual(expect.objectContaining({
      field: "description",
      hasManualOverride: true,
      recommendation: "manual_review",
      blocking: true
    }));
    expect(unresolvedBlockingCourseChanges({ courseFieldDiffs: diffs, retirementCandidates: [] }, {})).toHaveLength(1);
  });

  it("keeps existing metadata when the incoming catalog year is older", () => {
    const diffs = buildCourseFieldDiffsForCourse({
      importMode: "course_catalog",
      payload: { ...catalogPayload, catalogEffectiveYear: 2024 },
      existing: existingCourse,
      incoming: { ...existingCourse, description: "Older crawl description." }
    });

    expect(diffs).toContainEqual(expect.objectContaining({
      field: "description",
      recommendation: "keep_existing_stale_incoming",
      blocking: false
    }));
  });

  it("blocks same-year conflicting catalog metadata", () => {
    const diffs = buildCourseFieldDiffsForCourse({
      importMode: "course_catalog",
      payload: { ...catalogPayload, catalogEffectiveYear: 2025 },
      existing: existingCourse,
      incoming: { ...existingCourse, description: "Different 2025 description." }
    });

    expect(diffs).toContainEqual(expect.objectContaining({
      field: "description",
      recommendation: "manual_review_same_year",
      blocking: true
    }));
  });

  it("shows handbook metadata differences but recommends keeping catalog metadata", () => {
    const diffs = buildCourseFieldDiffsForCourse({
      importMode: "cohort_programme_handbook",
      payload: { semester: { academicYear: 2026 }, cohortYears: [2025] },
      existing: existingCourse,
      incoming: { ...existingCourse, title: "Python Programming for AI" }
    });

    expect(diffs).toContainEqual(expect.objectContaining({
      field: "title",
      recommendation: "keep_existing_handbook_source",
      blocking: false
    }));
  });

  it("generates retirement candidates for courses missing from a near-full catalog snapshot", () => {
    const candidates = buildRetirementCandidates({
      payload: catalogPayload,
      incomingCodes: ["AI1003"],
      existingCourses: [
        existingCourse,
        { ...existingCourse, code: "COMP3143", title: "Removed Course", catalogEffectiveYear: 2025 }
      ]
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        code: "COMP3143",
        title: "Removed Course",
        recommendation: "review_retirement",
        blocking: true,
        proposedValidThroughYear: 2025
      })
    ]);
  });

  it("uses a stable fingerprint for equivalent course metadata", () => {
    expect(courseCatalogFingerprint({
      code: "AI1003",
      sourceRefIds: ["b", "a"],
      categoryTags: ["x"],
      ownerUnit: { code: "FST", type: "faculty" }
    })).toBe(courseCatalogFingerprint({
      code: "AI1003",
      sourceRefIds: ["a", "b"],
      categoryTags: ["x"],
      ownerUnit: { type: "faculty", code: "FST" }
    }));
  });
});
