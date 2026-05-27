import { ApiContext } from "@/lib/server/api-context";
import { ApiError, created, ok, optionalString } from "@/lib/http";
import { writeAudit } from "@/lib/server/audit";
import { createVersionCheckpoint } from "@/lib/server/admin/versions/checkpoint-service";
import { downloadVersionCheckpoint } from "@/lib/server/admin/versions/download-service";
import { listAdminVersions } from "@/lib/server/admin/versions/listing-service";
import { restoreCheckpointAsNewVersion } from "@/lib/server/admin/versions/restore-service";
import { createAppVersionFromAdminRequest } from "@/lib/server/admin/versions/version-service";

export function isAdminVersionsPath(path: string[]) {
  return path[0] === "admin" && path[1] === "versions";
}

export function createAdminVersionsModule() {
  return async function handleAdminVersions(context: ApiContext) {
    const admin = await context.requireAdmin();
    const resource = context.path[1];
    const id = context.path[2];
    const action = context.path[3];

    if (context.method === "GET" && resource === "versions" && !id) {
      return ok(await listAdminVersions());
    }

    if (context.method === "POST" && resource === "versions" && !id) {
      const body = await context.body();
      const result = await createAppVersionFromAdminRequest(body, admin);
      return created({
        ...result,
        message: "已创建新版本：" + result.version.name + "。当前版本已关闭，并保存 final checkpoint。"
      });
    }

    if (context.method === "POST" && resource === "versions" && id === "checkpoints" && !action) {
      const body = await context.body();
      const checkpoint = await createVersionCheckpoint({
        label: optionalString(body.label) ?? "Manual checkpoint " + new Date().toLocaleString(),
        kind: optionalString(body.kind) ?? "manual",
        reason: optionalString(body.reason),
        triggeredByUserId: admin.id
      });
      await writeAudit(admin.id, "admin.versions.checkpoint", "VersionCheckpoint", checkpoint.id, null, checkpoint);
      return created({ checkpoint, message: "已创建版本检查点：" + checkpoint.label });
    }

    if (context.method === "GET" && resource === "versions" && id === "checkpoints" && action && context.path[4] === "download") {
      return downloadVersionCheckpoint(action);
    }

    if (context.method === "POST" && resource === "versions" && id === "checkpoints" && action && ["restore-as-new-version", "rollback"].includes(context.path[4] ?? "")) {
      const restored = await restoreCheckpointAsNewVersion(action, admin);
      await writeAudit(admin.id, "admin.versions.restore_as_new_version", "VersionCheckpoint", action, null, restored.mappedCounts);
      return created({
        ...restored,
        message: "已从检查点创建新的 active version：" + restored.version.name + "。旧 active version 已关闭，未做原地覆盖。"
      });
    }

    throw new ApiError(404, "找不到版本管理接口。");
  };
}

export { createAppVersionFromAdminRequest } from "@/lib/server/admin/versions/version-service";
export { createVersionCheckpoint } from "@/lib/server/admin/versions/checkpoint-service";
export { restoreCheckpointAsNewVersion } from "@/lib/server/admin/versions/restore-service";
export { summarizeVersion } from "@/lib/server/admin/versions/version-service";
