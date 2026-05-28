import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, readBody } from "@/lib/http";
import { getActiveAppVersionId } from "@/lib/app-version";
import { writeAudit, toJson } from "@/lib/server/services/system-service";
import {
  buildStoredResumeAiConfigPatch,
  getPublicResumeAiConfig,
  maskStoredResumeAiConfig,
  publicResumeAiConfig,
  resumeAiConfigKey
} from "@/lib/server/services/resume-ai-config-service";

function jsonRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function serializeResumeAiLog(log: any) {
  const summary = jsonRecord(log.summary);
  const metadata = jsonRecord(log.metadata);
  return {
    id: log.id,
    createdAt: log.createdAt,
    actor: log.actor,
    actorUserId: log.actorUserId,
    actorRole: log.actorRole,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    method: log.method,
    path: log.path,
    status: log.status,
    trigger: summary.trigger,
    fileName: summary.fileName,
    parser: summary.parser,
    provider: summary.provider,
    model: summary.model,
    analysisStatus: summary.status,
    summaryTitle: summary.summaryTitle,
    highlightCount: summary.highlightCount,
    keywordGroupCount: summary.keywordGroupCount,
    inputChars: summary.inputChars,
    durationMs: summary.durationMs,
    apiKeySource: summary.apiKeySource,
    analysisResult: metadata.analysisResult
  };
}

export async function handleAdminAiResumeResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const action = path[2];
  if (resource !== "ai-resume") return null;

  if (method === "GET") {
    const appVersionId = await getActiveAppVersionId();
    const logs = await prisma.operationLog.findMany({
      where: {
        appVersionId,
        action: "profile.resume.ai_analysis"
      },
      include: { actor: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return ok({
      config: await getPublicResumeAiConfig(),
      logs: logs.map(serializeResumeAiLog)
    });
  }

  if (method === "PATCH" && action === "config") {
    if (admin.role !== "super_admin") {
      throw new ApiError(403, "只有 super_admin 可以配置 AI API key 和模型。");
    }
    const body = await readBody(request);
    const beforeRow = await prisma.siteConfig.findUnique({ where: { key: resumeAiConfigKey } });
    const patch = await buildStoredResumeAiConfigPatch(body);
    const config = await prisma.siteConfig.upsert({
      where: { key: resumeAiConfigKey },
      update: {
        value: toJson(patch.value),
        updatedByUserId: admin.id
      },
      create: {
        key: resumeAiConfigKey,
        value: toJson(patch.value),
        updatedByUserId: admin.id
      }
    });
    await writeAudit(
      admin.id,
      "admin.ai_resume.config.patch",
      "SiteConfig",
      resumeAiConfigKey,
      beforeRow ? maskStoredResumeAiConfig(beforeRow.value) : null,
      maskStoredResumeAiConfig(config.value)
    );
    return ok({
      config: publicResumeAiConfig({
        enabled: patch.value.enabled,
        provider: "openai",
        model: patch.value.model,
        apiKey: patch.value.apiKey,
        apiKeySource: patch.value.apiKey ? "site_config" : process.env.OPENAI_API_KEY ? "env" : "missing",
        inputLimit: patch.value.inputLimit
      }),
      message: "AI 简历整理配置已保存。"
    });
  }

  return null;
}
