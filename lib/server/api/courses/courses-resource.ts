import { NextRequest } from "next/server";
import { curriculumRuleMatchesUser, relativeTermCodeForProfile } from "@/lib/server/course-import/curriculum-matching";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, optionalString, readBody } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { demoCourseById, demoCourses, isDemoUser } from "@/lib/demo-data";
import { activeCourseBoardParticipationWhere } from "@/lib/course-board-participation";
import { userInclude, publicUser, scoreCourseMatch } from "@/lib/server/services/user-service";
import { courseInclude, serializeCourseReviewComment, assertSameSchool, commentsForCourse, courseJoinAdvisory } from "@/lib/server/services/course-service";
import { operationLog } from "@/lib/server/services/system-service";
import { buildOfficialAcademicLinks, officialAcademicLinksForUser } from "@/lib/server/services/official-links-service";

export async function handleCourses(method: string, path: string[], request: NextRequest) {
  if (method === "GET" && path[1] === "recommended") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({
        officialLinks: buildOfficialAcademicLinks(user),
        courses: demoCourses.slice(0, 3).map((course) => ({
          ...course,
          recommendation: {
            recommendedGrade: user.profile?.grade ?? "Year 2",
            isRequired: course.code.startsWith("COM"),
            reason: "本地视觉演示：根据 demo 学校、专业和年级推荐"
          }
        }))
      });
    }

    const majorId = user.profile?.majorId;
    const grade = user.profile?.grade;
    const currentSemester = user.schoolId
      ? await prisma.semester.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } })
      : null;
    const officialLinks = await officialAcademicLinksForUser(user);

    if (currentSemester) {
      const rules = await prisma.courseCurriculumRule.findMany({
        where: {
          status: "active",
          studentAction: { in: ["default_join", "recommend_only"] },
          course: { schoolId: user.schoolId ?? "", status: "active" }
        },
        include: { semester: true, course: { include: courseInclude } },
        orderBy: [{ studentAction: "asc" }, { classification: "asc" }]
      });
      const matchedRules = rules.filter((rule) => {
        return curriculumRuleMatchesUser(rule, user, currentSemester);
      });
      if (matchedRules.length) {
        const seenCourseIds = new Set<string>();
        return ok({
          officialLinks,
          academicContext: {
            semester: currentSemester,
            relativeTermCode: relativeTermCodeForProfile(user.profile, currentSemester)
          },
          courses: matchedRules
            .filter((rule) => {
              if (seenCourseIds.has(rule.courseId)) return false;
              seenCourseIds.add(rule.courseId);
              return true;
            })
            .map((rule) => ({
              ...rule.course,
              recommendation: {
                recommendedGrade: grade ?? "未填写年级",
                isRequired: rule.studentAction === "default_join",
                classification: rule.classification,
                classificationLabel: rule.classificationLabel,
                studentAction: rule.studentAction,
                reason: rule.studentAction === "default_join" ? "根据 BNBU 课程配置重点推荐" : "根据 BNBU 课程配置推荐"
              }
            }))
        });
      }
    }

    const mappings = majorId
      ? await prisma.courseMajorMapping.findMany({
          where: {
            majorId,
            course: { status: "active" },
            ...(grade ? { recommendedGrade: grade } : {})
          },
          include: { course: { include: courseInclude } },
          orderBy: { isRequired: "desc" }
        })
      : [];

    return ok({
      officialLinks,
      courses: mappings.map((mapping) => ({
        ...mapping.course,
        recommendation: {
          recommendedGrade: mapping.recommendedGrade,
          isRequired: mapping.isRequired,
          reason: "根据你的学校、专业、年级和当前学期推荐"
        }
      }))
    });
  }

  if (method === "GET" && path[1] === "my") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      const course = demoCourses[0];
      return ok({
        memberships: [
          {
            id: "demo-membership-current",
            source: "manual",
            status: "active",
            sectionCode: "1001",
            joinedAt: new Date(),
            board: course.offerings?.[0]?.boards?.[0]
              ? {
                  ...course.offerings[0].boards[0],
                  courseOffering: {
                    ...course.offerings[0],
                    course,
                    semester: course.offerings[0].semester
                  }
                }
              : null
          }
        ],
        officialLinks: buildOfficialAcademicLinks(user)
      });
    }

    const currentSemester = user.schoolId
      ? await prisma.semester.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } })
      : null;
    const rows = await prisma.courseBoardMembership.findMany({
      where: activeCourseBoardParticipationWhere({ userId: user.id }),
      include: {
        board: {
          include: {
            courseOffering: {
              include: {
                semester: true,
                course: { include: courseInclude }
              }
            }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });
    const memberships = await Promise.all(rows.map(async (membership) => ({
      ...membership,
      advisory: await courseJoinAdvisory(membership.board.courseOffering.courseId, user, currentSemester)
    })));
    return ok({
      memberships,
      officialLinks: await officialAcademicLinksForUser(user),
      academicContext: currentSemester
        ? { semester: currentSemester, relativeTermCode: relativeTermCodeForProfile(user.profile, currentSemester) }
        : null
    });
  }

  if (method === "GET" && path[1] === "search") {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10) || 10));
    const start = (page - 1) * pageSize;
    const user = await requireUser();
    if (isDemoUser(user)) {
      const courses = demoCourses
        .map((course) => ({ ...course, ...scoreCourseMatch(course, q) }))
        .filter((course) => !q || course.score > 0)
        .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
      return ok({
        courses: courses.slice(start, start + pageSize),
        pagination: {
          page,
          pageSize,
          total: courses.length,
          totalPages: Math.max(1, Math.ceil(courses.length / pageSize))
        }
      });
    }

    const rawCourses = await prisma.course.findMany({
      where: {
        schoolId: user.schoolId ?? "",
        status: "active",
      },
      include: courseInclude,
      orderBy: { code: "asc" },
    });
    const courses = rawCourses
      .map((course) => ({ ...course, ...scoreCourseMatch(course, q) }))
      .filter((course) => !q || course.score > 0)
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));

    return ok({
      courses: courses.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total: courses.length,
        totalPages: Math.max(1, Math.ceil(courses.length / pageSize))
      }
    });
  }

  if (method === "POST" && path[1] && path[2] === "join") {
    const user = await requireUser();
    const courseId = path[1];
    if (isDemoUser(user)) {
      const course = demoCourseById(courseId);
      const board = course.offerings?.[0]?.boards?.[0];
      return ok({
        board,
        message: "本地视觉演示模式已打开 Course Board。发布 Post 或发送 TeamUp 后才算加入。"
      });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== "active") throw new ApiError(404, "找不到可加入的课程。");
    assertSameSchool(user, course.schoolId);

    const currentSemester = await prisma.semester.findFirst({
      where: { schoolId: course.schoolId, isCurrent: true }
    });
    if (!currentSemester) {
      throw new ApiError(400, "当前学校还没有配置 current semester，暂时无法创建 Course Board。");
    }

    const result = await prisma.$transaction(async (tx) => {
      const offeringWithBoard = await tx.courseOffering.findFirst({
        where: {
          courseId: course.id,
          semesterId: currentSemester.id,
          status: { not: "cancelled" },
          boards: { some: { status: "active" } }
        },
        include: { boards: { where: { status: "active" }, orderBy: { createdAt: "asc" }, take: 1 } },
        orderBy: { createdAt: "asc" }
      });
      let board = offeringWithBoard?.boards?.[0] ?? null;
      let offeringId = offeringWithBoard?.id ?? "";

      if (!board) {
        const reusableOffering = await tx.courseOffering.findFirst({
          where: {
            courseId: course.id,
            semesterId: currentSemester.id,
            status: { not: "cancelled" }
          },
          orderBy: { createdAt: "asc" }
        });
        const offering = reusableOffering ?? await tx.courseOffering.create({
          data: {
            courseId: course.id,
            semesterId: currentSemester.id,
            teacherName: null,
            section: null,
            sourceRefIds: ["manual_search_join"],
            status: "active"
          }
        });
        offeringId = offering.id;
        board = await tx.courseBoard.findFirst({
          where: { courseOfferingId: offeringId, status: "active" },
          orderBy: { createdAt: "asc" }
        });
        if (!board) {
          board = await tx.courseBoard.create({
            data: {
              courseOfferingId: offeringId,
              title: `${course.code} ${course.title}`,
              rules: "这是 TEAMAKING 平台内的 Course Board，可用于自由选修、跨专业合作或兴趣组队；只有发布 Post 或发送 TeamUp 后才会进入 Course People，不代表官方选课名单。"
            }
          });
        }
      }

      return { board };
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_board.open",
      targetType: "Course",
      targetId: course.id,
      method,
      path: request.nextUrl.pathname,
      summary: {
        courseCode: course.code,
        boardId: result.board.id,
        reason: "student_opened_course_board"
      }
    });

    return ok({
      board: result.board,
      message: `已打开 ${result.board.title}。只有发布 Teamaking Post 或发送 TeamUp Interest 后，才会加入这个 Course Board。`
    });
  }

  if (method === "POST" && path[1] === "submit") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return created({
        ticket: {
          id: "demo-ticket-created",
          submittedByUserId: user.id,
          email: user.email,
          category: "missing_course",
          status: "open"
        },
        message: "本地视觉演示模式已模拟创建缺失课程工单。"
      });
    }

    const body = await readBody(request);
    const ticket = await prisma.supportTicket.create({
      data: {
        submittedByUserId: user.id,
        email: user.email,
        category: "missing_course",
        title: `缺失课程：${assertString(body.code, "code")} ${assertString(body.title, "title")}`,
        description: [
          `课程代码：${body.code}`,
          `课程名称：${body.title}`,
          optionalString(body.teacherName) ? `任课老师：${body.teacherName}` : null,
          optionalString(body.semesterText) ? `学期：${body.semesterText}` : null
        ]
          .filter(Boolean)
          .join("\n"),
        status: "open"
      }
    });

    return created({ ticket, message: "已转为管理员工单，后续不再走课程审核流程。" });
  }

  if (path[1] && path[2] === "comments") {
    const user = await requireUser();
    const courseId = path[1];

    if (isDemoUser(user)) {
      if (method === "GET") {
        return ok({
          comments: [],
          pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
          message: "本地视觉演示模式暂未保存课程评论。"
        });
      }
      if (method === "POST") {
        const body = await readBody(request);
        const text = assertString(body.body, "body").trim();
        return created({
          comment: {
            id: `demo-course-comment-${Date.now()}`,
            courseId,
            userId: user.id,
            parentId: null,
            body: text,
            status: "active",
            user: publicUser(user),
            replies: [],
            createdAt: new Date()
          },
          message: "本地视觉演示模式已模拟发布课程评价。"
        });
      }
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new ApiError(404, "找不到这门课程。");
    assertSameSchool(user, course.schoolId);

    if (method === "GET") {
      const page = Number(request.nextUrl.searchParams.get("page") ?? "1") || 1;
      const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "10") || 10;
      return ok(await commentsForCourse(courseId, page, pageSize));
    }

    if (method === "POST") {
      const body = await readBody(request);
      const text = assertString(body.body, "body").trim();
      if (!text) throw new ApiError(400, "评论内容不能为空。");
      if (text.length > 2000) throw new ApiError(400, "评论内容不能超过 2000 字。");
      const comment = await prisma.courseReviewComment.create({
        data: {
          courseId,
          userId: user.id,
          body: text
        },
        include: { user: { include: userInclude } }
      });
      await operationLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: "course_review.comment.create",
        targetType: "CourseReviewComment",
        targetId: comment.id,
        method,
        path: request.nextUrl.pathname,
        summary: { courseId }
      });
      return created({ comment: serializeCourseReviewComment(comment, new Map()), message: "课程评价已发布。" });
    }
  }

  if (method === "GET" && path[1]) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ course: demoCourseById(path[1]), officialLinks: buildOfficialAcademicLinks(user) });
    }

    const course = await prisma.course.findUnique({
      where: { id: path[1] },
      include: courseInclude
    });

    if (!course) throw new ApiError(404, "找不到这门课程。");
    assertSameSchool(user, course.schoolId);
    return ok({ course, officialLinks: await officialAcademicLinksForUser(user) });
  }

  throw new ApiError(404, "找不到课程接口。");
}
