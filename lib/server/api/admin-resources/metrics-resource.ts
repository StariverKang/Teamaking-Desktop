import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";
import { dateRangeFromRequest, csvResponse } from "@/lib/server/services/admin-maintenance-service";

export async function handleAdminMetricsResource(method: string, path: string[], request: NextRequest, admin: any) {
  void admin;
  const resource = path[1];

  if (method === "GET" && resource === "metrics") {
    const { from, to, format } = dateRangeFromRequest(request);
    const whereCreated = { createdAt: { gte: from, lte: to } };
    const [users, verifiedUsers, posts, teamUpRequests, supportTickets, memberships, uploads] = await Promise.all([
      prisma.user.count({ where: whereCreated }),
      prisma.user.count({ where: { ...whereCreated, isEmailVerified: true } }),
      prisma.teamakingPost.count({ where: whereCreated }),
      prisma.teamUpRequest.count({ where: whereCreated }),
      prisma.supportTicket.count({ where: whereCreated }),
      prisma.courseBoardMembership.count({ where: { joinedAt: { gte: from, lte: to } } }),
      prisma.portfolioItem.count({ where: whereCreated })
    ]);
    const rows = [
      { metric: "new_users", label: "新增用户", value: users, from: from.toISOString(), to: to.toISOString() },
      { metric: "verified_users", label: "已验证用户", value: verifiedUsers, from: from.toISOString(), to: to.toISOString() },
      { metric: "teamaking_posts", label: "Teamaking Posts", value: posts, from: from.toISOString(), to: to.toISOString() },
      { metric: "team_up_requests", label: "Team Up Requests", value: teamUpRequests, from: from.toISOString(), to: to.toISOString() },
      { metric: "support_tickets", label: "Support Tickets", value: supportTickets, from: from.toISOString(), to: to.toISOString() },
      { metric: "board_memberships", label: "Course Board Joins", value: memberships, from: from.toISOString(), to: to.toISOString() },
      { metric: "portfolio_items", label: "Portfolio Uploads", value: uploads, from: from.toISOString(), to: to.toISOString() }
    ];

    if (format === "csv") {
      return csvResponse(rows, `teamaking-metrics-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`);
    }

    return ok({ metrics: rows, range: { from, to } });
  }

  return null;
}
