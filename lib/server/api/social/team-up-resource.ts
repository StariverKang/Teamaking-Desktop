import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, ok, readBody } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { isAdminRole, requireUser } from "@/lib/session";
import { allowedRequestTransitions } from "@/lib/constants";
import { isDemoUser } from "@/lib/demo-data";
import { demoReceivedTeamUpInterests, updateDemoInterest } from "@/lib/demo-store";
import { userInclude } from "@/lib/server/services/user-service";
import { operationLog } from "@/lib/server/services/system-service";
import { publicUserForViewer, enrichPostForViewer } from "@/lib/server/services/social-service";

export async function handleTeamUpRequests(method: string, path: string[], request: NextRequest) {
  const user = await requireUser();
  if (isDemoUser(user)) {
    if (method === "GET" && path[1] === "inbox") return ok({ requests: demoReceivedTeamUpInterests(user.id) });
    if (method === "GET" && path[1] === "sent") return ok({ requests: [] });
    if (method === "PATCH" && path[2] === "status") {
      return ok({ request: demoReceivedTeamUpInterests(user.id).find((item) => item.id === path[1]) ?? null });
    }
  }

  const include = {
    post: {
      include: {
        board: { include: { courseOffering: { include: { course: true, semester: true } } } },
        user: { include: { profile: true } }
      }
    },
    sender: { include: { profile: true } },
    receiver: { include: { profile: true } }
  };

  if (method === "GET" && path[1] === "inbox") {
    const requests = await prisma.teamUpRequest.findMany({
      where: { receiverId: user.id, senderId: { not: user.id } },
      include,
      orderBy: { createdAt: "desc" }
    });
    return ok({ requests });
  }

  if (method === "GET" && path[1] === "sent") {
    return ok({ requests: [] });
  }

  if (method === "PATCH" && path[2] === "status") {
    const requestId = path[1];
    const body = await readBody(request);
    const nextStatus = assertString(body.status, "status");
    const existing = await prisma.teamUpRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new ApiError(404, "找不到这个 Team Up Request。");
    if (existing.receiverId !== user.id && existing.senderId !== user.id && !isAdminRole(user.role)) {
      throw new ApiError(403, "不能修改不属于你的 Team Up Request。");
    }

    const allowed = allowedRequestTransitions[existing.status] ?? [];
    if (!allowed.includes(nextStatus) && !isAdminRole(user.role)) {
      throw new ApiError(400, `不允许从 ${existing.status} 变更为 ${nextStatus}。`, ERROR_CODES.TEAMUP_INVALID_TRANSITION, {
        from: existing.status,
        to: nextStatus
      });
    }

    const updated = await prisma.teamUpRequest.update({
      where: { id: requestId },
      data: { status: nextStatus }
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "team_up_requests.status.patch",
      targetType: "TeamUpRequest",
      targetId: updated.id,
      method,
      path: request.nextUrl.pathname,
      summary: { from: existing.status, to: nextStatus }
    });
    return ok({ request: updated });
  }

  throw new ApiError(404, "找不到 Team Up Request 接口。");
}

export async function handleTeamUpInterests(method: string, path: string[]) {
  const user = await requireUser();

  if (method === "GET" && path[1] === "received") {
    if (isDemoUser(user)) return ok({ interests: demoReceivedTeamUpInterests(user.id) });

    const interests = await prisma.teamUpRequest.findMany({
      where: { receiverId: user.id, senderId: { not: user.id }, status: { not: "deleted" } },
      include: {
        post: { include: { board: { include: { courseOffering: { include: { course: true, semester: true } } } }, user: { include: userInclude } } },
        sender: { include: { ...userInclude, portfolioItems: { include: { relatedCourse: true } } } },
        receiver: { include: { profile: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const enriched = await Promise.all(interests.map(async (interest) => ({
      ...interest,
      post: await enrichPostForViewer(interest.post, user),
      sender: await publicUserForViewer(interest.sender, user, interest.postId)
    })));
    return ok({ interests: enriched });
  }

  if (method === "POST" && path[1] && ["mutual", "refuse", "withdraw", "report"].includes(path[2] ?? "")) {
    const action = path[2] as "mutual" | "refuse" | "withdraw" | "report";
    if (isDemoUser(user)) {
      const result = updateDemoInterest(path[1], user, action);
      if (result.error) throw new ApiError(403, result.error);
      return ok({ interest: result.interest });
    }

    const interest = await prisma.teamUpRequest.findUnique({ where: { id: path[1] } });
    if (!interest) throw new ApiError(404, "找不到这个 TeamUp Interest。");
    if (action === "withdraw" && interest.senderId !== user.id) throw new ApiError(403, "只有发出者可以撤回。");
    if ((action === "mutual" || action === "refuse") && interest.receiverId !== user.id) throw new ApiError(403, "只有 Post 发起者可以处理这个 TeamUp Interest。");
    if (action === "report" && interest.senderId !== user.id && interest.receiverId !== user.id) throw new ApiError(403, "不能举报不属于你的 TeamUp Interest。");

    const nextStatus = action === "mutual" ? "mutual" : action === "refuse" ? "refused" : action === "withdraw" ? "withdrawn" : "reported";
    const allowed = allowedRequestTransitions[interest.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ApiError(400, `不允许从 ${interest.status} 变更为 ${nextStatus}。`, ERROR_CODES.TEAMUP_INVALID_TRANSITION, {
        from: interest.status,
        to: nextStatus
      });
    }
    const updated = await prisma.teamUpRequest.update({
      where: { id: interest.id },
      data: { status: nextStatus }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: `team_up_interests.${action}`,
      targetType: "TeamUpRequest",
      targetId: updated.id,
      summary: { from: interest.status, to: nextStatus }
    });
    return ok({ interest: updated });
  }

  throw new ApiError(404, "找不到 TeamUp Interest 接口。");
}
