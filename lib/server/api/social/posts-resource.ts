import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, optionalString, readBody, stringArray } from "@/lib/http";
import { isAdminRole, requireUser } from "@/lib/session";
import { contactSnapshot } from "@/lib/contact";
import { demoPosts, isDemoUser } from "@/lib/demo-data";
import { createDemoTeamUpInterest, demoInterestsForPost, demoPostById } from "@/lib/demo-store";
import { profileInclude, userInclude } from "@/lib/server/services/user-service";
import { operationLog } from "@/lib/server/services/system-service";
import { assertSameSchool, ensureBoardMember } from "@/lib/server/services/course-service";
import { contactContextForViewer, publicUserForViewer, enrichPostForViewer } from "@/lib/server/services/social-service";

export async function handleTeamakingPosts(method: string, path: string[], request: NextRequest) {
  const postId = path[1];
  if (!postId) throw new ApiError(404, "缺少 Teamaking Post 编号。");

  const include = {
    board: { include: { courseOffering: { include: { course: true, semester: true } } } },
    user: {
      include: {
        profile: { include: profileInclude },
        contactInfo: true,
        portfolioItems: { include: { relatedCourse: true } },
        skills: { include: { skill: true } }
      }
    }
  };

  if (method === "GET" && path.length === 2) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ post: demoPostById(postId, user.id) });
    }

    const post = await prisma.teamakingPost.findUnique({
      where: { id: postId },
      include
    });
    if (!post) throw new ApiError(404, "找不到这个 Teamaking Post。");
    assertSameSchool(user, post.board.courseOffering.course.schoolId);
    if (post.visibility === "same_course_board") {
      await ensureBoardMember(user.id, post.boardId);
    }
    return ok({ post: await enrichPostForViewer(post, user) });
  }

  if (method === "GET" && path[2] === "interests") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ interests: demoInterestsForPost(postId, user) });
    }

    const post = await prisma.teamakingPost.findUnique({ where: { id: postId }, include: { board: { include: { courseOffering: { include: { course: true } } } } } });
    if (!post) throw new ApiError(404, "找不到这个 Teamaking Post。");
    assertSameSchool(user, post.board.courseOffering.course.schoolId);
    if (post.userId !== user.id && !isAdminRole(user.role)) {
      throw new ApiError(403, "只有 Teamaking Post 发布者可以查看收到的 TeamUp Interest。");
    }

    if (post.userId === user.id) {
      await prisma.teamUpRequest.updateMany({
        where: { postId, receiverId: user.id, status: "sent" },
        data: { status: "viewed" }
      });
    }

    const interests = await prisma.teamUpRequest.findMany({
      where: { postId, senderId: { not: user.id }, status: { not: "deleted" } },
      include: {
        post: { include: { board: { include: { courseOffering: { include: { course: true, semester: true } } } } } },
        sender: { include: { ...userInclude, portfolioItems: { include: { relatedCourse: true } } } },
        receiver: { include: { profile: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const enriched = await Promise.all(interests.map(async (interest) => ({
      ...interest,
      post: await enrichPostForViewer(interest.post, user),
      sender: await publicUserForViewer(interest.sender, user, postId)
    })));
    return ok({ interests: enriched });
  }

  if (method === "PATCH" && path.length === 2) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ post: { ...(demoPosts().find((post) => post.id === postId) ?? demoPosts()[0]), id: postId }, message: "本地视觉演示模式已模拟修改 Teamaking Post。" });
    }

    const existing = await prisma.teamakingPost.findUnique({ where: { id: postId } });
    if (!existing) throw new ApiError(404, "找不到这个 Teamaking Post。");
    if (existing.userId !== user.id && !isAdminRole(user.role)) {
      throw new ApiError(403, "只有发布者或管理员可以修改这个 Teamaking Post。");
    }

    const body = await readBody(request);
    const updateData: any = {
      title: optionalString(body.title) ?? existing.title,
      status: optionalString(body.status) ?? existing.status,
      expectedOutcome: optionalString(body.expectedOutcome) ?? existing.expectedOutcome,
      showWechatId: typeof body.showWechatId === "boolean" ? body.showWechatId : existing.showWechatId,
      showWechatQr: typeof body.showWechatQr === "boolean" ? body.showWechatQr : existing.showWechatQr,
      showLinkedin: typeof body.showLinkedin === "boolean" ? body.showLinkedin : existing.showLinkedin,
      showPersonalEmail: typeof body.showPersonalEmail === "boolean" ? body.showPersonalEmail : existing.showPersonalEmail,
      visibility: optionalString(body.visibility) ?? existing.visibility
    };

    if (Array.isArray(body.strengths)) {
      updateData.strengths = stringArray(body.strengths);
    }
    if (Array.isArray(body.contributionTypes)) {
      updateData.contributionTypes = stringArray(body.contributionTypes);
    }
    if (Array.isArray(body.portfolioItemIds)) {
      updateData.portfolioItemIds = stringArray(body.portfolioItemIds);
    }

    const post = await prisma.teamakingPost.update({
      where: { id: postId },
      data: updateData
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "teamaking_posts.patch",
      targetType: "TeamakingPost",
      targetId: post.id,
      method,
      path: request.nextUrl.pathname,
      summary: { status: post.status, title: post.title }
    });
    return ok({ post });
  }

  if (method === "DELETE" && path.length === 2) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ message: "本地视觉演示模式已模拟删除 Teamaking Post。" });
    }

    const existing = await prisma.teamakingPost.findUnique({ where: { id: postId } });
    if (!existing) throw new ApiError(404, "找不到这个 Teamaking Post。");
    if (existing.userId !== user.id && !isAdminRole(user.role)) {
      throw new ApiError(403, "只有发布者或管理员可以删除这个 Teamaking Post。");
    }

    await prisma.teamakingPost.delete({ where: { id: postId } });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "teamaking_posts.delete",
      targetType: "TeamakingPost",
      targetId: postId,
      method,
      path: request.nextUrl.pathname,
      summary: { boardId: existing.boardId }
    });
    return ok({ message: "Teamaking Post 已删除。" });
  }

  if (method === "POST" && path[2] === "team-up") {
    const sender = await requireUser();
    if (isDemoUser(sender)) {
      const body = await readBody(request);
      const result = createDemoTeamUpInterest(postId, sender, {
        message: assertString(body.message, "message"),
        senderContribution: assertString(body.senderContribution, "senderContribution")
      });
      if (result.error) throw new ApiError(400, result.error);
      return created({ request: result.interest, existing: result.existing, message: result.existing ? "你已经对这条 Teamaking Post 发过 TeamUp Interest。" : "TeamUp Interest 已发送。" });
    }

    if (!sender.onboardingCompleted) {
      throw new ApiError(403, "请先完成基础 onboarding，再发送 Team Up 请求。");
    }

    const post = await prisma.teamakingPost.findUnique({
      where: { id: postId },
      include: {
        user: { include: { contactInfo: true } },
        board: true
      }
    });
    if (!post) throw new ApiError(404, "找不到这个 Teamaking Post。");
    if (post.userId === sender.id) {
      throw new ApiError(400, "不能给自己的 Teamaking Post 发送 Team Up。");
    }

    const body = await readBody(request);
    const existing = await prisma.teamUpRequest.findUnique({
      where: { postId_senderId: { postId, senderId: sender.id } }
    });
    if (existing && existing.status !== "deleted") {
      return ok({ request: existing, existing: true, message: "你已经对这条 Teamaking Post 发过 TeamUp Interest。" });
    }

    const senderContact = await prisma.contactInfo.findUnique({ where: { userId: sender.id } });
    const requestData = {
        postId,
        senderId: sender.id,
        receiverId: post.userId,
        message: assertString(body.message, "message"),
        senderContribution: assertString(body.senderContribution, "senderContribution"),
        senderContactSnapshot: contactSnapshot(senderContact, { isOwner: true, isSameSchool: true }),
        receiverContactSnapshot: contactSnapshot(post.user.contactInfo, await contactContextForViewer(post.userId, sender, postId)),
        status: "sent"
    };
    const requestRow = existing
      ? await prisma.teamUpRequest.update({ where: { id: existing.id }, data: requestData })
      : await prisma.teamUpRequest.create({ data: requestData });

    await operationLog({
      actorUserId: sender.id,
      actorRole: sender.role,
      action: existing ? "team_up_requests.resend" : "team_up_requests.create",
      targetType: "TeamUpRequest",
      targetId: requestRow.id,
      method,
      path: request.nextUrl.pathname,
      summary: { postId, receiverId: post.userId }
    });
    return created({ request: requestRow });
  }

  throw new ApiError(404, "找不到 Teamaking Post 接口。");
}
