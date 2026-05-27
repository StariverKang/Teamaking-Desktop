import { prisma } from "@/lib/prisma";
import { ApiError, ok } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { isDemoUser } from "@/lib/demo-data";
import { demoFollowInbox, updateDemoFollowRequest } from "@/lib/demo-store";
import { userInclude } from "@/lib/server/services/user-service";
import { operationLog } from "@/lib/server/services/system-service";

export async function handleFollowRequests(method: string, path: string[]) {
  const user = await requireUser();

  if (method === "GET" && path[1] === "inbox") {
    if (isDemoUser(user)) return ok({ requests: demoFollowInbox(user.id) });
    const requests = await prisma.followRequest.findMany({
      where: { receiverId: user.id, status: "pending" },
      include: { sender: { include: userInclude }, receiver: { include: userInclude } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ requests });
  }

  if (method === "POST" && path[1] && ["accept", "refuse", "withdraw"].includes(path[2] ?? "")) {
    const action = path[2] as "accept" | "refuse" | "withdraw";
    if (isDemoUser(user)) {
      const result = updateDemoFollowRequest(path[1], user, action);
      if (result.error) throw new ApiError(403, result.error);
      return ok({ request: result.request });
    }

    const existing = await prisma.followRequest.findUnique({ where: { id: path[1] } });
    if (!existing) throw new ApiError(404, "找不到这个关注申请。");
    if (action === "withdraw" && existing.senderId !== user.id) throw new ApiError(403, "只有发出者可以撤回关注申请。");
    if ((action === "accept" || action === "refuse") && existing.receiverId !== user.id) throw new ApiError(403, "只有接收者可以处理关注申请。");
    const status = action === "accept" ? "accepted" : action === "refuse" ? "refused" : "withdrawn";
    const requestRow = await prisma.followRequest.update({ where: { id: existing.id }, data: { status } });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: `follow_requests.${action}`,
      targetType: "FollowRequest",
      targetId: requestRow.id,
      summary: { from: existing.status, to: status }
    });
    return ok({ request: requestRow });
  }

  throw new ApiError(404, "找不到关注申请接口。");
}
