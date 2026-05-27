import { academicTermForRelativeTermCode, curriculumRuleMatchesUser, ruleHasProgrammeScope, ruleMatchesUserRelativeTerm } from "@/lib/server/course-import/curriculum-matching";

import { countRows } from "@/lib/server/course-import/import-helpers";
import { prisma } from "@/lib/prisma";import { ApiError } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";

import { isPlainRecord, numberValues, textValue, textValues } from "@/lib/server/services/json-service";
import { writeAudit } from "@/lib/server/services/system-service";
import { publicUser, userInclude } from "@/lib/server/services/user-service";

export const courseInclude = {
  school: true,
  offerings: {
    include: {
      semester: true,
      boards: true
    }
  },
  mappings: {
    include: {
      major: true
    }
  }
};

export function isCourseReviewDeleted(comment: any) {
  return comment.status === "deleted" || Boolean(comment.deletedAt);
}

export function serializeCourseReviewComment(comment: any, childMap: Map<string | null, any[]>): any {
  const deleted = isCourseReviewDeleted(comment);
  return {
    id: comment.id,
    courseId: comment.courseId,
    userId: comment.userId,
    parentId: comment.parentId,
    body: deleted ? "评论已删除" : comment.body,
    status: comment.status,
    deleted,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: comment.user ? publicUser(comment.user) : null,
    replies: (childMap.get(comment.id) ?? []).map((reply) => serializeCourseReviewComment(reply, childMap))
  };
}

export async function getBoardForUser(boardId: string) {
  const board = await prisma.courseBoard.findUnique({
    where: { id: boardId },
    include: {
      courseOffering: {
        include: {
          course: true,
          semester: true
        }
      },
      memberships: true,
      sections: {
        include: {
          members: { where: { status: "active" }, select: { id: true } }
        },
        orderBy: { code: "asc" }
      }
    }
  });

  if (!board) throw new ApiError(404, "找不到这个课程板。");
  return board;
}

export function assertSameSchool(user: { schoolId: string | null }, schoolId?: string | null) {
  if (!user.schoolId || !schoolId || user.schoolId !== schoolId) {
    throw new ApiError(403, "只能查看同校范围内的数据。");
  }
}

export async function ensureBoardMember(userId: string, boardId: string) {
  const membership = await prisma.courseBoardMembership.findUnique({
    where: { userId_boardId: { userId, boardId } }
  });

  if (!membership || membership.status !== "active") {
    throw new ApiError(403, "请先加入这个 Course Board，再创建 Teamaking Post。");
  }
}

export async function commentsForCourse(courseId: string, page: number, pageSize: number) {
  const comments = await prisma.courseReviewComment.findMany({
    where: { courseId },
    include: { user: { include: userInclude } },
    orderBy: { createdAt: "asc" }
  });
  const childMap = new Map<string | null, any[]>();
  for (const comment of comments) {
    const key = comment.parentId ?? null;
    childMap.set(key, [...(childMap.get(key) ?? []), comment]);
  }
  const topLevel = childMap.get(null) ?? [];
  const total = topLevel.length;
  const safePageSize = Math.min(50, Math.max(1, pageSize || 10));
  const safePage = Math.max(1, page || 1);
  const visible = topLevel.slice((safePage - 1) * safePageSize, safePage * safePageSize);
  return {
    comments: visible.map((comment) => serializeCourseReviewComment(comment, childMap)),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize))
    }
  };
}

export async function courseJoinAdvisory(courseId: string, user: any, semester: any) {
  if (!semester || !user.profile) return null;
  const rules = await prisma.courseCurriculumRule.findMany({
    where: {
      courseId,
      status: "active",
      studentAction: { in: ["default_join", "recommend_only", "searchable_add"] }
    },
    include: { semester: true }
  });
  const scopedRules = rules.filter((rule) => ruleHasProgrammeScope(rule) && ruleMatchesUserRelativeTerm(rule, user, semester));
  if (!scopedRules.length) return null;
  const matchesUserProgramme = scopedRules.some((rule) => curriculumRuleMatchesUser(rule, user, semester));
  if (matchesUserProgramme) return null;
  return {
    level: "warning",
    message: "这门课在当前 admission 配置中更像其他专业/学院的专业课。已加入的课程不会因你更改专业而自动移除；如果你确实以自由选修、跨专业合作或兴趣方式加入，可以继续使用。"
  };
}

export function courseUsageSummary(course: any) {
  const rules = Array.isArray(course.curriculumRules) ? course.curriculumRules : [];
  const rows: any[] = rules.map((rule: any) => {
    const audience = isPlainRecord(rule.audience) ? rule.audience : {};
    return {
      id: rule.id,
      externalId: rule.externalId,
      semester: rule.semester,
      classification: rule.classification,
      studentAction: rule.studentAction,
      cohortYears: numberValues(audience.cohortYears),
      entryTerm: textValue(audience.entryTerm) || "Fall",
      majorCodes: textValues(audience.majorCodes),
      facultyCodes: textValues(audience.facultyCodes),
      allMajors: audience.allMajors === true,
      relativeTermCodes: textValues(rule.relativeTermCodes),
      sourceRefIds: textValues(rule.sourceRefIds)
    };
  });
  const academicTermRows = rows.flatMap((row) => {
    const audienceCodes = row.allMajors
      ? ["ALL majors"]
      : row.majorCodes.length
        ? row.majorCodes
        : row.facultyCodes.length
          ? row.facultyCodes.map((code: string) => `Faculty ${code}`)
          : ["Unspecified"];
    return row.cohortYears.flatMap((entryYear: number) =>
      row.relativeTermCodes.flatMap((relativeTermCode: string) => {
        const academicTerm = academicTermForRelativeTermCode(entryYear, row.entryTerm, relativeTermCode);
        return audienceCodes.map((audienceCode: string) => ({
          ruleId: row.id,
          externalId: row.externalId,
          entryYear,
          entryTerm: row.entryTerm,
          audience: audienceCode,
          relativeTermCode,
          academicTermCode: academicTerm?.code ?? null,
          academicTermLabel: academicTerm?.label ?? "Unknown",
          classification: row.classification,
          studentAction: row.studentAction
        }));
      })
    );
  }).sort((a, b) =>
    String(a.academicTermCode ?? "").localeCompare(String(b.academicTermCode ?? "")) ||
    String(a.entryYear).localeCompare(String(b.entryYear)) ||
    a.audience.localeCompare(b.audience) ||
    a.relativeTermCode.localeCompare(b.relativeTermCode)
  );
  return {
    totalRules: rows.length,
    cohortYears: countRows(rows, (row) => row.cohortYears.map(String)),
    majors: countRows(rows, (row) => row.majorCodes.length ? row.majorCodes : row.allMajors ? "ALL" : "Unspecified"),
    relativeTerms: countRows(rows, (row) => row.relativeTermCodes.length ? row.relativeTermCodes : "Unspecified"),
    academicTerms: countRows(academicTermRows, (row) => row.academicTermLabel),
    classifications: countRows(rows, (row) => row.classification),
    academicTermRows: academicTermRows.slice(0, 200),
    rules: rows.slice(0, 80)
  };
}

export function serializeAdminCourse(course: any) {
  return {
    ...course,
    usage: courseUsageSummary(course)
  };
}

export function normalizeSectionCode(value: unknown) {
  const code = textValue(value) || "1001";
  if (!/^10\d{2}$/.test(code)) {
    throw new ApiError(400, "Section 必须是 10xx 格式；如果课程没有多个 section，请使用默认 1001。");
  }
  return code;
}

export async function findOrCreateBoardSection(tx: any, boardId: string, sectionCode: string, userId?: string | null, source = "student_created") {
  const existing = await tx.courseBoardSection.findUnique({
    where: { boardId_code: { boardId, code: sectionCode } }
  });
  if (existing) return existing;
  return tx.courseBoardSection.create({
    data: {
      boardId,
      code: sectionCode,
      source,
      createdByUserId: userId ?? null
    }
  });
}

export async function mergeCourses(sourceCourseId: string, targetCourseId: string, adminUserId: string, adminNote?: string) {
  if (sourceCourseId === targetCourseId) {
    throw new ApiError(400, "源课程和目标课程不能相同。", ERROR_CODES.COURSE_MERGE_INVALID);
  }

  const result = await prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.course.findUnique({ where: { id: sourceCourseId } }),
      tx.course.findUnique({ where: { id: targetCourseId } })
    ]);
    if (!source || !target) throw new ApiError(404, "找不到源课程或目标课程。", ERROR_CODES.COURSE_MERGE_INVALID);
    if (source.schoolId !== target.schoolId) {
      throw new ApiError(400, "只能合并同一学校下的课程。", ERROR_CODES.COURSE_MERGE_INVALID, { sourceCourseId, targetCourseId });
    }

    const summary = {
      offeringsMoved: 0,
      offeringsSkipped: 0,
      boardsMovedToDuplicateOffering: 0,
      mappingsMoved: 0,
      mappingsSkipped: 0,
      rulesMoved: 0,
      rulesSkipped: 0,
      portfoliosMoved: 0,
      submissionsMoved: 0
    };

    const offerings = await tx.courseOffering.findMany({ where: { courseId: source.id } });
    for (const offering of offerings) {
      const duplicate = await tx.courseOffering.findFirst({
        where: {
          courseId: target.id,
          semesterId: offering.semesterId,
          section: offering.section
        }
      });
      if (duplicate) {
        const movedBoards = await tx.courseBoard.updateMany({
          where: { courseOfferingId: offering.id },
          data: { courseOfferingId: duplicate.id }
        });
        await tx.teamakingPost.updateMany({
          where: { courseOfferingId: offering.id },
          data: { courseOfferingId: duplicate.id }
        });
        await tx.courseOffering.update({ where: { id: offering.id }, data: { status: "archived" } });
        summary.offeringsSkipped += 1;
        summary.boardsMovedToDuplicateOffering += movedBoards.count;
      } else {
        await tx.courseOffering.update({ where: { id: offering.id }, data: { courseId: target.id } });
        summary.offeringsMoved += 1;
      }
    }

    const mappings = await tx.courseMajorMapping.findMany({ where: { courseId: source.id } });
    for (const mapping of mappings) {
      const duplicate = await tx.courseMajorMapping.findUnique({
        where: {
          courseId_majorId_recommendedGrade: {
            courseId: target.id,
            majorId: mapping.majorId,
            recommendedGrade: mapping.recommendedGrade
          }
        }
      });
      if (duplicate) {
        await tx.courseMajorMapping.delete({ where: { id: mapping.id } });
        summary.mappingsSkipped += 1;
      } else {
        await tx.courseMajorMapping.update({ where: { id: mapping.id }, data: { courseId: target.id } });
        summary.mappingsMoved += 1;
      }
    }

    const rules = await tx.courseCurriculumRule.findMany({ where: { courseId: source.id } });
    for (const rule of rules) {
      const duplicate = await tx.courseCurriculumRule.findFirst({
        where: { courseId: target.id, semesterId: rule.semesterId, externalId: rule.externalId }
      });
      if (duplicate) {
        await tx.courseCurriculumRule.update({ where: { id: rule.id }, data: { status: "archived" } });
        summary.rulesSkipped += 1;
      } else {
        await tx.courseCurriculumRule.update({ where: { id: rule.id }, data: { courseId: target.id } });
        summary.rulesMoved += 1;
      }
    }

    const portfolios = await tx.portfolioItem.updateMany({
      where: { relatedCourseId: source.id },
      data: { relatedCourseId: target.id }
    });
    summary.portfoliosMoved = portfolios.count;

    const submissions = await tx.userSubmittedCourse.updateMany({
      where: { matchedCourseId: source.id },
      data: { matchedCourseId: target.id }
    });
    summary.submissionsMoved = submissions.count;

    const archivedSource = await tx.course.update({
      where: { id: source.id },
      data: {
        status: "archived",
        mergedIntoCourseId: target.id,
        mergedAt: new Date(),
        mergeNote: adminNote ?? `Merged into ${target.code}`
      }
    });

    return { source: archivedSource, target, summary };
  });

  await writeAudit(adminUserId, "admin.courses.merge", "Course", sourceCourseId, null, {
    targetCourseId,
    adminNote,
    summary: result.summary
  });
  return result;
}
