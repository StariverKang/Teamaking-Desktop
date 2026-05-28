import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, readBody } from "@/lib/http";
import { getActiveAppVersionId } from "@/lib/app-version";
import { writeAudit, toJson } from "@/lib/server/services/system-service";
import {
  buildStoredCrawlerAiConfigPatch,
  getPublicCrawlerAiConfig,
  maskStoredCrawlerAiConfig,
  crawlerAiConfigKey,
} from "@/lib/server/services/crawler-ai-config-service";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

export async function handleAdminAiCrawlerResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const action = path[2];
  if (resource !== "ai-crawler") return null;

  if (method === "GET") {
    const logs = [];
    await getActiveAppVersionId();
    const actions = await prisma.operationLog.findMany({
      where: { action: "crawler.ai_analyze" },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    logs.push(...actions.map((row: any) => ({
      id: row.id,
      createdAt: row.createdAt,
      actor: asRecord(row.actor),
      actorUserId: row.actorUserId,
      actorRole: row.actorRole,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      status: row.status,
      summary: asRecord(row.summary),
      metadata: asRecord(row.metadata)
    })));

    return ok({
      config: await getPublicCrawlerAiConfig(),
      logs
    });
  }

  if (method === "PATCH" && action === "config") {
    if (admin.role !== "super_admin") {
      throw new ApiError(403, "只有 super_admin 可以配置 AI 爬虫参数。");
    }

    const body = await readBody(request);
    const beforeRow = await prisma.siteConfig.findUnique({ where: { key: crawlerAiConfigKey } });
    const patch = await buildStoredCrawlerAiConfigPatch(body);
    const config = await prisma.siteConfig.upsert({
      where: { key: crawlerAiConfigKey },
      update: {
        value: toJson(patch.value),
        updatedByUserId: admin.id
      },
      create: {
        key: crawlerAiConfigKey,
        value: toJson(patch.value),
        updatedByUserId: admin.id
      }
    });
    const publicBefore = maskStoredCrawlerAiConfig(beforeRow?.value);
    const publicAfter = await getPublicCrawlerAiConfig();
    await writeAudit(
      admin.id,
      "admin.ai_crawler.config.patch",
      "SiteConfig",
      crawlerAiConfigKey,
      publicBefore,
      publicAfter
    );

    return ok({
      config: publicAfter,
      message: "AI 爬虫配置已保存。",
      configRow: config
    });
  }

  return null;
}
