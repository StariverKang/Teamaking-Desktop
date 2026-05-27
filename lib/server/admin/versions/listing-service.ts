import { getActiveAppVersion } from "@/lib/app-version";
import { prisma } from "@/lib/prisma";
import { summarizeVersion } from "@/lib/server/admin/versions/version-service";

export async function listAdminVersions() {
  const [activeVersion, versions, checkpoints] = await Promise.all([
    getActiveAppVersion(),
    prisma.appVersion.findMany({
      include: {
        _count: {
          select: {
            schools: true,
            users: true,
            operationLogs: true,
            errorEvents: true,
            auditLogs: true,
            importBatches: true,
            checkpoints: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.versionCheckpoint.findMany({
      include: { appVersion: true },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  return {
    activeVersion: summarizeVersion(activeVersion),
    versions: versions.map(summarizeVersion),
    checkpoints: checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      appVersionId: checkpoint.appVersionId,
      appVersionName: checkpoint.appVersion.name,
      label: checkpoint.label,
      kind: checkpoint.kind,
      reason: checkpoint.reason,
      summary: checkpoint.summary,
      createdAt: checkpoint.createdAt,
      downloadUrl: "/api/admin/versions/checkpoints/" + checkpoint.id + "/download"
    }))
  };
}
