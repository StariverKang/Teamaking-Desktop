import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { getActiveAppVersionId } from "@/lib/app-version";
import { buildCourseTeamingMaintenanceSummary, clearCurrentCourseTeamingState } from "@/lib/server/services/admin-maintenance-service";

export async function handleAdminMaintenanceResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];

  if (resource === "maintenance") {
    const appVersionId = await getActiveAppVersionId();
    if (method === "GET") {
      const summary = await buildCourseTeamingMaintenanceSummary(appVersionId);
      return ok({
        summary,
        policy: {
          clearCourseTeamingState: {
            confirmation: "CLEAR_TEAMING_STATE",
            changes: [
              "active CourseBoardMembership -> history，保留 joinedAt/leftAt 作为课程参与历史",
              "open/paused TeamakingPost -> closed，保留发帖记录",
              "sent/viewed/mutual TeamUpRequest -> closed，保留发送和处理记录",
              "FollowRequest accepted 不变，好友关系保留"
            ]
          }
        }
      });
    }
    if (method === "POST" && id === "clear-course-teaming-state") {
      return clearCurrentCourseTeamingState(admin, request);
    }
  }

  return null;
}
