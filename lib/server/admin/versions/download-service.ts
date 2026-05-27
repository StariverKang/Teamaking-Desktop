import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { jsonDownloadResponse } from "@/lib/server/storage/json-files";

export async function downloadVersionCheckpoint(checkpointId: string) {
  const checkpoint = await prisma.versionCheckpoint.findUnique({
    where: { id: checkpointId },
    include: { appVersion: true, chunks: true }
  });
  if (!checkpoint) throw new ApiError(404, "找不到这个版本检查点。");
  return jsonDownloadResponse(checkpoint, checkpoint.appVersion.name + "-" + checkpoint.label + "-checkpoint.json");
}
