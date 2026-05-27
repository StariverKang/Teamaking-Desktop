import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ok } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { demoUserForAccount, isDemoUser } from "@/lib/demo-data";
import { demoFollowInbox, demoReceivedTeamUpInterests, sanitizeDemoUser } from "@/lib/demo-store";
import { userInclude, publicUser, normalizeSearch } from "@/lib/server/services/user-service";

export async function handleFriends(method: string, request: NextRequest) {
  const user = await requireUser();
  if (method !== "GET") throw new ApiError(405, "好友接口不支持当前请求方式。");

  const query = normalizeSearch(request.nextUrl.searchParams.get("query") ?? "");
  if (isDemoUser(user)) {
    const friends = ["cs", "media", "admin"]
      .map((account) => sanitizeDemoUser(demoUserForAccount(account), user.id))
      .filter((friend) => friend.id !== user.id)
      .map((friend) => publicUser(friend))
      .filter((friend) => {
        const haystack = [friend.email, friend.profile?.displayName, friend.profile?.major?.name, friend.profile?.grade].filter(Boolean).join(" ").toLowerCase();
        return !query || haystack.includes(query);
      });
    return ok({ friends, total: friends.length });
  }

  const accepted = await prisma.followRequest.findMany({
    where: {
      status: "accepted",
      OR: [{ senderId: user.id }, { receiverId: user.id }]
    },
    include: {
      sender: { include: userInclude },
      receiver: { include: userInclude }
    },
    orderBy: { updatedAt: "desc" }
  });
  const friends = accepted
    .map((requestRow) => (requestRow.senderId === user.id ? requestRow.receiver : requestRow.sender))
    .filter((friend) => friend.schoolId === user.schoolId)
    .map((friend) => publicUser(friend))
    .filter((friend) => {
      const haystack = [friend.email, friend.profile?.displayName, friend.profile?.major?.name, friend.profile?.grade, friend.role].filter(Boolean).join(" ").toLowerCase();
      return !query || haystack.includes(query);
    });

  return ok({ friends, total: friends.length });
}

export async function handleNotifications(method: string) {
  const user = await requireUser();
  if (method !== "GET") throw new ApiError(405, "通知接口不支持当前请求方式。");

  if (isDemoUser(user)) {
    const teamUpCount = demoReceivedTeamUpInterests(user.id).filter((item) => item.status === "sent").length;
    const followRequestCount = demoFollowInbox(user.id).filter((item) => item.status === "pending").length;
    return ok({
      summary: {
        teamUpInterests: teamUpCount,
        followRequests: followRequestCount,
        total: teamUpCount + followRequestCount
      }
    });
  }

  const [teamUpInterests, followRequests] = await Promise.all([
    prisma.teamUpRequest.count({ where: { receiverId: user.id, status: "sent" } }),
    prisma.followRequest.count({ where: { receiverId: user.id, status: "pending" } })
  ]);

  return ok({
    summary: {
      teamUpInterests,
      followRequests,
      total: teamUpInterests + followRequests
    }
  });
}
