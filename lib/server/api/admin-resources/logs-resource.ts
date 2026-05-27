import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, optionalString } from "@/lib/http";
import { getActiveAppVersionId } from "@/lib/app-version";
import { normalizeSearch } from "@/lib/server/services/user-service";

export async function handleAdminLogsResource(method: string, path: string[], request: NextRequest, admin: any) {
  void admin;
  const resource = path[1];

  if (method === "GET" && resource === "logs") {
    const appVersionId = await getActiveAppVersionId();
    const url = new URL(request.url);
    const actorUserId = optionalString(url.searchParams.get("actorUserId"));
    const [logs, operationLogs] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: { appVersionId },
        include: { adminUser: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      prisma.operationLog.findMany({
        where: {
          appVersionId,
          ...(actorUserId ? { actorUserId } : {})
        },
        include: { actor: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
        take: 200
      })
    ]);
    return ok({ operationLogs, logs });
  }

  if (method === "GET" && resource === "error-events") {
    const appVersionId = await getActiveAppVersionId();
    const query = normalizeSearch(request.nextUrl.searchParams.get("query") ?? "");
    const where: any = { appVersionId };
    if (query) {
      where.OR = [
        { errorCode: { contains: query, mode: "insensitive" } },
        { requestId: { contains: query, mode: "insensitive" } },
        { path: { contains: query, mode: "insensitive" } },
        { userId: { contains: query, mode: "insensitive" } },
        { message: { contains: query, mode: "insensitive" } }
      ];
    }
    const events = await prisma.errorEvent.findMany({
      where,
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    const byCode = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.errorCode] = (acc[event.errorCode] ?? 0) + 1;
      return acc;
    }, {});
    return ok({ errorEvents: events, summary: { total: events.length, byCode } });
  }

  return null;
}
