import { getActiveAppVersionId } from "@/lib/app-version";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { normalizedRuleStudentAction, relativeTermCodesForRule } from "@/lib/bnbu-course-import";
import { writeAudit } from "@/lib/server/audit";
import { cohortYearsForRule, hasOverlappingNumber, stableJson } from "@/lib/server/course-import/import-helpers";
import { ruleMatchesAcademicTermContext } from "@/lib/server/course-import/curriculum-matching";
import { applyDefaultJoinRule, findOrCreateAcademicTermOffering, findOrCreateBoard } from "@/lib/server/course-import/workflows/apply-workflow";
import { isPlainRecord, numberValues, textValue, textValues, toJson } from "@/lib/server/json-utils";

export type AdmissionSemesterActivationInput = {
  academicYear?: unknown;
  term?: unknown;
  semesterCode?: unknown;
  semesterName?: unknown;
  cohortYears?: unknown;
  makeCurrent?: unknown;
};

function normalizeAcademicYear(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    throw new ApiError(400, "请填写有效的 academic year，例如 2026。");
  }
  return parsed;
}

function normalizeTerm(value: unknown) {
  const normalized = textValue(value).toLowerCase();
  if (normalized.includes("fall") || normalized.includes("autumn") || normalized === "s1" || normalized.includes("semester 1") || normalized.includes("秋")) return "Fall";
  if (normalized.includes("spring") || normalized === "s2" || normalized.includes("semester 2") || normalized.includes("春")) return "Spring";
  throw new ApiError(400, "请填写有效的 term：Fall 或 Spring。");
}

function cohortYearsFromInput(value: unknown) {
  if (Array.isArray(value)) return numberValues(value);
  return numberValues(textValue(value).split(",").map((item) => Number(item.trim())));
}

function activationRuleKey(rule: any) {
  return stableJson({
    courseId: rule.courseId,
    classification: rule.classification,
    studentAction: rule.studentAction,
    audience: isPlainRecord(rule.audience) ? rule.audience : {},
    relativeTermCodes: textValues(rule.relativeTermCodes)
  });
}

export function normalizeAdmissionSemesterActivationInput(input: AdmissionSemesterActivationInput) {
  const academicYear = normalizeAcademicYear(input.academicYear);
  const term = normalizeTerm(input.term);
  const semesterCode = textValue(input.semesterCode) || `${academicYear}-${term}`;
  const semesterName = textValue(input.semesterName) || `${academicYear} ${term}`;
  const cohortYears = cohortYearsFromInput(input.cohortYears);
  return {
    academicYear,
    term,
    semesterCode,
    semesterName,
    cohortYears,
    makeCurrent: input.makeCurrent !== false
  };
}

export async function activateAdmissionSemester(input: AdmissionSemesterActivationInput, admin: any) {
  const normalized = normalizeAdmissionSemesterActivationInput(input);
  const appVersionId = await getActiveAppVersionId();
  const before = { ...normalized };

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.findFirst({
      where: { appVersionId, shortName: "BNBU" }
    });
    if (!school) throw new ApiError(404, "找不到当前版本的 BNBU 学校记录。请先导入课程配置。");

    if (normalized.makeCurrent) {
      await tx.semester.updateMany({ where: { schoolId: school.id }, data: { isCurrent: false } });
    }

    const existingSemester = await tx.semester.findFirst({
      where: {
        schoolId: school.id,
        OR: [{ code: normalized.semesterCode }, { name: normalized.semesterName }]
      }
    });
    const semester = existingSemester
      ? await tx.semester.update({
          where: { id: existingSemester.id },
          data: {
            code: normalized.semesterCode,
            name: normalized.semesterName,
            year: normalized.academicYear,
            term: normalized.term,
            isCurrent: normalized.makeCurrent ? true : existingSemester.isCurrent
          }
        })
      : await tx.semester.create({
          data: {
            schoolId: school.id,
            code: normalized.semesterCode,
            name: normalized.semesterName,
            year: normalized.academicYear,
            term: normalized.term,
            isCurrent: normalized.makeCurrent
          }
        });

    const candidateRules = await tx.courseCurriculumRule.findMany({
      where: {
        status: "active",
        studentAction: { not: "hidden" },
        course: { schoolId: school.id, status: "active" }
      },
      include: {
        course: { select: { id: true, code: true, title: true } },
        importBatch: { select: { id: true, name: true, cohortYears: true, status: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    const matchingRules = candidateRules.filter((rule: any) => {
      const ruleCohorts = cohortYearsForRule({ audience: isPlainRecord(rule.audience) ? rule.audience : {} });
      if (normalized.cohortYears.length && !hasOverlappingNumber(ruleCohorts, normalized.cohortYears)) return false;
      return ruleMatchesAcademicTermContext(rule, { year: normalized.academicYear, term: normalized.term });
    });

    const dedupedRules = [];
    const seenRuleKeys = new Set<string>();
    for (const rule of matchingRules) {
      const key = activationRuleKey(rule);
      if (seenRuleKeys.has(key)) continue;
      seenRuleKeys.add(key);
      dedupedRules.push(rule);
    }

    const activatedBoards = [];
    const activatedBoardKeys = new Set<string>();
    const autoJoinResults = [];
    let searchableOrRecommendRules = 0;

    for (const rule of dedupedRules) {
      const sourceRefIds = textValues(rule.sourceRefIds);
      const offering = await findOrCreateAcademicTermOffering(tx, {
        courseId: rule.courseId,
        semesterId: semester.id,
        sourceRefIds
      });
      const board = await findOrCreateBoard(tx, offering.id, `${rule.course.code} ${rule.course.title}`);
      const boardKey = `${rule.courseId}:${board.id}`;
      if (!activatedBoardKeys.has(boardKey)) {
        activatedBoardKeys.add(boardKey);
        activatedBoards.push({
          ruleId: rule.externalId,
          ruleRecordId: rule.id,
          boardId: board.id,
          courseCode: rule.course.code,
          courseTitle: rule.course.title
        });
      }

      const studentAction = normalizedRuleStudentAction(rule);
      if (studentAction !== "default_join") {
        searchableOrRecommendRules += 1;
        continue;
      }

      const autoJoin = await applyDefaultJoinRule(tx, {
        ruleId: rule.id,
        schoolId: school.id,
        courseId: rule.courseId,
        semesterId: semester.id,
        semesterYear: semester.year,
        semesterTerm: semester.term,
        classification: rule.classification,
        audience: isPlainRecord(rule.audience) ? rule.audience : {},
        relativeTermCodes: relativeTermCodesForRule(rule)
      });
      autoJoinResults.push({
        ruleId: rule.externalId,
        ruleRecordId: rule.id,
        courseCode: rule.course.code,
        ...autoJoin
      });
    }

    return {
      semester: {
        id: semester.id,
        code: semester.code,
        name: semester.name,
        year: semester.year,
        term: semester.term,
        isCurrent: semester.isCurrent
      },
      requested: normalized,
      candidateRules: candidateRules.length,
      matchingRules: matchingRules.length,
      dedupedRules: dedupedRules.length,
      duplicateRulesSkipped: matchingRules.length - dedupedRules.length,
      searchableOrRecommendRules,
      activatedBoards,
      autoJoinResults,
      totals: {
        boardsActivatedOrReused: activatedBoards.length,
        matchedUsers: autoJoinResults.reduce((total, item) => total + Number(item.matchedUsers ?? 0), 0),
        membershipsCreated: autoJoinResults.reduce((total, item) => total + Number(item.membershipsCreated ?? 0), 0),
        membershipsSkipped: autoJoinResults.reduce((total, item) => total + Number(item.membershipsSkipped ?? 0), 0)
      }
    };
  }, { timeout: 60000, maxWait: 10000 });

  await writeAudit(admin.id, "admin.course_imports.activate_semester", "Semester", result.semester.id, before, toJson(result));
  return result;
}
