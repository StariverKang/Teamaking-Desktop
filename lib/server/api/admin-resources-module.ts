import { NextRequest } from "next/server";
import { createApiContext } from "@/lib/server/api-context";
import { ApiError, created, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { isDemoUser } from "@/lib/demo-data";
import { demoAdminResource } from "@/lib/demo-store";
import { handleAdminMaintenanceResource } from "@/lib/server/api/admin-resources/maintenance-resource";
import { handleAdminContentResource } from "@/lib/server/api/admin-resources/content-resource";
import { handleAdminAdminUsersResource } from "@/lib/server/api/admin-resources/admin-users-resource";
import { handleAdminUsersResource } from "@/lib/server/api/admin-resources/users-resource";
import { handleAdminAcademicResource } from "@/lib/server/api/admin-resources/academic-resource";
import { handleAdminCoursesResource } from "@/lib/server/api/admin-resources/courses-resource";
import { handleAdminCourseSubmissionsResource } from "@/lib/server/api/admin-resources/course-submissions-resource";
import { handleAdminSupportTicketsResource } from "@/lib/server/api/admin-resources/support-tickets-resource";
import { handleAdminBoardsResource } from "@/lib/server/api/admin-resources/boards-resource";
import { handleAdminSocialModerationResource } from "@/lib/server/api/admin-resources/social-moderation-resource";
import { handleAdminMetricsResource } from "@/lib/server/api/admin-resources/metrics-resource";
import { handleAdminConfigsResource } from "@/lib/server/api/admin-resources/configs-resource";
import { handleAdminLogsResource } from "@/lib/server/api/admin-resources/logs-resource";
import { handleAdminAiResumeResource } from "@/lib/server/api/admin-resources/ai-resume-resource";
import { handleAdminAiCrawlerResource } from "@/lib/server/api/admin-resources/ai-crawler-resource";

export async function handleDemoAdmin(context: ReturnType<typeof createApiContext>) {
  if (context.path[0] !== "admin") return null;
  const admin = await context.requireAdmin();
  if (!isDemoUser(admin)) return null;

  const resource = context.path[1];
  const id = context.path[2];
  const action = context.path[3];

  if (context.method === "GET") return ok(demoAdminResource(resource));
  if (context.method === "PATCH" && resource && id) {
    const body = await context.body();
    return ok({
      item: { id, ...body },
      message: `本地视觉演示模式已模拟更新 ${resource}。`
    });
  }
  if (context.method === "POST" && resource) {
    const body = await context.body();
    return created({
      item: { id: `demo-${resource}-created`, action, ...body },
      message: `本地视觉演示模式已模拟创建/处理 ${resource}。`
    });
  }

  return null;
}

const adminResourceHandlers = [
  handleAdminMaintenanceResource,
  handleAdminContentResource,
  handleAdminAdminUsersResource,
  handleAdminUsersResource,
  handleAdminAcademicResource,
  handleAdminCoursesResource,
  handleAdminCourseSubmissionsResource,
  handleAdminSupportTicketsResource,
  handleAdminBoardsResource,
  handleAdminSocialModerationResource,
  handleAdminMetricsResource,
  handleAdminConfigsResource,
  handleAdminAiResumeResource,
  handleAdminAiCrawlerResource,
  handleAdminLogsResource
];

export async function handleAdmin(method: string, path: string[], request: NextRequest) {
  const admin = await requireAdmin();

  for (const handler of adminResourceHandlers) {
    const response = await handler(method, path, request, admin);
    if (response) return response;
  }

  throw new ApiError(404, "找不到管理后台接口。");
}
