import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, optionalString, readBody } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { teamUpInterestStatuses } from "@/lib/constants";
import { writeAudit } from "@/lib/server/services/system-service";

export async function handleAdminSocialModerationResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];

  if (method === "GET" && resource === "teamaking-posts") {
    const posts = await prisma.teamakingPost.findMany({
      include: { user: { include: { profile: true } }, board: { include: { courseOffering: { include: { course: true } } } } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ posts });
  }

  if (method === "PATCH" && resource === "teamaking-posts" && id) {
    const body = await readBody(request);
    const before = await prisma.teamakingPost.findUnique({ where: { id } });
    const post = await prisma.teamakingPost.update({
      where: { id },
      data: { status: optionalString(body.status) ?? before?.status }
    });
    await writeAudit(admin.id, "admin.teamaking_posts.patch", "TeamakingPost", id, before, post);
    return ok({ post });
  }

  if (method === "GET" && resource === "team-up-requests" && id === "reported") {
    const requests = await prisma.teamUpRequest.findMany({
      where: { status: "reported" },
      include: { sender: { include: { profile: true } }, receiver: { include: { profile: true } }, post: true },
      orderBy: { createdAt: "desc" }
    });
    return ok({ requests });
  }

  if (method === "PATCH" && resource === "team-up-requests" && id) {
    const body = await readBody(request);
    const before = await prisma.teamUpRequest.findUnique({ where: { id } });
    const requestedStatus = optionalString(body.status);
    if (requestedStatus && !teamUpInterestStatuses.includes(requestedStatus as any)) {
      throw new ApiError(400, "TeamUp 状态无效。", ERROR_CODES.TEAMUP_INVALID_TRANSITION, { status: requestedStatus });
    }
    const requestRow = await prisma.teamUpRequest.update({
      where: { id },
      data: { status: requestedStatus ?? before?.status }
    });
    await writeAudit(admin.id, "admin.team_up_requests.patch", "TeamUpRequest", id, before, requestRow);
    return ok({ request: requestRow });
  }

  return null;
}
