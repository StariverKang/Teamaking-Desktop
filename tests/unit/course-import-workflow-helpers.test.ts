import { describe, expect, it } from "vitest";
import {
  buildCourseImportBatchSummary,
  importCohortYearsFromPayload,
  payloadHash
} from "@/lib/server/course-import/import-helpers";

function minimalPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "teamaking.bnbu_course_import.v2",
    generatedAt: "2026-05-26T00:00:00.000Z",
    cohortYears: [2024, 2025],
    school: { shortName: "BNBU", name: "Beijing Normal-Hong Kong Baptist University" },
    semester: { code: "2026-Fall", name: "2026 Fall", academicYear: 2026, term: "Fall" },
    sourceRefs: [{ id: "handbook-2025-ai", title: "AI Programme Handbook 2025 Admission", url: "https://example.test/ai.pdf", sourceType: "curriculum_pdf" }],
    faculties: [{ code: "FST", name: "Faculty of Science and Technology" }],
    majors: [{ code: "AI", name: "Artificial Intelligence Programme", facultyCode: "FST" }],
    courses: [{ code: "AI1003", title: "Python Programming", credits: 3 }],
    offerings: [],
    curriculumRules: [
      {
        id: "rule-ai-2025-y1s1-ai1003",
        courseCode: "AI1003",
        semesterCode: "2026-Fall",
        classification: "major_required",
        studentAction: "default_join",
        relativeTermCodes: ["Y1S1"],
        audience: { cohortYears: [2025], entryTerm: "Fall", majorCodes: ["AI"] }
      }
    ],
    ...overrides
  };
}

describe("course import workflow helpers", () => {
  it("extracts cohort years from preview coverage before payload fallback", () => {
    const payload = minimalPayload({ cohortYears: [2023] });
    expect(importCohortYearsFromPayload(payload, { coverage: { cohortYears: [{ key: "2025" }, { key: "2024" }] } })).toEqual([2025, 2024]);
    expect(importCohortYearsFromPayload(payload)).toEqual([2023]);
  });

  it("builds stable summary fields and payload hashes", () => {
    const payload = minimalPayload();
    const summary = buildCourseImportBatchSummary(payload, {
      validation: { ok: true, schemaVersion: "teamaking.bnbu_course_import.v2", semesterCode: "2026-Fall", counts: { faculties: 1, majors: 1, courses: 1, offerings: 0, curriculumRules: 1 }, warnings: [], errors: [] },
      counts: { newCourses: 1, courseBoardsToActivate: 1 }
    });

    expect(payloadHash(payload)).toBe(payloadHash(payload));
    expect(summary).toMatchObject({
      schemaVersion: "teamaking.bnbu_course_import.v2",
      semesterCode: "2026-Fall",
      cohortYears: [2025, 2024],
      counts: { courses: 1, curriculumRules: 1, newCourses: 1, boardsToActivate: 1 }
    });
  });
});
