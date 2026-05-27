import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";import { ApiError, ok, optionalString, readBody } from "@/lib/http";

import { getActiveAppVersionId } from "@/lib/app-version";
import { writeAudit } from "@/lib/server/services/system-service";

export async function buildCourseTeamingMaintenanceSummary(appVersionId: string) {
  const scopedCourse = { school: { appVersionId } };
  const [activeMemberships, historicalMemberships, openPosts, activeTeamUpRequests, acceptedFriendships] = await Promise.all([
    prisma.courseBoardMembership.count({
      where: { status: "active", board: { courseOffering: { course: scopedCourse } } }
    }),
    prisma.courseBoardMembership.count({
      where: { status: { in: ["history", "left"] }, board: { courseOffering: { course: scopedCourse } } }
    }),
    prisma.teamakingPost.count({
      where: { status: { in: ["open", "paused"] }, board: { courseOffering: { course: scopedCourse } } }
    }),
    prisma.teamUpRequest.count({
      where: { status: { in: ["sent", "viewed", "mutual"] }, post: { board: { courseOffering: { course: scopedCourse } } } }
    }),
    prisma.followRequest.count({
      where: {
        status: "accepted",
        OR: [{ sender: { appVersionId } }, { receiver: { appVersionId } }]
      }
    })
  ]);

  return {
    activeMemberships,
    historicalMemberships,
    openPosts,
    activeTeamUpRequests,
    acceptedFriendships
  };
}

export async function clearCurrentCourseTeamingState(admin: any, request: NextRequest) {
  const body = await readBody(request);
  const confirmation = optionalString(body.confirmation);
  if (confirmation !== "CLEAR_TEAMING_STATE") {
    throw new ApiError(400, "请输入 CLEAR_TEAMING_STATE 以确认清空当前课程组队状态。");
  }

  const appVersionId = await getActiveAppVersionId();
  const scopedCourse = { school: { appVersionId } };
  const before = await buildCourseTeamingMaintenanceSummary(appVersionId);
  const now = new Date();

  const [membershipRows, postRows, requestRows] = await Promise.all([
    prisma.courseBoardMembership.findMany({
      where: { status: "active", board: { courseOffering: { course: scopedCourse } } },
      select: { id: true }
    }),
    prisma.teamakingPost.findMany({
      where: { status: { in: ["open", "paused"] }, board: { courseOffering: { course: scopedCourse } } },
      select: { id: true }
    }),
    prisma.teamUpRequest.findMany({
      where: { status: { in: ["sent", "viewed", "mutual"] }, post: { board: { courseOffering: { course: scopedCourse } } } },
      select: { id: true }
    })
  ]);

  const membershipIds = membershipRows.map((row) => row.id);
  const postIds = postRows.map((row) => row.id);
  const requestIds = requestRows.map((row) => row.id);

  const result = await prisma.$transaction(async (tx) => {
    const memberships = membershipIds.length
      ? await tx.courseBoardMembership.updateMany({
          where: { id: { in: membershipIds } },
          data: { status: "history", leftAt: now }
        })
      : { count: 0 };
    const posts = postIds.length
      ? await tx.teamakingPost.updateMany({
          where: { id: { in: postIds } },
          data: { status: "closed" }
        })
      : { count: 0 };
    const teamUpRequests = requestIds.length
      ? await tx.teamUpRequest.updateMany({
          where: { id: { in: requestIds } },
          data: { status: "closed" }
        })
      : { count: 0 };
    return {
      membershipsMovedToHistory: memberships.count,
      postsClosed: posts.count,
      teamUpRequestsClosed: teamUpRequests.count
    };
  }, { timeout: 60000, maxWait: 10000 });

  const after = await buildCourseTeamingMaintenanceSummary(appVersionId);
  const summary = {
    ...result,
    retained: {
      acceptedFriendships: after.acceptedFriendships,
      courseMembershipRows: after.historicalMemberships,
      teamakingPostRows: postIds.length,
      teamUpRequestRows: requestIds.length
    },
    before,
    after
  };

  await writeAudit(admin.id, "admin.maintenance.clear_course_teaming_state", "AppVersion", appVersionId, before, summary);
  return ok({
    summary,
    message: `已清空当前课程组队状态：${result.membershipsMovedToHistory} 条课程加入记录转为历史，${result.postsClosed} 条组队帖关闭，${result.teamUpRequestsClosed} 条 TeamUp 请求关闭；好友关系和历史记录已保留。`
  });
}

export function dateRangeFromRequest(request: NextRequest) {
  const url = new URL(request.url);
  const toParam = optionalString(url.searchParams.get("to"));
  const fromParam = optionalString(url.searchParams.get("from"));
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date();
  const from = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(to.getTime() - 1000 * 60 * 60 * 24 * 30);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(400, "日期格式不正确，请使用 YYYY-MM-DD。");
  }

  return { from, to, format: url.searchParams.get("format") };
}

export function csvResponse(rows: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(rows[0] ?? {});
  const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(","))].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
