
import { ERROR_CODES } from "@/lib/error-codes";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { validateBnbuCourseImportPayload } from "@/lib/bnbu-course-import";

import { writeAudit, safeOperationLog } from "@/lib/server/audit";
import { isPlainRecord, numberValues, textValue, toJson } from "@/lib/server/json-utils";
import { buildCourseImportBatchSummary, importCohortYearsFromPayload, payloadHash } from "@/lib/server/course-import/import-helpers";

import { applyBnbuCourseImport } from "@/lib/server/course-import/workflows/apply-workflow";
import { payloadFromDataset } from "@/lib/server/course-import/workflows/dataset-workflow";

export type CourseImportApproveStageName = "load_dataset" | "apply_import" | "build_summary" | "mark_approved" | "checkpoint";

export type CourseImportApproveStage = {
  phase: CourseImportApproveStageName;
  status: "running" | "success" | "failed" | "skipped";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  details?: unknown;
  error?: unknown;
};

export function originalErrorDiagnostic(error: unknown) {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    code: typeof (error as any)?.code === "string" ? (error as any).code : undefined,
    meta: (error as any)?.meta
  };
}

export function courseImportApproveFailureNote(phase: string, error: unknown) {
  const diagnostic = originalErrorDiagnostic(error);
  return `Approve failed at ${phase} on ${new Date().toISOString()}: ${diagnostic.code ? `${diagnostic.code} ` : ""}${diagnostic.message}`;
}

export async function runCourseImportApproveStage<T>(input: {
  phase: CourseImportApproveStageName;
  stages: CourseImportApproveStage[];
  batchId: string;
  admin: any;
  appVersionId?: string;
  details?: unknown;
  fn: () => Promise<T>;
}) {
  const startedAt = new Date();
  const startMs = Date.now();
  const stage: CourseImportApproveStage = {
    phase: input.phase,
    status: "running",
    startedAt: startedAt.toISOString(),
    details: input.details
  };
  input.stages.push(stage);
  try {
    const result = await input.fn();
    stage.status = "success";
    stage.finishedAt = new Date().toISOString();
    stage.durationMs = Date.now() - startMs;
    await safeOperationLog({
      appVersionId: input.appVersionId,
      actorUserId: input.admin.id,
      actorRole: input.admin.role,
      action: "admin.course_imports.approve.stage",
      targetType: "CourseImportBatch",
      targetId: input.batchId,
      status: "success",
      summary: { phase: input.phase, durationMs: stage.durationMs },
      metadata: { stage }
    });
    return result;
  } catch (error) {
    stage.status = "failed";
    stage.finishedAt = new Date().toISOString();
    stage.durationMs = Date.now() - startMs;
    stage.error = originalErrorDiagnostic(error);
    await safeOperationLog({
      appVersionId: input.appVersionId,
      actorUserId: input.admin.id,
      actorRole: input.admin.role,
      action: "admin.course_imports.approve.stage",
      targetType: "CourseImportBatch",
      targetId: input.batchId,
      status: "failed",
      summary: { phase: input.phase, durationMs: stage.durationMs },
      metadata: { stage, originalError: stage.error }
    });
    throw error;
  }
}

export async function approveCourseImportBatch(batchId: string, admin: any) {
  const stages: CourseImportApproveStage[] = [];
  let loadedBatch: any = null;

  try {
    const { batch, approvalPayload } = await runCourseImportApproveStage({
      phase: "load_dataset",
      stages,
      batchId,
      admin,
      fn: async () => {
        const batch = await prisma.courseImportBatch.findUnique({ where: { id: batchId } });
        loadedBatch = batch;
        if (!batch) throw new ApiError(404, "找不到这个课程配置操作。");
        if (batch.status === "approved") throw new ApiError(400, "这个课程配置操作已经批准过。");
        const approvalPayload = batch.datasetId ? await payloadFromDataset(batch.datasetId) : isPlainRecord(batch.payload) ? batch.payload : null;
        if (!approvalPayload) throw new ApiError(400, "课程配置操作的 JSON 无法解析。");
        return { batch, approvalPayload };
      }
    });
    loadedBatch = batch;

    const before = await prisma.courseImportBatch.findUnique({ where: { id: batchId } });
    const result = await runCourseImportApproveStage({
      phase: "apply_import",
      stages,
      batchId,
      admin,
      appVersionId: batch.appVersionId,
      details: { datasetId: batch.datasetId, cohortYears: numberValues(batch.cohortYears) },
      fn: () => applyBnbuCourseImport(approvalPayload, batch.id)
    });
    const { approvalSummary, approvalCohortYears } = await runCourseImportApproveStage({
      phase: "build_summary",
      stages,
      batchId,
      admin,
      appVersionId: batch.appVersionId,
      fn: async () => {
        const existingSummary = isPlainRecord(batch.summary) ? batch.summary : {};
        const existingPreview = isPlainRecord(batch.validationSummary) && isPlainRecord(batch.validationSummary.preview)
          ? batch.validationSummary.preview
          : undefined;
        return {
          approvalSummary: Object.keys(existingSummary).length
            ? existingSummary
            : buildCourseImportBatchSummary(approvalPayload, { validation: validateBnbuCourseImportPayload(approvalPayload), counts: {} }),
          approvalCohortYears: numberValues(batch.cohortYears).length
            ? numberValues(batch.cohortYears)
            : importCohortYearsFromPayload(approvalPayload, existingPreview)
        };
      }
    });
    const updated = await runCourseImportApproveStage({
      phase: "mark_approved",
      stages,
      batchId,
      admin,
      appVersionId: batch.appVersionId,
      fn: () => prisma.courseImportBatch.update({
        where: { id: batchId },
        data: {
          schoolId: result.school.id,
          status: "approved",
          validationSummary: result.validationSummary,
          summary: toJson(approvalSummary),
          cohortYears: toJson(approvalCohortYears),
          payloadHash: batch.payloadHash ?? payloadHash(approvalPayload),
          sourceLabel: batch.sourceLabel ?? textValue(approvalSummary.sourceLabel),
          adminNote: typeof batch.adminNote === "string" && batch.adminNote.startsWith("Approve failed at ") ? null : batch.adminNote,
          approvedByUserId: admin.id,
          approvedAt: new Date()
        }
      })
    });
    const checkpoint = await runCourseImportApproveStage({
      phase: "checkpoint",
      stages,
      batchId,
      admin,
      appVersionId: batch.appVersionId,
      details: { mode: "manual", status: "skipped_manual_checkpoint" },
      fn: async () => ({ mode: "manual", status: "skipped_manual_checkpoint" })
    });
    await writeAudit(admin.id, "admin.course_imports.approve", "CourseImportBatch", batchId, before, { updated, result, checkpoint, stages });
    return { importBatch: updated, result, checkpoint, stages };
  } catch (error) {
    const failedStage = [...stages].reverse().find((stage) => stage.status === "failed");
    const phase = failedStage?.phase ?? "unknown";
    const metadata = {
      batchId,
      phase,
      stages,
      originalError: originalErrorDiagnostic(error)
    };
    if (loadedBatch) {
      await prisma.courseImportBatch.update({
        where: { id: batchId },
        data: { adminNote: courseImportApproveFailureNote(phase, error) }
      }).catch((updateError) => console.error("Failed to write course import approve failure note", updateError));
    }
    await safeOperationLog({
      appVersionId: loadedBatch?.appVersionId,
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "admin.course_imports.approve",
      targetType: "CourseImportBatch",
      targetId: batchId,
      status: "failed",
      summary: { phase },
      metadata
    });
    if (error instanceof ApiError && error.status < 500) {
      throw new ApiError(error.status, error.message, error.errorCode, metadata);
    }
    throw new ApiError(500, `课程配置批准失败：${phase}。请在 Error Events 中查看 request id。`, ERROR_CODES.INTERNAL_SERVER_ERROR, metadata);
  }
}
