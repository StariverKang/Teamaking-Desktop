import { describe, expect, it } from "vitest";
import { validateBnbuCourseImportPayload } from "@/lib/bnbu-course-import";
import { ERROR_CODES } from "@/lib/error-codes";
import { ApiError } from "@/lib/http";
import { createCourseImportAdminModule } from "@/lib/server/course-import/admin-module";
import { courseImportPayloadFromBody } from "@/lib/server/course-import/payload";
import type { CourseImportWorkflow } from "@/lib/server/course-import/workflow";

function baseV2Payload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "teamaking.bnbu_course_import.v2",
    school: { shortName: "BNBU", name: "Beijing Normal-Hong Kong Baptist University" },
    semester: { code: "2026-Fall", name: "2026 Fall", academicYear: 2026, term: "Fall", isCurrentCandidate: false },
    sourceRefs: [{ id: "handbook-2025-ai", title: "AI Programme Handbook 2025 Admission", url: "https://example.test/ai.pdf", sourceType: "curriculum_pdf" }],
    faculties: [{ code: "FST", name: "Faculty of Science and Technology" }],
    majors: [{ code: "AI", name: "Artificial Intelligence Programme", facultyCode: "FST" }],
    courses: [{ code: "AI1003", title: "Python Programming", credits: 3, ownerUnit: { type: "faculty", code: "FST", name: "Faculty of Science and Technology" }, sourceRefIds: ["handbook-2025-ai"] }],
    offerings: [],
    curriculumRules: [
      {
        id: "rule-ai-2025-y1s1-ai1003",
        courseCode: "AI1003",
        semesterCode: "2026-Fall",
        classification: "major_required",
        studentAction: "default_join",
        relativeTermCodes: ["Y1S1"],
        audience: { cohortYears: [2025], entryTerm: "Fall", majorCodes: ["AI"] },
        sourceRefIds: ["handbook-2025-ai"]
      }
    ],
    ...overrides
  };
}

describe("course import payload parsing", () => {
  it("accepts a direct JSON string payload", () => {
    const payload = baseV2Payload();
    expect(courseImportPayloadFromBody({ payload: JSON.stringify(payload) })).toEqual(payload);
  });

  it("unwraps a crawler bundle with exactly one importable file", () => {
    const payload = baseV2Payload();
    const bundle = { job: { id: "job-one" }, files: [{ name: "bnbu-2025-admission-handbook.teamaking.json", payload }] };
    expect(courseImportPayloadFromBody({ payload: bundle })).toEqual(payload);
  });

  it("rejects a crawler bundle with multiple importable files", () => {
    const payload = baseV2Payload();
    const bundle = {
      job: { id: "job-many" },
      files: [
        { name: "bnbu-2024-admission-handbook.teamaking.json", payload },
        { name: "bnbu-2025-admission-handbook.teamaking.json", payload }
      ]
    };
    expect(() => courseImportPayloadFromBody({ payload: bundle })).toThrow(ApiError);
    try {
      courseImportPayloadFromBody({ payload: bundle });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).errorCode).toBe(ERROR_CODES.COURSE_IMPORT_INVALID_JSON);
      expect((error as ApiError).metadata).toMatchObject({ kind: "crawler_output_bundle", fileCount: 2 });
    }
  });
});

describe("BNBU v2 handbook import validation", () => {
  it("allows cohort curriculum payloads with no concrete offerings", () => {
    const validation = validateBnbuCourseImportPayload(baseV2Payload());
    expect(validation.ok).toBe(true);
    expect(validation.counts.offerings).toBe(0);
    expect(validation.errors).not.toContain("offerings must contain at least one offering");
  });

  it("requires relative terms or grades for v2 major-required default joins", () => {
    const invalid = baseV2Payload({
      curriculumRules: [
        {
          id: "rule-ai-2025-ai1003",
          courseCode: "AI1003",
          semesterCode: "2026-Fall",
          classification: "major_required",
          studentAction: "default_join",
          audience: { cohortYears: [2025], entryTerm: "Fall", majorCodes: ["AI"] },
          sourceRefIds: ["handbook-2025-ai"]
        }
      ]
    });
    const validation = validateBnbuCourseImportPayload(invalid);
    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("curriculumRules[0] major_required default_join rule must include relativeTermCodes or grades");
  });
});

describe("course import admin module", () => {
  it("validates payloads through the admin module response shape", async () => {
    const payload = baseV2Payload();
    const workflow: CourseImportWorkflow = {
      validatePayload: async (incoming: Record<string, unknown>) => ({
        validation: { ok: true, schemaVersion: incoming.schemaVersion },
        preview: { counts: { courses: 1 } }
      }),
      listBatches: async () => ({}),
      createBatchFromPayload: async () => {
        throw new Error("not used");
      },
      approveBatch: async () => {
        throw new Error("not used");
      },
      rejectBatch: async () => {
        throw new Error("not used");
      },
      downloadDataset: async () => {
        throw new Error("not used");
      }
    };
    const handler = createCourseImportAdminModule({
      workflow
    });

    const response = await handler({
      method: "POST",
      path: ["admin", "course-imports", "validate"],
      request: {} as any,
      body: async () => ({ payload }),
      requireUser: async () => ({ id: "admin" }),
      requireAdmin: async () => ({ id: "admin", role: "super_admin" }),
      activeAppVersionId: async () => "version_1"
    });

    await expect(response.json()).resolves.toMatchObject({
      validation: { ok: true, schemaVersion: "teamaking.bnbu_course_import.v2" },
      preview: { counts: { courses: 1 } }
    });
  });
});
