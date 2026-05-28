import { isPlainRecord, numberValue, records, textValue, textValues } from "@/lib/server/json-utils";

export const courseLifecycleFields = ["title", "description", "credits", "ownerUnit", "categoryTags", "sourceRefIds", "status"] as const;

export type CourseLifecycleField = (typeof courseLifecycleFields)[number];
export type CourseFieldRecommendation =
  | "accept_incoming"
  | "merge_values"
  | "keep_existing_stale_incoming"
  | "keep_existing_handbook_source"
  | "manual_review"
  | "manual_review_same_year";
export type CourseResolutionAction = "accept_incoming" | "keep_existing" | "edit_value" | "merge_values";
export type RetirementResolutionAction = "retire" | "keep";

export type CourseApprovalDecisions = {
  courseFields?: Record<string, Partial<Record<CourseLifecycleField, { action?: CourseResolutionAction; value?: unknown }>>>;
  retirements?: Record<string, { action?: RetirementResolutionAction; validThroughYear?: number }>;
};

export type CourseFieldDiff = {
  code: string;
  title: string;
  field: CourseLifecycleField;
  existingValue: unknown;
  incomingValue: unknown;
  existingEffectiveYear: number | null;
  incomingEffectiveYear: number | null;
  hasManualOverride: boolean;
  recommendation: CourseFieldRecommendation;
  blocking: boolean;
  reason: string;
};

export type RetirementCandidate = {
  code: string;
  title: string;
  status: string;
  existingEffectiveYear: number | null;
  existingValidThroughYear: number | null;
  incomingEffectiveYear: number | null;
  proposedValidThroughYear: number | null;
  recommendation: "review_retirement";
  blocking: boolean;
  reason: string;
};

function normalizedStringArray(value: unknown) {
  return [...new Set(textValues(value))].sort((a, b) => a.localeCompare(b));
}

function sortedRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedRecord);
  if (!isPlainRecord(value)) return value ?? null;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedRecord(value[key])]));
}

function stableValue(value: unknown) {
  return JSON.stringify(sortedRecord(value));
}

function normalizedFieldValue(course: Record<string, unknown>, field: CourseLifecycleField, existing = false) {
  if (field === "title") return textValue(course.title);
  if (field === "description") return textValue(course.description);
  if (field === "credits") return numberValue(course.credits) ?? null;
  if (field === "ownerUnit") return sortedRecord(isPlainRecord(course.ownerUnit) ? course.ownerUnit : {});
  if (field === "categoryTags") return normalizedStringArray(course.categoryTags);
  if (field === "sourceRefIds") return normalizedStringArray(course.sourceRefIds);
  if (field === "status") return textValue(course.status) || (existing ? "active" : "active");
  return null;
}

export function courseCatalogFingerprint(course: Record<string, unknown>) {
  const values = Object.fromEntries(
    courseLifecycleFields
      .filter((field) => field !== "status")
      .map((field) => [field, normalizedFieldValue(course, field)])
  );
  return stableValue(values);
}

export function courseEffectiveYearFromPayload(payload: Record<string, unknown>, course?: Record<string, unknown>) {
  const explicitCourseYear = course ? numberValue(course.effectiveYear) : undefined;
  if (explicitCourseYear) return explicitCourseYear;
  const explicitPayloadYear = numberValue(payload.catalogEffectiveYear) ?? numberValue(isPlainRecord(payload.crawlerMeta) ? payload.crawlerMeta.catalogEffectiveYear : undefined);
  if (explicitPayloadYear) return explicitPayloadYear;
  const semester = isPlainRecord(payload.semester) ? payload.semester : {};
  const semesterYear = numberValue(semester.academicYear);
  if (semesterYear) return semesterYear;
  const cohortYears = Array.isArray(payload.cohortYears)
    ? payload.cohortYears.map((item) => numberValue(item)).filter((item): item is number => Boolean(item))
    : [];
  return cohortYears.length ? Math.max(...cohortYears) : null;
}

export function importModeForLifecycle(payload: Record<string, unknown>, fallback?: string) {
  return textValue(payload.importMode) || fallback || (records(payload.curriculumRules).length ? "cohort_programme_handbook" : "course_catalog");
}

export function courseCatalogSnapshotCompleteness(payload: Record<string, unknown>) {
  const importMode = importModeForLifecycle(payload);
  if (importMode !== "course_catalog") return "none";
  const meta = isPlainRecord(payload.crawlerMeta) ? payload.crawlerMeta : {};
  const explicit = textValue(payload.snapshotCompleteness) || textValue(meta.snapshotCompleteness);
  if (["full", "near_full", "partial", "none"].includes(explicit)) return explicit;
  const limit = meta.limit;
  const selectedCourses = numberValue(meta.selectedCourses);
  const parsedCourses = numberValue(meta.parsedCourses);
  const commonCurriculum = meta.commonCurriculum;
  const notLimited = limit === "all" || limit === undefined || limit === null;
  const selectedAll = selectedCourses !== undefined && parsedCourses !== undefined && selectedCourses >= parsedCourses;
  if (notLimited && selectedAll && commonCurriculum !== false) return "near_full";
  return "partial";
}

export function buildCourseFieldDiffsForCourse(input: {
  importMode?: string;
  payload: Record<string, unknown>;
  existing?: Record<string, unknown> | null;
  incoming: Record<string, unknown>;
}) {
  const code = textValue(input.incoming.code);
  if (!code || !input.existing) return [];
  const importMode = input.importMode || importModeForLifecycle(input.payload);
  const existingYear = numberValue(input.existing.catalogEffectiveYear) ?? null;
  const incomingYear = courseEffectiveYearFromPayload(input.payload, input.incoming);
  const manualOverrideFields = new Set(textValues(input.existing.manualOverrideFields));

  return courseLifecycleFields.flatMap((field): CourseFieldDiff[] => {
    const existingValue = normalizedFieldValue(input.existing as Record<string, unknown>, field, true);
    const incomingValue = normalizedFieldValue(input.incoming, field);
    if (stableValue(existingValue) === stableValue(incomingValue)) return [];

    const hasManualOverride = manualOverrideFields.has(field);
    let recommendation: CourseFieldRecommendation = "accept_incoming";
    let blocking = false;
    let reason = "Incoming value is newer than the current course catalog value.";

    if (importMode !== "course_catalog" && field !== "status") {
      recommendation = "keep_existing_handbook_source";
      reason = "Programme handbook rows are admission-rule evidence; course catalog metadata remains the authority.";
    } else if (hasManualOverride) {
      recommendation = "manual_review";
      blocking = true;
      reason = "This field has an admin manual override and needs an explicit resolution.";
    } else if (existingYear !== null && incomingYear !== null && incomingYear < existingYear) {
      recommendation = "keep_existing_stale_incoming";
      reason = "Incoming course metadata is older than the current catalog value.";
    } else if (existingYear !== null && incomingYear !== null && incomingYear === existingYear) {
      recommendation = "manual_review_same_year";
      blocking = true;
      reason = "The same effective year has conflicting metadata; an admin must choose the canonical value.";
    } else if (field === "categoryTags" || field === "sourceRefIds") {
      recommendation = "merge_values";
      reason = "List-style catalog evidence can be safely merged unless an admin chooses otherwise.";
    }

    if (field === "status" && textValue(input.existing?.status) === "inactive") {
      recommendation = "manual_review";
      blocking = true;
      reason = "This import references an inactive course; approve only after choosing whether to reactivate or keep inactive.";
    }

    return [{
      code,
      title: textValue(input.incoming.title) || textValue(input.existing?.title),
      field,
      existingValue,
      incomingValue,
      existingEffectiveYear: existingYear,
      incomingEffectiveYear: incomingYear,
      hasManualOverride,
      recommendation,
      blocking,
      reason
    }];
  });
}

export function buildRetirementCandidates(input: {
  payload: Record<string, unknown>;
  incomingCodes: string[];
  existingCourses: Array<Record<string, unknown>>;
}) {
  const completeness = courseCatalogSnapshotCompleteness(input.payload);
  if (!["full", "near_full"].includes(completeness)) return [];
  const incoming = new Set(input.incomingCodes);
  const incomingYear = courseEffectiveYearFromPayload(input.payload);
  return input.existingCourses
    .filter((course) => textValue(course.code) && !incoming.has(textValue(course.code)))
    .filter((course) => {
      if (textValue(course.source) === "bnbu_import") return true;
      if (numberValue(course.catalogEffectiveYear) !== undefined) return true;
      return normalizedStringArray(course.sourceRefIds).some((id) => /course[-_ ]?descriptions?|catalog/i.test(id));
    })
    .filter((course) => textValue(course.status) !== "inactive")
    .map((course): RetirementCandidate => {
      const existingEffectiveYear = numberValue(course.catalogEffectiveYear) ?? null;
      return {
        code: textValue(course.code),
        title: textValue(course.title),
        status: textValue(course.status) || "active",
        existingEffectiveYear,
        existingValidThroughYear: numberValue(course.catalogValidThroughYear) ?? null,
        incomingEffectiveYear: incomingYear,
        proposedValidThroughYear: incomingYear ? incomingYear - 1 : existingEffectiveYear,
        recommendation: "review_retirement",
        blocking: true,
        reason: "This active course is absent from a near-full course catalog snapshot. Confirm soft retirement before applying."
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function courseFieldDecision(decisions: CourseApprovalDecisions | undefined, code: string, field: CourseLifecycleField) {
  return decisions?.courseFields?.[code]?.[field] ?? null;
}

export function retirementDecision(decisions: CourseApprovalDecisions | undefined, code: string) {
  return decisions?.retirements?.[code] ?? null;
}

export function unresolvedBlockingCourseChanges(
  diff: { courseFieldDiffs?: CourseFieldDiff[]; retirementCandidates?: RetirementCandidate[] },
  decisions?: CourseApprovalDecisions
) {
  const unresolvedFieldDiffs = (diff.courseFieldDiffs ?? []).filter((item) => {
    if (!item.blocking) return false;
    return !courseFieldDecision(decisions, item.code, item.field)?.action;
  });
  const unresolvedRetirements = (diff.retirementCandidates ?? []).filter((item) => {
    if (!item.blocking) return false;
    return !retirementDecision(decisions, item.code)?.action;
  });
  return [...unresolvedFieldDiffs, ...unresolvedRetirements];
}

export function resolvedCourseFieldValue(diff: CourseFieldDiff, decisions?: CourseApprovalDecisions) {
  const decision = courseFieldDecision(decisions, diff.code, diff.field);
  const action = decision?.action ?? diff.recommendation;
  if (action === "keep_existing" || action === "keep_existing_stale_incoming" || action === "keep_existing_handbook_source") return diff.existingValue;
  if (action === "edit_value") return decision?.value;
  if (action === "merge_values") {
    if (diff.field === "categoryTags" || diff.field === "sourceRefIds") {
      return normalizedStringArray([...(Array.isArray(diff.existingValue) ? diff.existingValue : []), ...(Array.isArray(diff.incomingValue) ? diff.incomingValue : [])]);
    }
  }
  if (action === "manual_review" || action === "manual_review_same_year") return diff.existingValue;
  return diff.incomingValue;
}
