import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, optionalString, readBody, stringArray } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { demoBoardById, demoPeople, isDemoUser } from "@/lib/demo-data";
import { createDemoPost, demoPostsForBoard } from "@/lib/demo-store";
import { profileInclude, publicUser } from "@/lib/server/services/user-service";
import { operationLog } from "@/lib/server/services/system-service";
import { getBoardForUser, assertSameSchool, ensureBoardMember, normalizeSectionCode, findOrCreateBoardSection } from "@/lib/server/services/course-service";
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
    const activeMemberships = board.memberships.filter((membership) => membership.status === "active");
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
        memberCount: sectionCounts.get(section.code) ?? section.members.length
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return ok({ board, isJoined, memberCount: activeMemberships.length, myMembership, sections });
  }

  if (method === "POST" && path[2] === "join") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({
        membership: { id: "demo-membership-current", userId: user.id, boardId },
        message: "本地视觉演示模式已模拟加入 Course Board。"
      });
    }

    const body = await readBody(request);
    const sectionCode = normalizeSectionCode(body.sectionCode);
    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const membership = await prisma.$transaction(async (tx) => {
      const section = await findOrCreateBoardSection(tx, boardId, sectionCode, user.id);
      return tx.courseBoardMembership.upsert({
        where: { userId_boardId: { userId: user.id, boardId } },
        update: { status: "active", source: "manual", sectionId: section.id, sectionCode, leftAt: null },
        create: {
          userId: user.id,
          boardId,
          sectionId: section.id,
          sectionCode,
          source: "manual",
          status: "active"
        }
      });
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_board.join",
      targetType: "CourseBoard",
      targetId: boardId,
      method,
      path: request.nextUrl.pathname,
      summary: { sectionCode, membershipId: membership.id }
    });
    return ok({
      membership,
      message: `你已加入 ${board.title} 的 ${sectionCode} section。Course People 只代表平台内自选加入，不代表官方选课名单。`
    });
  }

  if (method === "PATCH" && path[2] === "membership-section") {
    const user = await requireUser();
    const body = await readBody(request);
    const sectionCode = normalizeSectionCode(body.sectionCode);
    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const existing = await prisma.courseBoardMembership.findUnique({ where: { userId_boardId: { userId: user.id, boardId } } });
    if (!existing || existing.status !== "active") throw new ApiError(403, "请先加入这个 Course Board，再选择 section。");
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
        message: "已退出这个默认加入的 Course Board。若这是课程配置错误，可在 Support Tickets 提交 course_config_error 工单反馈。"
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
      where: { boardId, status: "active" },
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
    await ensureBoardMember(user.id, boardId);

    const body = await readBody(request);
    const post = await prisma.teamakingPost.create({
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

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "teamaking_posts.create",
      targetType: "TeamakingPost",
      targetId: post.id,
      method,
      path: request.nextUrl.pathname,
      summary: { boardId, title: post.title }
    });
    return created({ post });
  }

  throw new ApiError(404, "找不到课程板接口。");
}
