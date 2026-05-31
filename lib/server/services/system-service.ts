import { NextRequest } from "next/server";

import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { ERROR_CODES, type ErrorCode } from "@/lib/error-codes";
import { getCurrentUser } from "@/lib/session";
import { getActiveAppVersionId } from "@/lib/app-version";

export function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function persistErrorEvent(
  request: NextRequest,
  error: {
    requestId: string;
    errorCode: ErrorCode;
    message: string;
    status: number;
    stackDigest?: string;
    metadata?: unknown;
  }
) {
  try {
    const [appVersionId, user] = await Promise.all([
      getActiveAppVersionId().catch(() => "legacy"),
      getCurrentUser().catch(() => null)
    ]);
    await prisma.errorEvent.create({
      data: {
        appVersionId,
        requestId: error.requestId,
        errorCode: error.errorCode,
        message: error.message,
        status: error.status,
        path: request.nextUrl.pathname,
        method: request.method,
        userId: user?.id ?? null,
        actorRole: user?.role ?? null,
        stackDigest: error.stackDigest,
        metadata: toJson(error.metadata ?? {})
      }
    });
  } catch (logError) {
    console.error("Failed to persist API error event", logError);
  }
}

export async function operationLog(input: {
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
}) {
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

export async function writeAudit(adminUserId: string, action: string, targetType: string, targetId?: string | null, beforeValue?: unknown, afterValue?: unknown) {
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

export function safeStringEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function ensureSystemIsActive(root?: string) {
  if (!root || ["auth", "admin", "demo", "desktop", "support-tickets"].includes(root)) return;

  const config = await prisma.siteConfig.findUnique({ where: { key: "system_status" } });
  const value = config?.value && typeof config.value === "object" && !Array.isArray(config.value) ? (config.value as Record<string, unknown>) : null;

  if (value?.status === "paused") {
    throw new ApiError(503, typeof value.message === "string" && value.message ? value.message : "系统当前处于维护暂停状态，请稍后再试。", ERROR_CODES.API_SYSTEM_PAUSED);
  }
}
