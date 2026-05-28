import { createHash } from "node:crypto";
import { validateBnbuCourseImportPayload } from "@/lib/bnbu-course-import";
import { isPlainRecord, numberValues, records, textValue, textValues } from "@/lib/server/json-utils";
import { audienceForRule, cohortYearsForRule } from "@/lib/server/course-import/curriculum-matching";

export { audienceForRule, cohortYearsForRule };

export function firstItems<T>(items: T[], limit = 8) {
  return items.slice(0, limit);
}

export function countRows<T extends Record<string, unknown>>(rows: T[], keyOf: (row: T) => string | string[] | undefined) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const keys = keyOf(row);
    const normalizedKeys = Array.isArray(keys) ? keys : keys ? [keys] : ["Unspecified"];
    normalizedKeys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  });
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function payloadHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

export function uniqueSortedNumbers(values: number[]) {
  return [...new Set<number>(values)].sort((a, b) => b - a);
}

export function importCohortYearsFromPayload(payload: Record<string, unknown>, preview?: any) {
  const fromCoverage = Array.isArray(preview?.coverage?.cohortYears)
    ? preview.coverage.cohortYears.map((item: any) => Number(item.key)).filter((item: number) => Number.isFinite(item))
    : [];
  if (fromCoverage.length) return uniqueSortedNumbers(fromCoverage);
  const topLevel = numberValues(payload.cohortYears);
  if (topLevel.length) return uniqueSortedNumbers(topLevel);
  return uniqueSortedNumbers(records(payload.curriculumRules).flatMap(cohortYearsForRule));
}

export function sourceLabelForImport(payload: Record<string, unknown>, cohortYears: number[]) {
  const firstSource = records(payload.sourceRefs)[0];
  if (firstSource) return textValue(firstSource.title) || textValue(firstSource.url) || `${cohortYears.join(", ") || "Unknown"} admission import`;
  return `${cohortYears.join(", ") || "Unknown"} admission import`;
}

export function buildCourseImportBatchSummary(payload: Record<string, unknown>, preview: any) {
  const validation = preview?.validation ?? validateBnbuCourseImportPayload(payload);
  const counts = preview?.counts ?? {};
  const cohortYears = importCohortYearsFromPayload(payload, preview);
  const semesterInput = isPlainRecord(payload.semester) ? payload.semester : {};
  const sourceLabel = sourceLabelForImport(payload, cohortYears);
  return {
    schemaVersion: validation.schemaVersion ?? textValue(payload.schemaVersion),
    semesterCode: validation.semesterCode ?? textValue(semesterInput.code),
    semesterLabel: textValue(semesterInput.name),
    cohortYears,
    importMode: preview?.importMode ?? (records(payload.offerings).length ? "combined_with_offerings" : "cohort_handbook"),
    sourceLabel,
    generatedAt: textValue(payload.generatedAt),
    counts: {
      faculties: validation.counts?.faculties ?? records(payload.faculties).length,
      majors: validation.counts?.majors ?? records(payload.majors).length,
      courses: validation.counts?.courses ?? records(payload.courses).length,
      offerings: validation.counts?.offerings ?? records(payload.offerings).length,
      curriculumRules: validation.counts?.curriculumRules ?? records(payload.curriculumRules).length,
      warnings: validation.warnings?.length ?? 0,
      errors: validation.errors?.length ?? 0,
      newCourses: counts.newCourses ?? 0,
      updatedCourses: counts.updatedCourses ?? 0,
      newRules: counts.newRules ?? 0,
      changedRules: counts.changedRules ?? 0,
      retainedRules: counts.retainedRules ?? 0,
      rulesToDeactivate: counts.rulesToDeactivate ?? 0,
      boardsToActivate: counts.courseBoardsToActivate ?? 0,
      defaultJoinRulesDeferredToSemesterActivation: counts.defaultJoinRulesDeferredToSemesterActivation ?? 0,
      courseFieldDiffs: counts.courseFieldDiffs ?? 0,
      retirementCandidates: counts.retirementCandidates ?? 0,
      blockingCourseChanges: counts.blockingCourseChanges ?? 0
    },
    warnings: validation.warnings ?? [],
    errors: validation.errors ?? []
  };
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function summarizeCourseImportBatch(batch: any, includePayload = false) {
  const summary = isPlainRecord(batch.summary) ? batch.summary : {};
  const fallbackValidation = isPlainRecord(batch.validationSummary) ? batch.validationSummary : {};
  const fallbackPreview = isPlainRecord(fallbackValidation.preview) ? fallbackValidation.preview : {};
  const fallbackCoverage = isPlainRecord(fallbackPreview.coverage) ? fallbackPreview.coverage : {};
  const fallbackPayload = isPlainRecord(batch.payload) ? batch.payload : {};
  const inferredPayloadCohorts = Object.keys(fallbackPayload).length ? importCohortYearsFromPayload(fallbackPayload, fallbackPreview) : [];
  const cohortYears = numberValues(batch.cohortYears).length
    ? numberValues(batch.cohortYears)
    : numberValues(summary.cohortYears).length
      ? numberValues(summary.cohortYears)
      : numberValues(jsonArray(fallbackCoverage.cohortYears).map((item) => (isPlainRecord(item) ? item.key : item))).length
        ? numberValues(jsonArray(fallbackCoverage.cohortYears).map((item) => (isPlainRecord(item) ? item.key : item)))
        : inferredPayloadCohorts;
  const counts = isPlainRecord(summary.counts) ? summary.counts : {};
  const fallbackCounts = isPlainRecord(fallbackValidation.counts) ? fallbackValidation.counts : {};
  const fallbackPreviewCounts = isPlainRecord(fallbackPreview.counts) ? fallbackPreview.counts : {};
  const summarized = {
    id: batch.id,
    name: batch.name || batch.dataset?.name,
    datasetId: batch.datasetId,
    dataset: batch.dataset
      ? {
          id: batch.dataset.id,
          name: batch.dataset.name,
          status: batch.dataset.status,
          originalFileName: batch.dataset.originalFileName,
          originalSize: batch.dataset.originalSize,
          createdAt: batch.dataset.createdAt,
          downloadUrl: `/api/admin/course-import-datasets/${batch.dataset.id}/download`
        }
      : null,
    schoolId: batch.schoolId,
    school: batch.school,
    schemaVersion: batch.schemaVersion,
    semesterCode: batch.semesterCode,
    cohortYears,
    payloadHash: batch.payloadHash,
    sourceLabel:
      batch.sourceLabel ||
      textValue(batch.dataset?.sourceLabel) ||
      textValue(summary.sourceLabel) ||
      (Object.keys(fallbackPayload).length ? sourceLabelForImport(fallbackPayload, cohortYears) : `${cohortYears.join(", ") || "Unknown"} admission import`),
    status: batch.status,
    summary: {
      ...summary,
      cohortYears,
      counts: {
        faculties: Number(counts.faculties ?? fallbackCounts.faculties ?? 0),
        majors: Number(counts.majors ?? fallbackCounts.majors ?? 0),
        courses: Number(counts.courses ?? fallbackCounts.courses ?? 0),
        offerings: Number(counts.offerings ?? fallbackCounts.offerings ?? 0),
        curriculumRules: Number(counts.curriculumRules ?? fallbackCounts.curriculumRules ?? 0),
        warnings: Number(counts.warnings ?? jsonArray(fallbackValidation.warnings).length),
        errors: Number(counts.errors ?? jsonArray(fallbackValidation.errors).length),
        newCourses: Number(counts.newCourses ?? fallbackPreviewCounts.newCourses ?? 0),
        updatedCourses: Number(counts.updatedCourses ?? fallbackPreviewCounts.updatedCourses ?? 0),
        newRules: Number(counts.newRules ?? fallbackPreviewCounts.newRules ?? 0),
        changedRules: Number(counts.changedRules ?? fallbackPreviewCounts.changedRules ?? 0),
        retainedRules: Number(counts.retainedRules ?? fallbackPreviewCounts.retainedRules ?? 0),
        rulesToDeactivate: Number(counts.rulesToDeactivate ?? fallbackPreviewCounts.rulesToDeactivate ?? 0),
        boardsToActivate: Number(counts.boardsToActivate ?? fallbackPreviewCounts.courseBoardsToActivate ?? 0),
        defaultJoinRulesDeferredToSemesterActivation: Number(counts.defaultJoinRulesDeferredToSemesterActivation ?? fallbackPreviewCounts.defaultJoinRulesDeferredToSemesterActivation ?? 0),
        courseFieldDiffs: Number(counts.courseFieldDiffs ?? fallbackPreviewCounts.courseFieldDiffs ?? 0),
        retirementCandidates: Number(counts.retirementCandidates ?? fallbackPreviewCounts.retirementCandidates ?? 0),
        blockingCourseChanges: Number(counts.blockingCourseChanges ?? fallbackPreviewCounts.blockingCourseChanges ?? 0)
      }
    },
    approvedByUserId: batch.approvedByUserId,
    approvedAt: batch.approvedAt,
    rejectedByUserId: batch.rejectedByUserId,
    rejectedAt: batch.rejectedAt,
    adminNote: batch.adminNote,
    approvalDecisions: isPlainRecord(batch.approvalDecisions) ? batch.approvalDecisions : {},
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt
  };
  return includePayload ? { ...summarized, payload: batch.payload, validationSummary: batch.validationSummary } : summarized;
}

export function hasOverlappingNumber(values: number[], candidates: number[]) {
  const candidateSet = new Set(candidates);
  return values.some((value) => candidateSet.has(value));
}

export function mergeUniqueTextValues(...values: unknown[]) {
  return [...new Set(values.flatMap((value) => textValues(value)))];
}
