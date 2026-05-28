import { getActiveAppVersionId, getActiveSchool } from "@/lib/app-version";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { cohortYearsForRule } from "@/lib/server/course-import/import-helpers";
import { isPlainRecord, numberValues, toJson } from "@/lib/server/json-utils";

type CleanupScope = "batch" | "all";

type CleanupBatchCandidate = {
  id: string;
  name: string | null;
  status: string;
  cohortYears: unknown;
  payload: unknown;
  summary: unknown;
};

type CleanupRuleCandidate = {
  id: string;
  courseId: string;
  semesterId: string;
  audience: unknown;
};

type AdmissionImportCleanupResult = {
  scope: CleanupScope;
  batchIds: string[];
  batchCount: number;
  rulesDeleted: number;
  activeAutoMembershipsDeleted: number;
  programmePlanOfferingsDeleted: number;
  programmePlanOfferingsRetained: number;
  batchesMarkedCleared: number;
};

function ruleCohortYears(rule: { audience: unknown }) {
  return cohortYearsForRule({ audience: isPlainRecord(rule.audience) ? rule.audience : {} });
}

function isAdmissionBatch(batch: CleanupBatchCandidate) {
  if (numberValues(batch.cohortYears).length) return true;
  if (isPlainRecord(batch.summary) && numberValues(batch.summary.cohortYears).length) return true;
  if (isPlainRecord(batch.payload) && numberValues(batch.payload.cohortYears).length) return true;
  return false;
}

function courseSemesterKey(input: { courseId: string; semesterId: string }) {
  return `${input.courseId}::${input.semesterId}`;
}

function uniqueCourseSemesterPairs(rules: CleanupRuleCandidate[]) {
  const pairs = new Map<string, { courseId: string; semesterId: string }>();
  rules.forEach((rule) => {
    pairs.set(courseSemesterKey(rule), { courseId: rule.courseId, semesterId: rule.semesterId });
  });
  return [...pairs.values()];
}

async function cleanupRulesAndGeneratedProgrammePlans(tx: any, rules: CleanupRuleCandidate[]) {
  const ruleIds = rules.map((rule) => rule.id);
  if (!ruleIds.length) {
    return {
      rulesDeleted: 0,
      activeAutoMembershipsDeleted: 0,
      programmePlanOfferingsDeleted: 0,
      programmePlanOfferingsRetained: 0
    };
  }

  const autoMemberships = await tx.courseBoardMembership.deleteMany({
    where: {
      originRuleId: { in: ruleIds },
      source: { startsWith: "auto_" },
      status: "active"
    }
  });
  const deletedRules = await tx.courseCurriculumRule.deleteMany({ where: { id: { in: ruleIds } } });

  const pairs = uniqueCourseSemesterPairs(rules);
  const courseIds = [...new Set(pairs.map((pair) => pair.courseId))];
  const semesterIds = [...new Set(pairs.map((pair) => pair.semesterId))];
  const pairKeys = new Set(pairs.map(courseSemesterKey));

  const remainingRules = await tx.courseCurriculumRule.findMany({
    where: {
      courseId: { in: courseIds },
      semesterId: { in: semesterIds },
      status: "active"
    },
    select: { courseId: true, semesterId: true }
  });
  const pairsWithRemainingRules = new Set(remainingRules.map(courseSemesterKey));

  const programmePlanOfferings = await tx.courseOffering.findMany({
    where: {
      courseId: { in: courseIds },
      semesterId: { in: semesterIds },
      section: "Programme Plan"
    },
    include: {
      posts: { select: { id: true } },
      boards: {
        select: {
          id: true,
          posts: { select: { id: true } },
          memberships: { select: { id: true } }
        }
      }
    }
  });

  const deletableOfferingIds = programmePlanOfferings
    .filter((offering: any) => pairKeys.has(courseSemesterKey(offering)))
    .filter((offering: any) => !pairsWithRemainingRules.has(courseSemesterKey(offering)))
    .filter((offering: any) => {
      if (offering.posts.length) return false;
      return offering.boards.every((board: any) => board.posts.length === 0 && board.memberships.length === 0);
    })
    .map((offering: any) => offering.id);

  const deletedOfferings = deletableOfferingIds.length
    ? await tx.courseOffering.deleteMany({ where: { id: { in: deletableOfferingIds } } })
    : { count: 0 };

  return {
    rulesDeleted: deletedRules.count,
    activeAutoMembershipsDeleted: autoMemberships.count,
    programmePlanOfferingsDeleted: deletedOfferings.count,
    programmePlanOfferingsRetained: programmePlanOfferings.filter((offering: any) => pairKeys.has(courseSemesterKey(offering))).length - deletedOfferings.count
  };
}

async function markBatchesCleared(tx: any, batchIds: string[], admin: any, scope: CleanupScope) {
  if (!batchIds.length) return { count: 0 };
  const now = new Date();
  return tx.courseImportBatch.updateMany({
    where: { id: { in: batchIds }, status: { not: "cleared" } },
    data: {
      status: "cleared",
      adminNote: `Admission import data cleared (${scope}) by ${admin.email ?? admin.id} at ${now.toISOString()}`
    }
  });
}

export async function clearAdmissionImportBatch(batchId: string, admin: any): Promise<AdmissionImportCleanupResult> {
  const before = await prisma.courseImportBatch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true, status: true, cohortYears: true, payload: true, summary: true }
  });
  if (!before) throw new ApiError(404, "找不到这个课程配置操作。");
  if (!isAdmissionBatch(before)) {
    throw new ApiError(400, "这个批次不是 admission-year 导入，不能用 admission 清理功能处理。");
  }

  const result = await prisma.$transaction(async (tx) => {
    const rules = await tx.courseCurriculumRule.findMany({
      where: { importBatchId: batchId },
      select: { id: true, courseId: true, semesterId: true, audience: true }
    });
    const cleaned = await cleanupRulesAndGeneratedProgrammePlans(tx, rules);
    const marked = await markBatchesCleared(tx, [batchId], admin, "batch");
    return {
      scope: "batch" as const,
      batchIds: [batchId],
      batchCount: 1,
      ...cleaned,
      batchesMarkedCleared: marked.count
    };
  }, { timeout: 60000, maxWait: 10000 });

  await writeAudit(admin.id, "admin.course_imports.clear_admission_batch", "CourseImportBatch", batchId, before, result);
  return result;
}

export async function clearAllAdmissionImports(admin: any): Promise<AdmissionImportCleanupResult> {
  const appVersionId = await getActiveAppVersionId();
  const school = await getActiveSchool("BNBU");
  const batches = await prisma.courseImportBatch.findMany({
    where: {
      appVersionId,
      ...(school?.id ? { schoolId: school.id } : {})
    },
    select: { id: true, name: true, status: true, cohortYears: true, payload: true, summary: true }
  });
  const admissionBatches = batches.filter(isAdmissionBatch);
  const batchIds = admissionBatches.map((batch) => batch.id);

  const result = await prisma.$transaction(async (tx) => {
    const candidateRules = await tx.courseCurriculumRule.findMany({
      where: {
        semester: {
          school: {
            appVersionId,
            shortName: "BNBU"
          }
        }
      },
      select: { id: true, courseId: true, semesterId: true, audience: true }
    });
    const admissionRules = candidateRules.filter((rule: CleanupRuleCandidate) => ruleCohortYears(rule).length > 0);
    const cleaned = await cleanupRulesAndGeneratedProgrammePlans(tx, admissionRules);
    const marked = await markBatchesCleared(tx, batchIds, admin, "all");
    return {
      scope: "all" as const,
      batchIds,
      batchCount: batchIds.length,
      ...cleaned,
      batchesMarkedCleared: marked.count
    };
  }, { timeout: 60000, maxWait: 10000 });

  await writeAudit(admin.id, "admin.course_imports.clear_all_admission", "AppVersion", appVersionId, { batchIds }, toJson(result));
  return result;
}
