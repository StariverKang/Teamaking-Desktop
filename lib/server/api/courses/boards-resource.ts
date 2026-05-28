import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, optionalString, readBody, stringArray } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { demoBoardById, demoPeople, isDemoUser } from "@/lib/demo-data";
import { createDemoPost, demoPostsForBoard } from "@/lib/demo-store";
import { activeCourseBoardParticipationWhere, isCourseBoardParticipationSource, visibleCourseBoardMemberships } from "@/lib/course-board-participation";
import { profileInclude, publicUser } from "@/lib/server/services/user-service";
import { operationLog } from "@/lib/server/services/system-service";
import { getBoardForUser, assertSameSchool, ensureCourseBoardParticipation, normalizeSectionCode, findOrCreateBoardSection } from "@/lib/server/services/course-service";
import { enrichPostForViewer } from "@/lib/server/services/social-service";

export async function handleBoards(method: string, path: string[], request: NextRequest) {
  const boardId = path[1];
  if (!boardId) throw new ApiError(404, "缺少课程板编号。");

  if (method === "GET" && path.length === 2) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      const board = demoBoardById(boardId);
      return ok({ board, isJoined: true, memberCount: demoPeople(boardId).length, sections: [{ code: "1001", memberCount: demoPeople(boardId).length }], myMembership: { sectionCode: "1001" } });
    }

    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const activeMemberships = visibleCourseBoardMemberships(board.memberships);
    const isJoined = user
      ? activeMemberships.some((membership) => membership.userId === user.id)
      : false;
    const myMembership = activeMemberships.find((membership) => membership.userId === user.id) ?? null;
    const sectionCounts = new Map<string, number>();
    activeMemberships.forEach((membership) => {
      if (membership.sectionCode) sectionCounts.set(membership.sectionCode, (sectionCounts.get(membership.sectionCode) ?? 0) + 1);
    });
    const sections = board.sections
      .map((section) => ({
        id: section.id,
        code: section.code,
        source: section.source,
        memberCount: sectionCounts.get(section.code) ?? 0
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return ok({ board, isJoined, memberCount: activeMemberships.length, myMembership, sections });
  }

  if (method === "POST" && path[2] === "join") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({
        message: "现在只有发布 Teamaking Post 或发送 TeamUp Interest 后，才会算作参与 Course Board。"
      });
    }
    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    return ok({
      board,
      message: "已打开 Course Board。只有在这里发布 Teamaking Post，或对这里的 Post 发送 TeamUp Interest 后，才会出现在 My current Course Boards / Course People。"
    });
  }

  if (method === "PATCH" && path[2] === "membership-section") {
    const user = await requireUser();
    const body = await readBody(request);
    const sectionCode = normalizeSectionCode(body.sectionCode);
    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const existing = await prisma.courseBoardMembership.findUnique({ where: { userId_boardId: { userId: user.id, boardId } } });
    if (!existing || existing.status !== "active" || !isCourseBoardParticipationSource(existing.source)) throw new ApiError(403, "请先发布 Teamaking Post 或发送 TeamUp Interest，再选择 section。");
    const membership = await prisma.$transaction(async (tx) => {
      const section = await findOrCreateBoardSection(tx, boardId, sectionCode, user.id);
      return tx.courseBoardMembership.update({
        where: { userId_boardId: { userId: user.id, boardId } },
        data: { sectionId: section.id, sectionCode }
      });
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_board.section.change",
      targetType: "CourseBoardMembership",
      targetId: membership.id,
      method,
      path: request.nextUrl.pathname,
      summary: { boardId, sectionCode }
    });
    return ok({ membership, message: `已切换到 ${sectionCode} section。` });
  }

  if (method === "DELETE" && path[2] === "leave") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ message: "本地视觉演示模式已模拟离开这个 Course Board。" });
    }

    const membership = await prisma.courseBoardMembership.findUnique({
      where: { userId_boardId: { userId: user.id, boardId } }
    });

    if (membership?.source.startsWith("auto_")) {
      await prisma.courseBoardMembership.update({
        where: { userId_boardId: { userId: user.id, boardId } },
        data: { status: "opted_out", leftAt: new Date() }
      });
      await operationLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: "course_board.leave",
        targetType: "CourseBoard",
        targetId: boardId,
        method,
        path: request.nextUrl.pathname,
        summary: { source: membership.source, status: "opted_out" }
      });
      return ok({
        message: "已隐藏这个课程推荐。若这是课程配置错误，可在 Support Tickets 提交 course_config_error 工单反馈。"
      });
    }

    await prisma.courseBoardMembership.updateMany({
      where: { userId: user.id, boardId },
      data: { status: "left", leftAt: new Date() }
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_board.leave",
      targetType: "CourseBoard",
      targetId: boardId,
      method,
      path: request.nextUrl.pathname,
      summary: { source: membership?.source ?? "manual", status: "left" }
    });
    return ok({ message: "已离开这个 Course Board。" });
  }

  if (method === "GET" && path[2] === "open-to-team") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ posts: demoPostsForBoard(boardId, user.id) });
    }

    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const posts = await prisma.teamakingPost.findMany({
      where: { boardId, status: "open" },
      include: {
        board: { include: { courseOffering: { include: { course: true, semester: true } } } },
        user: {
          include: {
            profile: { include: profileInclude },
            contactInfo: true,
            portfolioItems: true,
            skills: { include: { skill: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return ok({ posts: await Promise.all(posts.map((post) => enrichPostForViewer(post, user))) });
  }

  if (method === "GET" && path[2] === "people") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ people: demoPeople(boardId) });
    }

    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const members = await prisma.courseBoardMembership.findMany({
      where: activeCourseBoardParticipationWhere({ boardId }),
      include: {
        section: true,
        user: {
          include: {
            profile: { include: profileInclude },
            contactInfo: true,
            skills: { include: { skill: true } }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });

    return ok({
      people: members.map((membership) => ({
        ...membership,
        user: publicUser(membership.user)
      }))
    });
  }

  if (method === "POST" && path[2] === "teamaking-posts") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      const body = await readBody(request);
      return created({ post: createDemoPost(boardId, user, body), message: "本地共享 demo state 已创建 Teamaking Post。" });
    }

    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);

    const body = await readBody(request);
    const result = await prisma.$transaction(async (tx) => {
      const membership = await ensureCourseBoardParticipation(tx, {
        userId: user.id,
        boardId,
        source: "teamaking_post",
        sectionCode: optionalString(body.sectionCode) ?? "1001"
      });
      const post = await tx.teamakingPost.create({
        data: {
          boardId,
          userId: user.id,
          courseOfferingId: board.courseOfferingId,
          title: assertString(body.title, "title"),
          strengths: stringArray(body.strengths),
          contributionTypes: stringArray(body.contributionTypes),
          expectedOutcome: assertString(body.expectedOutcome, "expectedOutcome"),
          portfolioItemIds: stringArray(body.portfolioItemIds),
          visibility: optionalString(body.visibility) ?? "same_course_board"
        }
      });
      return { membership, post };
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "teamaking_posts.create",
      targetType: "TeamakingPost",
      targetId: result.post.id,
      method,
      path: request.nextUrl.pathname,
      summary: { boardId, title: result.post.title, membershipId: result.membership.id }
    });
    return created({ post: result.post, membership: result.membership, message: "Teamaking Post 已发布；你现在会出现在这个 Course Board 的 Course People 和 Dashboard 当前课程板中。" });
  }

  throw new ApiError(404, "找不到课程板接口。");
}
