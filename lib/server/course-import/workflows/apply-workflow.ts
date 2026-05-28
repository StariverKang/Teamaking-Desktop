import { getActiveAppVersionId } from "@/lib/app-version";

import { mergeLegacyBnbuMajorAliases } from "@/lib/academic-options";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { bnbuClassificationLabels, membershipSourceForClassification, normalizedRuleStudentAction, relativeTermCodesForRule, validateBnbuCourseImportPayload } from "@/lib/bnbu-course-import";
import { isPlainRecord, numberValue, records, textValue, textValues, toJson } from "@/lib/server/json-utils";
import { cohortYearsForRule, hasOverlappingNumber, mergeUniqueTextValues, uniqueSortedNumbers } from "@/lib/server/course-import/import-helpers";
import {
  buildCourseFieldDiffsForCourse,
  buildRetirementCandidates,
  courseCatalogFingerprint,
  courseEffectiveYearFromPayload,
  courseFieldDecision,
  resolvedCourseFieldValue,
  retirementDecision,
  type CourseApprovalDecisions,
  type CourseLifecycleField
} from "@/lib/server/course-import/course-lifecycle";

import { defaultJoinMembershipAction, ruleMatchesAcademicTermContext, selectDefaultJoinUsers } from "@/lib/server/course-import/curriculum-matching";

export async function findOrCreateBoard(tx: any, courseOfferingId: string, title: string) {
  const existing = await tx.courseBoard.findFirst({ where: { courseOfferingId } });
  if (existing) {
    return tx.courseBoard.update({
      where: { id: existing.id },
      data: { status: existing.status === "closed" ? existing.status : "active" }
    });
  }
  return tx.courseBoard.create({
    data: {
      courseOfferingId,
      title,
      rules: "请尊重同学，清楚表达自己的贡献方式。BNBU 课程配置只负责推荐和激活课程板；发布 Post 或发送 TeamUp Interest 后才会进入 Course People，且不代表官方选课名单。"
    }
  });
}

export async function findOrCreateAcademicTermOffering(tx: any, input: {
  courseId: string;
  semesterId: string;
  sourceRefIds: string[];
}) {
  const existing = await tx.courseOffering.findFirst({
    where: { courseId: input.courseId, semesterId: input.semesterId, section: "Programme Plan" }
  });
  if (existing) {
    return tx.courseOffering.update({
      where: { id: existing.id },
      data: {
        sourceRefIds: input.sourceRefIds,
        status: existing.status === "cancelled" ? existing.status : "active"
      }
    });
  }
  return tx.courseOffering.create({
    data: {
      courseId: input.courseId,
      semesterId: input.semesterId,
      section: "Programme Plan",
      sourceRefIds: input.sourceRefIds,
      status: "active"
    }
  });
}

export async function applyDefaultJoinRule(tx: any, input: {
  ruleId: string;
  schoolId: string;
  courseId: string;
  semesterId: string;
  semesterYear: number;
  semesterTerm: string;
  classification: string;
  audience: Record<string, unknown>;
  relativeTermCodes: string[];
}) {
  const majorCodes = textValues(input.audience.majorCodes);
  const facultyCodes = textValues(input.audience.facultyCodes);
  const grades = textValues(input.audience.grades);
  const allMajors = input.audience.allMajors === true;

  const [majors, faculties, boards] = await Promise.all([
    majorCodes.length
      ? tx.major.findMany({ where: { schoolId: input.schoolId, code: { in: majorCodes } }, select: { id: true } })
      : Promise.resolve([]),
    facultyCodes.length
      ? tx.faculty.findMany({ where: { schoolId: input.schoolId, code: { in: facultyCodes } }, select: { id: true } })
      : Promise.resolve([]),
    tx.courseBoard.findMany({
      where: {
        courseOffering: {
          courseId: input.courseId,
          semesterId: input.semesterId
        }
      },
      select: { id: true }
    })
  ]);

  if (!boards.length) return { matchedUsers: 0, membershipsCreated: 0, membershipsSkipped: 0 };

  const majorIds = majors.map((major: { id: string }) => major.id);
  const facultyIds = faculties.map((faculty: { id: string }) => faculty.id);
  const profileWhere: Record<string, unknown> = {};
  if (grades.length && !input.relativeTermCodes.length) profileWhere.grade = { in: grades };

  const audienceOr = [];
  if (allMajors) audienceOr.push({});
  if (majorIds.length) audienceOr.push({ majorId: { in: majorIds } });
  if (facultyIds.length) audienceOr.push({ facultyId: { in: facultyIds } });
  if (!audienceOr.length) return { matchedUsers: 0, membershipsCreated: 0, membershipsSkipped: 0 };

  const users = await tx.user.findMany({
    where: {
      schoolId: input.schoolId,
      onboardingCompleted: true,
      profile: {
        is: {
          ...profileWhere,
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

  const matchedUsers = selectDefaultJoinUsers(users as Array<{ id: string; profile: unknown }>, input.relativeTermCodes, { year: input.semesterYear, term: input.semesterTerm });

  let membershipsCreated = 0;
  let membershipsSkipped = 0;
  const source = membershipSourceForClassification(input.classification);

  for (const user of matchedUsers) {
    for (const board of boards) {
      const existing = await tx.courseBoardMembership.findUnique({
        where: { userId_boardId: { userId: user.id, boardId: board.id } }
      });

      const action = defaultJoinMembershipAction(existing);
      if (action === "skip") {
        membershipsSkipped += 1;
        continue;
      }

      if (action === "update_auto") {
        await tx.courseBoardMembership.update({
          where: { userId_boardId: { userId: user.id, boardId: board.id } },
          data: { status: "active", source, originRuleId: input.ruleId, leftAt: null }
        });
        membershipsSkipped += 1;
        continue;
      }

      if (action === "create") {
        await tx.courseBoardMembership.create({
          data: {
            userId: user.id,
            boardId: board.id,
            source,
            status: "active",
            originRuleId: input.ruleId
          }
        });
        membershipsCreated += 1;
      }
    }
  }

  return { matchedUsers: matchedUsers.length, membershipsCreated, membershipsSkipped };
}

function dbValueForCourseField(field: CourseLifecycleField, value: unknown) {
  if (field === "ownerUnit") return toJson(isPlainRecord(value) ? value : {});
  if (field === "categoryTags" || field === "sourceRefIds") return textValues(value);
  if (field === "credits") return numberValue(value) ?? null;
  if (field === "status") return textValue(value) || "active";
  return textValue(value);
}

export async function applyBnbuCourseImport(payload: Record<string, unknown>, batchId: string, approvalDecisions: CourseApprovalDecisions = {}) {
  const summary = validateBnbuCourseImportPayload(payload);
  if (!summary.ok) throw new ApiError(400, `导入文件校验失败：${summary.errors.join("; ")}`);
  const appVersionId = await getActiveAppVersionId();
  const courseCatalogImport = textValue(payload.importMode) === "course_catalog";
  const handbookOnlyImport = records(payload.offerings).length === 0 && !courseCatalogImport;

  return prisma.$transaction(async (tx) => {
    const schoolInput = isPlainRecord(payload.school) ? payload.school : {};
    const semesterInput = isPlainRecord(payload.semester) ? payload.semester : {};
    const school = await tx.school.upsert({
      where: { appVersionId_shortName: { appVersionId, shortName: "BNBU" } },
      update: {
        name: textValue(schoolInput.name) || "Beijing Normal-Hong Kong Baptist University",
        status: "active"
      },
      create: {
        appVersionId,
        shortName: "BNBU",
        name: textValue(schoolInput.name) || "Beijing Normal-Hong Kong Baptist University",
        status: "active"
      }
    });

    const emailDomain = textValue(schoolInput.emailDomain) || "mail.bnbu.edu.cn";
    await tx.schoolEmailDomain.upsert({
      where: { schoolId_domain: { schoolId: school.id, domain: emailDomain } },
      update: { schoolId: school.id, status: "active" },
      create: { schoolId: school.id, domain: emailDomain, status: "active" }
    });

    if (!handbookOnlyImport && semesterInput.isCurrentCandidate === true) {
      await tx.semester.updateMany({ where: { schoolId: school.id }, data: { isCurrent: false } });
    }

    const semesterCode = textValue(semesterInput.code);
    const existingSemester = await tx.semester.findFirst({
      where: { schoolId: school.id, OR: [{ code: semesterCode }, { name: textValue(semesterInput.name) }] }
    });
    const semester = existingSemester
      ? await tx.semester.update({
          where: { id: existingSemester.id },
          data: {
            code: semesterCode,
            name: textValue(semesterInput.name),
            year: Number(semesterInput.academicYear),
            term: textValue(semesterInput.term),
            isCurrent: !handbookOnlyImport && semesterInput.isCurrentCandidate === true ? true : existingSemester.isCurrent
          }
        })
      : await tx.semester.create({
          data: {
            schoolId: school.id,
            code: semesterCode,
            name: textValue(semesterInput.name),
            year: Number(semesterInput.academicYear),
            term: textValue(semesterInput.term),
            isCurrent: !handbookOnlyImport && semesterInput.isCurrentCandidate === true
          }
        });

    const facultyByCode = new Map<string, any>();
    for (const facultyInput of records(payload.faculties)) {
      const code = textValue(facultyInput.code);
      const existing = await tx.faculty.findFirst({
        where: { schoolId: school.id, OR: [{ code }, { name: textValue(facultyInput.name) }] }
      });
      const faculty = existing
        ? await tx.faculty.update({ where: { id: existing.id }, data: { code, name: textValue(facultyInput.name) } })
        : await tx.faculty.create({ data: { schoolId: school.id, code, name: textValue(facultyInput.name) } });
      facultyByCode.set(code, faculty);
    }

    const majorByCode = new Map<string, any>();
    for (const majorInput of records(payload.majors)) {
      const code = textValue(majorInput.code);
      const faculty = facultyByCode.get(textValue(majorInput.facultyCode));
      if (!faculty) continue;
      const existing = await tx.major.findFirst({
        where: { schoolId: school.id, OR: [{ code }, { name: textValue(majorInput.name) }] }
      });
      const major = existing
        ? await tx.major.update({
            where: { id: existing.id },
            data: {
              code,
              facultyId: faculty.id,
              name: textValue(majorInput.name),
              degreeType: textValue(majorInput.degreeType) || "undergraduate"
            }
          })
        : await tx.major.create({
            data: {
              schoolId: school.id,
              facultyId: faculty.id,
              code,
              name: textValue(majorInput.name),
              degreeType: textValue(majorInput.degreeType) || "undergraduate"
            }
          });
      majorByCode.set(code, major);
    }
    const legacyMajorCleanup = await mergeLegacyBnbuMajorAliases(tx, school.id, majorByCode);

    const courseByCode = new Map<string, any>();
    for (const courseInput of records(payload.courses)) {
      const code = textValue(courseInput.code);
      const existingCourse = await tx.course.findUnique({ where: { schoolId_code: { schoolId: school.id, code } } });
      const incomingDescription = textValue(courseInput.description);
      const existingDescription = textValue(existingCourse?.description);
      const incomingCategoryTags = textValues(courseInput.categoryTags);
      const incomingSourceRefIds = textValues(courseInput.sourceRefIds);
      const incomingStatus = textValue(courseInput.status) || "active";
      const incomingEffectiveYear = courseEffectiveYearFromPayload(payload, courseInput);
      const incomingFingerprint = textValue(courseInput.fingerprint) || courseCatalogFingerprint(courseInput);
      const importData = {
        title: textValue(courseInput.title),
        description: incomingDescription || existingDescription,
        credits: numberValue(courseInput.credits),
        ownerUnit: toJson(courseCatalogImport && existingCourse?.ownerUnit ? existingCourse.ownerUnit : isPlainRecord(courseInput.ownerUnit) ? courseInput.ownerUnit : {}),
        categoryTags: courseCatalogImport && existingCourse
          ? mergeUniqueTextValues(existingCourse.categoryTags, incomingCategoryTags)
          : incomingCategoryTags,
        sourceRefIds: courseCatalogImport && existingCourse
          ? mergeUniqueTextValues(existingCourse.sourceRefIds, incomingSourceRefIds)
          : incomingSourceRefIds,
        courseType: "coursework",
        status: incomingStatus,
        source: "bnbu_import"
      };
      const updateData: Record<string, unknown> = {};
      if (existingCourse) {
        if (courseCatalogImport) {
          Object.assign(updateData, importData);
          const fieldDiffs = buildCourseFieldDiffsForCourse({
            importMode: "course_catalog",
            payload,
            existing: existingCourse,
            incoming: courseInput
          });
          for (const diff of fieldDiffs) {
            updateData[diff.field] = dbValueForCourseField(diff.field, resolvedCourseFieldValue(diff, approvalDecisions));
          }
          const existingYear = numberValue(existingCourse.catalogEffectiveYear);
          const canAdvanceCatalogYear = incomingEffectiveYear !== null && (!existingYear || incomingEffectiveYear >= existingYear);
          if (canAdvanceCatalogYear) {
            updateData.catalogEffectiveYear = incomingEffectiveYear;
            updateData.catalogValidThroughYear = null;
            updateData.catalogFingerprint = courseCatalogFingerprint({ ...existingCourse, ...updateData });
          }
        } else {
          const statusDiff = buildCourseFieldDiffsForCourse({
            importMode: textValue(payload.importMode) || "cohort_programme_handbook",
            payload,
            existing: existingCourse,
            incoming: { ...courseInput, status: incomingStatus }
          }).find((diff) => diff.field === "status");
          const statusDecision = statusDiff ? courseFieldDecision(approvalDecisions, code, "status") : null;
          if (statusDiff && statusDecision?.action) {
            updateData.status = dbValueForCourseField("status", resolvedCourseFieldValue(statusDiff, approvalDecisions));
          }
        }
      }
      const course = existingCourse
        ? Object.keys(updateData).length
          ? await tx.course.update({
              where: { id: existingCourse.id },
              data: updateData
            })
          : existingCourse
        : await tx.course.create({
            data: {
              schoolId: school.id,
              code,
              ...importData,
              ...(courseCatalogImport
                ? {
                    catalogEffectiveYear: incomingEffectiveYear,
                    catalogValidThroughYear: null,
                    catalogFingerprint: incomingFingerprint
                  }
                : {})
            }
          });
      courseByCode.set(code, course);
    }

    let retiredCourseCount = 0;
    if (courseCatalogImport) {
      const catalogCourses = await tx.course.findMany({
        where: { schoolId: school.id },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          source: true,
          sourceRefIds: true,
          catalogEffectiveYear: true,
          catalogValidThroughYear: true,
          catalogFingerprint: true
        }
      });
      const candidates = buildRetirementCandidates({
        payload,
        incomingCodes: records(payload.courses).map((course) => textValue(course.code)).filter(Boolean),
        existingCourses: catalogCourses
      });
      for (const candidate of candidates) {
        const decision = retirementDecision(approvalDecisions, candidate.code);
        if (decision?.action !== "retire") continue;
        const course = catalogCourses.find((item: any) => item.code === candidate.code);
        if (!course) continue;
        await tx.course.update({
          where: { id: course.id },
          data: {
            status: "inactive",
            catalogValidThroughYear: decision.validThroughYear ?? candidate.proposedValidThroughYear
          }
        });
        retiredCourseCount += 1;
      }
    }

    for (const offeringInput of records(payload.offerings)) {
      const course = courseByCode.get(textValue(offeringInput.courseCode));
      if (!course) continue;
      const sections = textValues(offeringInput.sections);
      const teacherNames = textValues(offeringInput.teacherNames).join(", ") || textValue(offeringInput.teacherName) || null;
      const sectionValues = sections.length ? sections : [textValue(offeringInput.section) || "Default"];
      for (const section of sectionValues) {
        const existing = await tx.courseOffering.findFirst({ where: { courseId: course.id, semesterId: semester.id, section } });
        const offering = existing
          ? await tx.courseOffering.update({
              where: { id: existing.id },
              data: {
                teacherName: teacherNames,
                section,
                sourceRefIds: textValues(offeringInput.sourceRefIds),
                status: textValue(offeringInput.status) || "active"
              }
            })
          : await tx.courseOffering.create({
              data: {
                courseId: course.id,
                semesterId: semester.id,
                teacherName: teacherNames,
                section,
                sourceRefIds: textValues(offeringInput.sourceRefIds),
                status: textValue(offeringInput.status) || "active"
              }
            });

        const syllabus = isPlainRecord(offeringInput.syllabus) ? offeringInput.syllabus : null;
        if (syllabus) {
          await tx.courseSyllabusMetadata.upsert({
            where: { courseOfferingId: offering.id },
            update: {
              teamworkRequirement: textValue(syllabus.teamworkRequirement) || "unknown",
              teamworkSummary: textValue(syllabus.teamworkSummary) || null,
              evidenceSourceRefIds: textValues(syllabus.evidenceSourceRefIds),
              confidence: textValue(syllabus.confidence) || "unknown",
              raw: toJson(syllabus)
            },
            create: {
              courseOfferingId: offering.id,
              teamworkRequirement: textValue(syllabus.teamworkRequirement) || "unknown",
              teamworkSummary: textValue(syllabus.teamworkSummary) || null,
              evidenceSourceRefIds: textValues(syllabus.evidenceSourceRefIds),
              confidence: textValue(syllabus.confidence) || "unknown",
              raw: toJson(syllabus)
            }
          });
        }

        await findOrCreateBoard(tx, offering.id, `${course.code} ${course.title}`);
      }
    }

    const incomingRules = records(payload.curriculumRules);
    const incomingRuleIds = incomingRules.map((rule) => textValue(rule.id)).filter(Boolean);
    const incomingRuleIdSet = new Set(incomingRuleIds);
    const incomingCohortYears = uniqueSortedNumbers(incomingRules.flatMap(cohortYearsForRule));
    let deactivatedRuleCount = 0;
    if (incomingRuleIds.length && incomingCohortYears.length) {
      const existingRulesForSemester = await tx.courseCurriculumRule.findMany({
        where: { semesterId: semester.id, status: "active" },
        select: { id: true, externalId: true, audience: true }
      });
      const ruleIdsToDeactivate = existingRulesForSemester
        .filter((rule: { externalId: string; audience: unknown }) => {
          if (incomingRuleIdSet.has(rule.externalId)) return false;
          const existingCohortYears = cohortYearsForRule({ audience: isPlainRecord(rule.audience) ? rule.audience : {} });
          return hasOverlappingNumber(existingCohortYears, incomingCohortYears);
        })
        .map((rule: { id: string }) => rule.id);
      deactivatedRuleCount = ruleIdsToDeactivate.length;
      if (ruleIdsToDeactivate.length) {
        await tx.courseCurriculumRule.updateMany({
          where: { id: { in: ruleIdsToDeactivate } },
          data: { status: "inactive" }
        });
      }
    }

    const autoJoinResults = [];
    const activatedBoards = [];
    let autoJoinSkippedOutsideTerm = 0;
    let autoJoinDeferredToSemesterActivation = 0;
    let rulesInAcademicTermContext = 0;
    for (const ruleInput of incomingRules) {
      const course = courseByCode.get(textValue(ruleInput.courseCode));
      if (!course) continue;
      const classification = textValue(ruleInput.classification);
      const studentAction = normalizedRuleStudentAction(ruleInput);
      const audience = isPlainRecord(ruleInput.audience) ? ruleInput.audience : {};
      const relativeTermCodes = relativeTermCodesForRule(ruleInput);
      const externalId = textValue(ruleInput.id);
      const matchesAcademicTerm = ruleMatchesAcademicTermContext(ruleInput, semester);
      if (matchesAcademicTerm) rulesInAcademicTermContext += 1;
      const rule = await tx.courseCurriculumRule.upsert({
        where: { semesterId_externalId: { semesterId: semester.id, externalId } },
        update: {
          importBatchId: batchId,
          courseId: course.id,
          classification,
          classificationLabel: textValue(ruleInput.classificationLabel) || bnbuClassificationLabels[classification as keyof typeof bnbuClassificationLabels] || classification,
          studentAction,
          audience: toJson(audience),
          relativeTermCodes,
          ownerUnit: toJson(isPlainRecord(ruleInput.ownerUnit) ? ruleInput.ownerUnit : {}),
          sourceRefIds: textValues(ruleInput.sourceRefIds),
          confidence: textValue(ruleInput.confidence) || "unknown",
          status: "active",
          raw: toJson(ruleInput)
        },
        create: {
          importBatchId: batchId,
          externalId,
          courseId: course.id,
          semesterId: semester.id,
          classification,
          classificationLabel: textValue(ruleInput.classificationLabel) || bnbuClassificationLabels[classification as keyof typeof bnbuClassificationLabels] || classification,
          studentAction,
          audience: toJson(audience),
          relativeTermCodes,
          ownerUnit: toJson(isPlainRecord(ruleInput.ownerUnit) ? ruleInput.ownerUnit : {}),
          sourceRefIds: textValues(ruleInput.sourceRefIds),
          confidence: textValue(ruleInput.confidence) || "unknown",
          status: "active",
          raw: toJson(ruleInput)
        }
      });

      if (!handbookOnlyImport && matchesAcademicTerm) {
        const offering = await findOrCreateAcademicTermOffering(tx, {
          courseId: course.id,
          semesterId: semester.id,
          sourceRefIds: textValues(ruleInput.sourceRefIds)
        });
        const board = await findOrCreateBoard(tx, offering.id, `${course.code} ${course.title}`);
        activatedBoards.push({ ruleId: externalId, boardId: board.id, courseCode: course.code });
      }

      if (studentAction === "default_join") {
        if (handbookOnlyImport) {
          autoJoinDeferredToSemesterActivation += 1;
          continue;
        }
        if (!matchesAcademicTerm) {
          autoJoinSkippedOutsideTerm += 1;
          continue;
        }
        const result = await applyDefaultJoinRule(tx, {
          ruleId: rule.id,
          schoolId: school.id,
          courseId: course.id,
          semesterId: semester.id,
          semesterYear: semester.year,
          semesterTerm: semester.term,
          classification,
          audience,
          relativeTermCodes
        });
        autoJoinResults.push({ ruleId: externalId, ...result });
      }
    }

    return {
      school,
      semester,
      validationSummary: summary,
      activatedBoards,
      autoJoinResults,
      deactivatedRuleCount,
      rulesInAcademicTermContext,
      autoJoinSkippedOutsideTerm,
      autoJoinDeferredToSemesterActivation,
      retiredCourseCount,
      legacyMajorCleanup
    };
  }, { timeout: 60000, maxWait: 10000 });
}
