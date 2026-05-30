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
  it("accepts school-wide course catalog payloads without semester or admission rules", () => {
    const validation = validateBnbuCourseImportPayload({
      schemaVersion: "teamaking.bnbu_course_import.v2",
      importMode: "course_catalog",
      catalogEffectiveYear: 2026,
      school: { shortName: "BNBU", name: "Beijing Normal-Hong Kong Baptist University" },
      sourceRefs: [{ id: "catalog-2026", title: "Course Descriptions 2026", url: "https://example.test/catalog.pdf", sourceType: "course_catalog_pdf" }],
      faculties: [],
      majors: [],
      courses: [{ code: "AI1003", title: "Python Programming", credits: 3, sourceRefIds: ["catalog-2026"] }],
      offerings: [],
      curriculumRules: []
    });

    expect(validation.ok).toBe(true);
    expect(validation.semesterCode).toBeUndefined();
    expect(validation.errors).not.toContain("semester is required");
    expect(validation.errors).not.toContain("faculties must contain at least one faculty");
    expect(validation.warnings).not.toContain("curriculumRules is empty; courses will be searchable only if imported manually later");
  });

  it("rejects major or term placement inside course catalog imports", () => {
    const validation = validateBnbuCourseImportPayload({
      schemaVersion: "teamaking.bnbu_course_import.v2",
      importMode: "course_catalog",
      catalogEffectiveYear: 2026,
      school: { shortName: "BNBU", name: "Beijing Normal-Hong Kong Baptist University" },
      semester: { code: "2026-Fall", name: "2026 Fall", academicYear: 2026, term: "Fall", isCurrentCandidate: false },
      sourceRefs: [{ id: "catalog-2026", title: "Course Descriptions 2026", url: "https://example.test/catalog.pdf", sourceType: "course_catalog_pdf" }],
      faculties: [{ code: "FST", name: "Faculty of Science and Technology" }],
      majors: [{ code: "AI", name: "Artificial Intelligence Programme", facultyCode: "FST" }],
      courses: [{ code: "AI1003", title: "Python Programming", credits: 3, sourceRefIds: ["catalog-2026"] }],
      offerings: [{ courseCode: "AI1003", semesterCode: "2026-Fall", sections: ["Default"], sourceRefIds: ["catalog-2026"] }],
      curriculumRules: [{
        id: "catalog-ai1003-ai-y1",
        courseCode: "AI1003",
        semesterCode: "2026-Fall",
        classification: "major_required",
        studentAction: "default_join",
        relativeTermCodes: ["Y1S1"],
        audience: { cohortYears: [2026], majorCodes: ["AI"] },
        sourceRefIds: ["catalog-2026"]
      }]
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("course_catalog must not contain semester metadata; course catalog rows are school-wide and not tied to an academic term");
    expect(validation.errors).toContain("course_catalog must not contain majors; major-specific placement belongs in programme handbook imports");
    expect(validation.errors).toContain("course_catalog must not contain offerings; real timetable evidence belongs in a semester offering import");
    expect(validation.errors).toContain("course_catalog must not contain curriculumRules; admission-year recommendations belong in programme handbook imports");
  });

  it("requires a catalog effective year for course catalog lifecycle review", () => {
    const validation = validateBnbuCourseImportPayload({
      schemaVersion: "teamaking.bnbu_course_import.v2",
      importMode: "course_catalog",
      school: { shortName: "BNBU", name: "Beijing Normal-Hong Kong Baptist University" },
      sourceRefs: [{ id: "catalog", title: "Course Descriptions", url: "https://example.test/catalog.pdf", sourceType: "course_catalog_pdf" }],
      courses: [{ code: "AI1003", title: "Python Programming", credits: 3, sourceRefIds: ["catalog"] }]
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("course_catalog requires catalogEffectiveYear for catalog lifecycle review");
  });

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
      activateAdmissionSemester: async () => {
        throw new Error("not used");
      },
      rejectBatch: async () => {
        throw new Error("not used");
      },
      clearAdmissionImportBatch: async () => {
        throw new Error("not used");
      },
      clearAllAdmissionImports: async () => {
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

  it("routes admission cleanup actions through the admin module", async () => {
    const calls: string[] = [];
    const workflow: CourseImportWorkflow = {
      validatePayload: async () => {
        throw new Error("not used");
      },
      listBatches: async () => ({}),
      createBatchFromPayload: async () => {
        throw new Error("not used");
      },
      approveBatch: async () => {
        throw new Error("not used");
      },
      activateAdmissionSemester: async (input: Record<string, unknown>) => {
        calls.push(`activate:${input.academicYear}-${input.term}`);
        return { semester: { code: `${input.academicYear}-${input.term}` }, totals: { boardsActivatedOrReused: 1 } };
      },
      rejectBatch: async () => {
        throw new Error("not used");
      },
      clearAdmissionImportBatch: async (batchId: string) => {
        calls.push(`batch:${batchId}`);
        return { scope: "batch", rulesDeleted: 2 };
      },
      clearAllAdmissionImports: async () => {
        calls.push("all");
        return { scope: "all", rulesDeleted: 9 };
      },
      downloadDataset: async () => {
        throw new Error("not used");
      }
    };
    const handler = createCourseImportAdminModule({ workflow });
    const context = (path: string[]) => ({
      method: "POST",
      path,
      request: {} as any,
      body: async () => ({}),
      requireUser: async () => ({ id: "admin" }),
      requireAdmin: async () => ({ id: "admin", role: "super_admin" }),
      activeAppVersionId: async () => "version_1"
    });

    await expect(handler(context(["admin", "course-imports", "batch_1", "clear-admission"])).then((response) => response.json()))
      .resolves.toMatchObject({ result: { scope: "batch", rulesDeleted: 2 } });
    await expect(handler(context(["admin", "course-imports", "clear-admission"])).then((response) => response.json()))
      .resolves.toMatchObject({ result: { scope: "all", rulesDeleted: 9 } });
    await expect(handler({
      ...context(["admin", "course-imports", "activate-semester"]),
      body: async () => ({ academicYear: "2026", term: "Fall" })
    }).then((response) => response.json()))
      .resolves.toMatchObject({ result: { semester: { code: "2026-Fall" }, totals: { boardsActivatedOrReused: 1 } } });
    expect(calls).toEqual(["batch:batch_1", "all", "activate:2026-Fall"]);
  });

  it("passes course approval decisions to the approve workflow", async () => {
    const calls: any[] = [];
    const workflow: CourseImportWorkflow = {
      validatePayload: async () => {
        throw new Error("not used");
      },
      listBatches: async () => ({}),
      createBatchFromPayload: async () => {
        throw new Error("not used");
      },
      approveBatch: async (batchId: string, admin: any, approvalDecisions?: Record<string, unknown>) => {
        calls.push({ batchId, adminId: admin.id, approvalDecisions });
        return { importBatch: { id: batchId, status: "approved" }, result: { retiredCourseCount: 1 } };
      },
      activateAdmissionSemester: async () => {
        throw new Error("not used");
      },
      rejectBatch: async () => {
        throw new Error("not used");
      },
      clearAdmissionImportBatch: async () => {
        throw new Error("not used");
      },
      clearAllAdmissionImports: async () => {
        throw new Error("not used");
      },
      downloadDataset: async () => {
        throw new Error("not used");
      }
    };
    const handler = createCourseImportAdminModule({ workflow });
    const approvalDecisions = {
      courseFields: { AI1003: { description: { action: "accept_incoming" } } },
      retirements: { COMP3143: { action: "retire", validThroughYear: 2025 } }
    };

    await expect(handler({
      method: "POST",
      path: ["admin", "course-imports", "batch_1", "approve"],
      request: {} as any,
      body: async () => ({ approvalDecisions }),
      requireUser: async () => ({ id: "admin" }),
      requireAdmin: async () => ({ id: "admin", role: "super_admin" }),
      activeAppVersionId: async () => "version_1"
    }).then((response) => response.json())).resolves.toMatchObject({
      importBatch: { id: "batch_1", status: "approved" },
      result: { retiredCourseCount: 1 }
    });
    expect(calls).toEqual([{ batchId: "batch_1", adminId: "admin", approvalDecisions }]);
  });
});
