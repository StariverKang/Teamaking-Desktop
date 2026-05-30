import { getActiveAppVersionId } from "@/lib/app-version";

import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { validateBnbuCourseImportPayload } from "@/lib/bnbu-course-import";
import { isPlainRecord, numberValue, records, textValue, toJson } from "@/lib/server/json-utils";
import { writeImportArtifact } from "@/lib/server/storage/json-files";
import { buildCourseImportBatchSummary, importCohortYearsFromPayload, payloadHash } from "@/lib/server/course-import/import-helpers";
import { courseCatalogFingerprint, courseEffectiveYearFromPayload } from "@/lib/server/course-import/course-lifecycle";

export function datasetRowId(row: Record<string, unknown>, fallback: string) {
  return textValue(row.id) || textValue(row.code) || fallback;
}

export async function createCourseImportDataset(input: {
  payload: Record<string, unknown>;
  name: string;
  adminUserId: string;
  schoolId?: string;
  preview: any;
}) {
  const validation = input.preview.validation ?? validateBnbuCourseImportPayload(input.payload);
  const summary = buildCourseImportBatchSummary(input.payload, input.preview);
  const cohortYears = importCohortYearsFromPayload(input.payload, input.preview);
  const hash = payloadHash(input.payload);
  const artifact = await writeImportArtifact(input.payload, input.name);
  const appVersionId = await getActiveAppVersionId();
  const sourceRefs = records(input.payload.sourceRefs);
  const faculties = records(input.payload.faculties);
  const majors = records(input.payload.majors);
  const courses = records(input.payload.courses);
  const curriculumRules = records(input.payload.curriculumRules);
  const offerings = records(input.payload.offerings);

  return prisma.courseImportDataset.create({
    data: {
      appVersionId,
      schoolId: input.schoolId,
      name: input.name,
      schemaVersion: validation.schemaVersion ?? textValue(input.payload.schemaVersion) ?? "teamaking.bnbu_course_import.v2",
      semesterCode: validation.semesterCode,
      cohortYears: toJson(cohortYears),
      sourceLabel: summary.sourceLabel,
      payloadHash: hash,
      status: "validated",
      summary: toJson(summary),
      validationSummary: toJson({ ...validation, preview: input.preview }),
      originalFileName: artifact.fileName,
      originalStorageKey: artifact.storageKey,
      originalSize: artifact.size,
      createdByUserId: input.adminUserId,
      sourceRefs: {
        create: sourceRefs.map((row, index) => ({
          externalId: datasetRowId(row, `source-${index + 1}`),
          title: textValue(row.title),
          url: textValue(row.url),
          sourceType: textValue(row.sourceType),
          raw: toJson(row)
        }))
      },
      faculties: {
        create: faculties.map((row) => ({
          code: textValue(row.code),
          name: textValue(row.name),
          raw: toJson(row)
        })).filter((row) => row.code)
      },
      majors: {
        create: majors.map((row) => ({
          code: textValue(row.code),
          name: textValue(row.name),
          facultyCode: textValue(row.facultyCode),
          degreeType: textValue(row.degreeType),
          raw: toJson(row)
        })).filter((row) => row.code)
      },
      courses: {
        create: courses.map((row) => ({
          code: textValue(row.code),
          title: textValue(row.title),
          description: textValue(row.description),
          credits: numberValue(row.credits),
          categoryTags: toJson(Array.isArray(row.categoryTags) ? row.categoryTags : []),
          ownerUnit: toJson(isPlainRecord(row.ownerUnit) ? row.ownerUnit : {}),
          sourceRefIds: toJson(Array.isArray(row.sourceRefIds) ? row.sourceRefIds : []),
          effectiveYear: courseEffectiveYearFromPayload(input.payload, row),
          fingerprint: textValue(row.fingerprint) || courseCatalogFingerprint(row),
          raw: toJson(row)
        })).filter((row) => row.code)
      },
      rules: {
        create: curriculumRules.map((row, index) => ({
          externalId: datasetRowId(row, `rule-${index + 1}`),
          courseCode: textValue(row.courseCode),
          classification: textValue(row.classification),
          studentAction: textValue(row.studentAction),
          audience: toJson(isPlainRecord(row.audience) ? row.audience : {}),
          relativeTermCodes: toJson(Array.isArray(row.relativeTermCodes) ? row.relativeTermCodes : []),
          sourceRefIds: toJson(Array.isArray(row.sourceRefIds) ? row.sourceRefIds : []),
          raw: toJson(row)
        })).filter((row) => row.externalId && row.courseCode)
      },
      offerings: {
        create: offerings.map((row, index) => ({
          externalId: datasetRowId(row, `offering-${index + 1}`),
          courseCode: textValue(row.courseCode),
          semesterCode: textValue(row.semesterCode),
          sections: toJson(Array.isArray(row.sections) ? row.sections : []),
          raw: toJson(row)
        })).filter((row) => row.externalId && row.courseCode)
      }
    },
    include: {
      school: true,
      sourceRefs: true,
      faculties: true,
      majors: true,
      courses: true,
      rules: true,
      offerings: true
    }
  });
}

export async function payloadFromDataset(datasetId: string) {
  const dataset = await prisma.courseImportDataset.findUnique({
    where: { id: datasetId },
    include: {
      school: { include: { domains: true } },
      sourceRefs: true,
      faculties: true,
      majors: true,
      courses: true,
      rules: true,
      offerings: true
    }
  });
  if (!dataset) throw new ApiError(404, "找不到这个导入数据集。");
  const summary = isPlainRecord(dataset.summary) ? dataset.summary : {};
  const importMode = textValue(summary.importMode) || (dataset.rules.length || dataset.offerings.length ? "cohort_programme_handbook" : "course_catalog");
  const catalogEffectiveYear = numberValue(summary.catalogEffectiveYear) ?? dataset.courses.map((row) => numberValue(row.effectiveYear)).find((value) => value !== undefined);
  const payload: Record<string, unknown> = {
    schemaVersion: dataset.schemaVersion,
    generatedAt: dataset.createdAt.toISOString(),
    importMode,
    ...(catalogEffectiveYear ? { catalogEffectiveYear } : {}),
    school: dataset.school ? { shortName: dataset.school.shortName, name: dataset.school.name, emailDomain: dataset.school.domains?.[0]?.domain } : { shortName: "BNBU" },
    sourceRefs: dataset.sourceRefs.map((row) => row.raw),
    faculties: dataset.faculties.map((row) => row.raw),
    majors: dataset.majors.map((row) => row.raw),
    courses: dataset.courses.map((row) => row.raw),
    offerings: dataset.offerings.map((row) => row.raw),
    curriculumRules: dataset.rules.map((row) => row.raw)
  };
  if (importMode !== "course_catalog") {
    payload.semester = {
      code: dataset.semesterCode,
      name: dataset.semesterCode,
      academicYear: Number(String(dataset.semesterCode ?? "").match(/20\d{2}/)?.[0] ?? new Date().getFullYear()),
      term: String(dataset.semesterCode ?? "").includes("Fall") ? "Fall" : "Spring",
      isCurrentCandidate: false
    };
  }
  return payload;
}
