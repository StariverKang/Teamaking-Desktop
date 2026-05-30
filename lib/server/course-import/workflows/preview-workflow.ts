import { getActiveSchool } from "@/lib/app-version";

import { prisma } from "@/lib/prisma";
import { normalizedRuleStudentAction, relativeTermCodesForRule, validateBnbuCourseImportPayload } from "@/lib/bnbu-course-import";
import { isPlainRecord, numberValues, records, textValue, textValues } from "@/lib/server/json-utils";
import { audienceForRule, cohortYearsForRule, countRows, firstItems, stableJson } from "@/lib/server/course-import/import-helpers";
import { ruleMatchesAcademicTermContext, selectDefaultJoinUsers } from "@/lib/server/course-import/curriculum-matching";
import {
  buildCourseFieldDiffsForCourse,
  buildRetirementCandidates,
  courseCatalogFingerprint,
  courseEffectiveYearFromPayload,
  importModeForLifecycle,
  unresolvedBlockingCourseChanges,
  type CourseApprovalDecisions
} from "@/lib/server/course-import/course-lifecycle";

export async function estimateDefaultJoinUsers(input: {
  schoolId?: string;
  majorCodes: string[];
  facultyCodes: string[];
  grades: string[];
  relativeTermCodes: string[];
  allMajors: boolean;
  semesterYear?: number;
  semesterTerm?: string;
}) {
  if (!input.schoolId) return 0;

  const [majors, faculties] = await Promise.all([
    input.majorCodes.length
      ? prisma.major.findMany({ where: { schoolId: input.schoolId, code: { in: input.majorCodes } }, select: { id: true } })
      : Promise.resolve([]),
    input.facultyCodes.length
      ? prisma.faculty.findMany({ where: { schoolId: input.schoolId, code: { in: input.facultyCodes } }, select: { id: true } })
      : Promise.resolve([])
  ]);

  const audienceOr = [];
  if (input.allMajors) audienceOr.push({});
  if (majors.length) audienceOr.push({ majorId: { in: majors.map((major) => major.id) } });
  if (faculties.length) audienceOr.push({ facultyId: { in: faculties.map((faculty) => faculty.id) } });
  if (!audienceOr.length) return 0;

  const users = await prisma.user.findMany({
    where: {
      schoolId: input.schoolId,
      onboardingCompleted: true,
      profile: {
        is: {
          ...(input.grades.length && !input.relativeTermCodes.length ? { grade: { in: input.grades } } : {}),
          OR: audienceOr
        }
      }
    },
    select: {
      id: true,
      profile: {
        select: {
          entryYear: true,
          entryTerm: true,
          grade: true
        }
      }
    }
  });

  const semester = { year: input.semesterYear, term: input.semesterTerm };
  return selectDefaultJoinUsers(users, input.relativeTermCodes, semester).length;
}

export async function buildCourseImportPreview(payload: Record<string, unknown>, approvalDecisions: CourseApprovalDecisions = {}) {
  const validation = validateBnbuCourseImportPayload(payload);
  const requestedImportMode = importModeForLifecycle(payload);
  const courseCatalogImport = requestedImportMode === "course_catalog";
  const semesterInput = isPlainRecord(payload.semester) ? payload.semester : {};
  const semesterCode = textValue(semesterInput.code);
  const school = await getActiveSchool("BNBU");
  const semester = !courseCatalogImport && school && semesterCode
    ? await prisma.semester.findFirst({
        where: {
          schoolId: school.id,
          OR: [{ code: semesterCode }, { name: textValue(semesterInput.name) }]
        }
      })
    : null;

  const facultyCodes = records(payload.faculties).map((item) => textValue(item.code)).filter(Boolean);
  const majorCodes = records(payload.majors).map((item) => textValue(item.code)).filter(Boolean);
  const courseCodes = records(payload.courses).map((item) => textValue(item.code)).filter(Boolean);
  const incomingRuleIds = records(payload.curriculumRules).map((item) => textValue(item.id)).filter(Boolean);
  const incomingCourses = records(payload.courses);
  const incomingRules = records(payload.curriculumRules);
  const incomingOfferings = records(payload.offerings);
  const handbookOnlyImport = incomingOfferings.length === 0 && !courseCatalogImport;
  const incomingCohortYears = [...new Set(incomingRules.flatMap(cohortYearsForRule))].sort((a, b) => b - a);

  const [existingFaculties, existingMajors, existingCourses, existingRules, existingCatalogCourses] = await Promise.all([
    school && facultyCodes.length
      ? prisma.faculty.findMany({ where: { schoolId: school.id, code: { in: facultyCodes } }, select: { code: true, name: true } })
      : Promise.resolve([]),
    school && majorCodes.length
      ? prisma.major.findMany({ where: { schoolId: school.id, code: { in: majorCodes } }, select: { code: true, name: true } })
      : Promise.resolve([]),
    school && courseCodes.length
      ? prisma.course.findMany({
          where: { schoolId: school.id, code: { in: courseCodes } },
          select: {
            code: true,
            title: true,
            description: true,
            credits: true,
            ownerUnit: true,
            categoryTags: true,
            courseType: true,
            status: true,
            sourceRefIds: true,
            catalogEffectiveYear: true,
            catalogValidThroughYear: true,
            catalogFingerprint: true,
            manualOverrideFields: true,
            manualNote: true
          }
        })
      : Promise.resolve([]),
    school
      ? prisma.courseCurriculumRule.findMany({
          where: { course: { schoolId: school.id }, status: "active" },
          include: { course: { select: { code: true, title: true } } }
        })
      : Promise.resolve([])
    ,
    school && courseCatalogImport
      ? prisma.course.findMany({
          where: { schoolId: school.id },
          select: {
            code: true,
            title: true,
            status: true,
            source: true,
            sourceRefIds: true,
            catalogEffectiveYear: true,
            catalogValidThroughYear: true,
            catalogFingerprint: true
          }
        })
      : Promise.resolve([])
  ]);

  const existingFacultyCodes = new Set(existingFaculties.map((item) => item.code).filter(Boolean));
  const existingMajorCodes = new Set(existingMajors.map((item) => item.code).filter(Boolean));
  const existingCourseCodes = new Set(existingCourses.map((item) => item.code));
  const existingCourseByCode = new Map(existingCourses.map((item) => [item.code, item]));
  const existingRulesInCohorts = incomingCohortYears.length
    ? existingRules.filter((rule) => {
        const years = cohortYearsForRule({ audience: rule.audience as unknown as Record<string, unknown> });
        return years.some((year) => incomingCohortYears.includes(year));
      })
    : existingRules;
  const existingRuleIds = new Set(existingRulesInCohorts.map((item) => item.externalId));
  const incomingRuleIdSet = new Set(incomingRuleIds);

  let estimatedDefaultJoinUsers = 0;
  const defaultJoinRuleSamples: string[] = [];
  const searchableRuleSamples: string[] = [];

  for (const rule of incomingRules) {
    const studentAction = normalizedRuleStudentAction(rule);
    const externalId = textValue(rule.id);
    if (studentAction === "searchable_add") searchableRuleSamples.push(externalId);
    if (studentAction !== "default_join") continue;
    defaultJoinRuleSamples.push(externalId);
    if (handbookOnlyImport) continue;
    const audience = isPlainRecord(rule.audience) ? rule.audience : {};
    estimatedDefaultJoinUsers += await estimateDefaultJoinUsers({
      schoolId: school?.id,
      majorCodes: textValues(audience.majorCodes),
      facultyCodes: textValues(audience.facultyCodes),
      grades: textValues(audience.grades),
      relativeTermCodes: relativeTermCodesForRule(rule),
      allMajors: audience.allMajors === true,
      semesterYear: Number(semesterInput.academicYear),
      semesterTerm: textValue(semesterInput.term)
    });
  }

  const newRuleIds = incomingRuleIds.filter((id) => !existingRuleIds.has(id));
  const retainedRuleIds = incomingRuleIds.filter((id) => existingRuleIds.has(id));
  const inactiveRuleIds = existingRulesInCohorts.map((rule) => rule.externalId).filter((id) => !incomingRuleIdSet.has(id));
  const existingRuleById = new Map(existingRulesInCohorts.map((rule) => [rule.externalId, rule]));
  const changedRules = incomingRules
    .map((rule) => {
      const externalId = textValue(rule.id);
      const existing = existingRuleById.get(externalId);
      if (!existing) return null;
      const incomingAudience = audienceForRule(rule);
      const incomingRelativeTerms = relativeTermCodesForRule(rule);
      const changedFields = [
        existing.classification !== textValue(rule.classification) ? "classification" : null,
        existing.studentAction !== normalizedRuleStudentAction(rule) ? "studentAction" : null,
        stableJson(existing.audience) !== stableJson(incomingAudience) ? "audience" : null,
        stableJson(existing.relativeTermCodes) !== stableJson(incomingRelativeTerms) ? "relativeTermCodes" : null
      ].filter(Boolean);
      if (!changedFields.length) return null;
      return {
        id: externalId,
        courseCode: textValue(rule.courseCode),
        changedFields,
        before: {
          classification: existing.classification,
          studentAction: existing.studentAction,
          audience: existing.audience,
          relativeTermCodes: existing.relativeTermCodes
        },
        after: {
          classification: textValue(rule.classification),
          studentAction: normalizedRuleStudentAction(rule),
          audience: incomingAudience,
          relativeTermCodes: incomingRelativeTerms
        }
      };
    })
    .filter(Boolean);

  const courseRows = incomingCourses.map((course) => {
    const code = textValue(course.code);
    const existing = existingCourseByCode.get(code);
    const manualOverrideFields = textValues(existing?.manualOverrideFields);
    const protectedConflicts = manualOverrideFields
      .map((field) => {
        const incomingValue =
          field === "categoryTags" || field === "sourceRefIds"
            ? textValues(course[field])
            : field === "ownerUnit"
              ? isPlainRecord(course[field]) ? course[field] : {}
              : course[field];
        const currentValue = existing ? (existing as any)[field] : undefined;
        if (!existing || stableJson(currentValue) === stableJson(incomingValue)) return null;
        return { field, currentValue, incomingValue };
      })
      .filter(Boolean);
    return {
      kind: "courses",
      id: code,
      code,
      title: textValue(course.title),
      credits: typeof course.credits === "number" ? course.credits : null,
      ownerUnit: isPlainRecord(course.ownerUnit) ? course.ownerUnit : {},
      categoryTags: textValues(course.categoryTags),
      sourceRefIds: textValues(course.sourceRefIds),
      effectiveYear: courseEffectiveYearFromPayload(payload, course),
      fingerprint: textValue(course.fingerprint) || courseCatalogFingerprint(course),
      manualOverrideFields,
      protectedConflicts,
      status: existingCourseCodes.has(code) ? "updated" : "new",
      raw: course
    };
  });
  const courseFieldDiffs = incomingCourses.flatMap((course) =>
    buildCourseFieldDiffsForCourse({
      importMode: requestedImportMode,
      payload,
      incoming: course,
      existing: existingCourseByCode.get(textValue(course.code))
    })
  );
  const ruleRows = incomingRules.map((rule) => {
    const audience = audienceForRule(rule);
    const externalId = textValue(rule.id);
    return {
      kind: "curriculumRules",
      id: externalId,
      courseCode: textValue(rule.courseCode),
      classification: textValue(rule.classification),
      classificationLabel: textValue(rule.classificationLabel),
      studentAction: normalizedRuleStudentAction(rule),
      majorCodes: textValues(audience.majorCodes),
      facultyCodes: textValues(audience.facultyCodes),
      cohortYears: numberValues(audience.cohortYears),
      relativeTermCodes: relativeTermCodesForRule(rule),
      allMajors: audience.allMajors === true,
      confidence: textValue(rule.confidence) || "unknown",
      sourceRefIds: textValues(rule.sourceRefIds),
      status: existingRuleIds.has(externalId) ? "retained_or_changed" : "new",
      raw: rule
    };
  });
  const termContextRuleRows = handbookOnlyImport ? [] : ruleRows.filter((row) => ruleMatchesAcademicTermContext(row.raw, { year: Number(semesterInput.academicYear), term: textValue(semesterInput.term) }));
  const sourceRows = records(payload.sourceRefs).map((source) => ({
    kind: "sourceRefs",
    id: textValue(source.id),
    title: textValue(source.title),
    sourceType: textValue(source.sourceType),
    url: textValue(source.url),
    raw: source
  }));
  const offeringRows = incomingOfferings.map((offering, index) => ({
    kind: "offerings",
    id: textValue(offering.id) || `${textValue(offering.courseCode)}-${index}`,
    courseCode: textValue(offering.courseCode),
    semesterCode: textValue(offering.semesterCode),
    sections: textValues(offering.sections),
    sourceRefIds: textValues(offering.sourceRefIds),
    status: textValue(offering.status) || "active",
    raw: offering
  }));
  const retirementCandidates = buildRetirementCandidates({
    payload,
    incomingCodes: courseCodes,
    existingCourses: existingCatalogCourses
  });
  const inactiveRuleCourseConflicts = ruleRows
    .map((rule) => {
      const existing = existingCourseByCode.get(rule.courseCode);
      if (!existing || existing.status !== "inactive") return null;
      return {
        code: rule.courseCode,
        ruleId: rule.id,
        title: existing.title,
        recommendation: "reactivate_or_remap_course",
        blocking: true,
        reason: "This active admission rule references a course that is currently inactive."
      };
    })
    .filter(Boolean);
  const blockingCourseChanges = unresolvedBlockingCourseChanges({ courseFieldDiffs, retirementCandidates }, approvalDecisions);

  return {
    validation,
    importMode: courseCatalogImport ? "course_catalog" : handbookOnlyImport ? "cohort_handbook" : "combined_with_offerings",
    semester: {
      code: courseCatalogImport ? null : semesterCode,
      exists: !courseCatalogImport && Boolean(semester),
      willBecomeCurrent: semesterInput.isCurrentCandidate === true,
      label: courseCatalogImport ? "School-wide course catalog" : textValue(semesterInput.name),
      note: courseCatalogImport
        ? "这是学校级 course catalog 导入；批准后只更新课程元数据和课程有效状态，不创建学期、专业或年级绑定。所有 active 课程都可搜索并手动打开 Course Board。"
        : incomingOfferings.length
          ? "包含真实开课记录，会创建或更新 CourseBoard。"
          : "这是按入学年份发布的 programme handbook / curriculum plan 导入；批准后只写入课程目录和 admission-year programme plan rules。CourseBoard 激活和推荐匹配由 Semester activation 单独触发。"
    },
    counts: {
      newFaculties: facultyCodes.filter((code) => !existingFacultyCodes.has(code)).length,
      updatedFaculties: facultyCodes.filter((code) => existingFacultyCodes.has(code)).length,
      newMajors: majorCodes.filter((code) => !existingMajorCodes.has(code)).length,
      updatedMajors: majorCodes.filter((code) => existingMajorCodes.has(code)).length,
      newCourses: courseCodes.filter((code) => !existingCourseCodes.has(code)).length,
      updatedCourses: courseCodes.filter((code) => existingCourseCodes.has(code)).length,
      newRules: newRuleIds.length,
      retainedRules: retainedRuleIds.length,
      rulesToDeactivate: inactiveRuleIds.length,
      changedRules: changedRules.length,
      defaultJoinRules: defaultJoinRuleSamples.length,
      defaultJoinRulesDeferredToSemesterActivation: handbookOnlyImport ? defaultJoinRuleSamples.length : 0,
      searchableRules: searchableRuleSamples.length,
      offeringCourses: new Set(incomingOfferings.map((item) => textValue(item.courseCode)).filter(Boolean)).size,
      offeringSections: incomingOfferings.reduce((total, item) => total + Math.max(1, textValues(item.sections).length), 0),
      courseBoardsToActivate: new Set(termContextRuleRows.map((row) => row.courseCode).filter(Boolean)).size,
      rulesInAcademicTermContext: termContextRuleRows.length,
      protectedCourseConflicts: courseRows.reduce((total, row) => total + row.protectedConflicts.length, 0),
      courseFieldDiffs: courseFieldDiffs.length,
      retirementCandidates: retirementCandidates.length,
      blockingCourseChanges: blockingCourseChanges.length + inactiveRuleCourseConflicts.length,
      estimatedDefaultJoinUsers
    },
    coverage: {
      cohortYears: countRows(ruleRows, (row) => row.cohortYears.map(String)),
      classifications: countRows(ruleRows, (row) => row.classification),
      studentActions: countRows(ruleRows, (row) => row.studentAction),
      majors: countRows(ruleRows, (row) => (row.majorCodes.length ? row.majorCodes : row.allMajors ? "ALL" : "Unspecified")),
      relativeTerms: countRows(ruleRows, (row) => (row.relativeTermCodes.length ? row.relativeTermCodes : "Unspecified")),
      majorTermClassification: countRows(ruleRows, (row) => {
        const majors = row.majorCodes.length ? row.majorCodes : [row.allMajors ? "ALL" : "Unspecified"];
        const terms = row.relativeTermCodes.length ? row.relativeTermCodes : ["Unspecified"];
        return majors.flatMap((major) => terms.map((term) => `${row.cohortYears.join("/") || "?"} · ${major} · ${term} · ${row.classification}`));
      })
    },
    databaseCoverage: await buildBnbuDatabaseCoverage(existingRules),
    diff: {
      baseline: "current_database",
      courses: {
        added: courseCodes.filter((code) => !existingCourseCodes.has(code)),
        updated: courseCodes.filter((code) => existingCourseCodes.has(code)),
        fieldDiffs: courseFieldDiffs,
        retirementCandidates,
        blockingIssues: [...blockingCourseChanges, ...inactiveRuleCourseConflicts],
        inactiveRuleCourseConflicts,
        protectedConflicts: courseRows.filter((row) => row.protectedConflicts.length > 0).map((row) => ({
          code: row.code,
          title: row.title,
          conflicts: row.protectedConflicts
        }))
      },
      rules: {
        added: newRuleIds,
        retained: retainedRuleIds,
        changed: changedRules,
        wouldDeactivate: inactiveRuleIds
      }
    },
    tables: {
      courses: courseRows,
      curriculumRules: ruleRows,
      offerings: offeringRows,
      sourceRefs: sourceRows
    },
    samples: {
      newCourses: firstItems(courseCodes.filter((code) => !existingCourseCodes.has(code))),
      updatedCourses: firstItems(courseCodes.filter((code) => existingCourseCodes.has(code))),
      newRules: firstItems(newRuleIds),
      rulesToDeactivate: firstItems(inactiveRuleIds),
      defaultJoinRules: firstItems(defaultJoinRuleSamples),
      searchableRules: firstItems(searchableRuleSamples),
      changedRules: firstItems(changedRules.map((item: any) => item.id))
    }
  };
}

export async function buildBnbuDatabaseCoverage(preloadedRules?: any[]) {
  const school = await getActiveSchool("BNBU");
  if (!school) {
    return { cohortYears: [], classifications: [], majors: [], relativeTerms: [], totalRules: 0 };
  }
  const rules = preloadedRules ?? await prisma.courseCurriculumRule.findMany({
    where: { course: { schoolId: school.id }, status: "active" },
    include: { course: { select: { code: true, title: true } } }
  });
  const rows = rules.map((rule) => {
    const audience = isPlainRecord(rule.audience) ? rule.audience : {};
    return {
      cohortYears: numberValues(audience.cohortYears),
      classification: rule.classification,
      majorCodes: textValues(audience.majorCodes),
      relativeTermCodes: Array.isArray(rule.relativeTermCodes) ? textValues(rule.relativeTermCodes) : []
    };
  });
  return {
    totalRules: rows.length,
    cohortYears: countRows(rows, (row) => row.cohortYears.map(String)),
    classifications: countRows(rows, (row) => row.classification),
    majors: countRows(rows, (row) => row.majorCodes.length ? row.majorCodes : "ALL/Unspecified"),
    relativeTerms: countRows(rows, (row) => row.relativeTermCodes.length ? row.relativeTermCodes : "Unspecified")
  };
}
