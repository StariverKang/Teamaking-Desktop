import { getActiveAppVersionId } from "@/lib/app-version";
import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/server/json-utils";

export type OperationLogInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  method?: string | null;
  path?: string | null;
  status?: string;
  summary?: unknown;
  metadata?: unknown;
  appVersionId?: string;
};

export async function operationLog(input: OperationLogInput) {
  const appVersionId = input.appVersionId ?? (await getActiveAppVersionId());
  await prisma.operationLog.create({
    data: {
      appVersionId,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      method: input.method ?? null,
      path: input.path ?? null,
      status: input.status ?? "success",
      summary: toJson(input.summary ?? {}),
      metadata: toJson(input.metadata ?? {})
    }
  });
}

export async function safeOperationLog(input: OperationLogInput) {
  try {
    await operationLog(input);
  } catch (error) {
    console.error("Failed to write operation log", error);
  }
}

export async function writeAudit(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId?: string | null,
  beforeValue?: unknown,
  afterValue?: unknown
) {
  const appVersionId = await getActiveAppVersionId();
  await prisma.adminAuditLog.create({
    data: {
      appVersionId,
      adminUserId,
      action,
      targetType,
      targetId,
      beforeValue: beforeValue === undefined ? undefined : toJson(beforeValue),
      afterValue: afterValue === undefined ? undefined : toJson(afterValue)
    }
  });
  await operationLog({
    appVersionId,
    actorUserId: adminUserId,
    actorRole: "admin",
    action,
    targetType,
    targetId,
    summary: { targetType, targetId }
  });
}
