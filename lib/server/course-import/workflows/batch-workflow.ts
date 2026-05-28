import { getActiveAppVersionId, getActiveSchool } from "@/lib/app-version";
import { ERROR_CODES } from "@/lib/error-codes";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { validateBnbuCourseImportPayload } from "@/lib/bnbu-course-import";
import { writeAudit } from "@/lib/server/audit";
import { isPlainRecord, numberValues, toJson } from "@/lib/server/json-utils";
import { readStoredJson } from "@/lib/server/storage/json-files";
import { buildCourseImportBatchSummary, hasOverlappingNumber, importCohortYearsFromPayload, payloadHash, summarizeCourseImportBatch } from "@/lib/server/course-import/import-helpers";

import { createCourseImportDataset, payloadFromDataset } from "@/lib/server/course-import/workflows/dataset-workflow";
import { buildBnbuDatabaseCoverage, buildCourseImportPreview } from "@/lib/server/course-import/workflows/preview-workflow";

export async function rejectOverlappingPendingImports(input: { appVersionId: string; schoolId?: string; cohortYears: number[]; admin: any; reason: string }) {
  if (!input.cohortYears.length) return [];
  const pendingBatches = await prisma.courseImportBatch.findMany({
    where: {
      appVersionId: input.appVersionId,
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      status: "pending"
    },
    select: { id: true, cohortYears: true, payload: true, summary: true }
  });
  const overlapping = pendingBatches.filter((batch) => {
    const existingYears: number[] = numberValues(batch.cohortYears).length
      ? numberValues(batch.cohortYears)
      : isPlainRecord(batch.payload)
        ? importCohortYearsFromPayload(batch.payload)
        : numberValues(isPlainRecord(batch.summary) ? batch.summary.cohortYears : undefined);
    return hasOverlappingNumber(existingYears, input.cohortYears);
  });
  if (!overlapping.length) return [];
  await prisma.courseImportBatch.updateMany({
    where: { id: { in: overlapping.map((batch) => batch.id) } },
    data: {
      status: "rejected",
      rejectedByUserId: input.admin.id,
      rejectedAt: new Date(),
      adminNote: input.reason
    }
  });
  return overlapping.map((batch) => batch.id);
}

export async function createCourseImportBatchFromPayload(input: {
  payload: Record<string, unknown>;
  name: string;
  admin: any;
  duplicateMode?: "block" | "reject_pending";
}) {
  const validation = validateBnbuCourseImportPayload(input.payload);
  if (!validation.ok) {
    throw new ApiError(400, `导入文件校验失败：${validation.errors.join("; ")}`);
  }

  const appVersionId = await getActiveAppVersionId();
  const school = await getActiveSchool("BNBU");
  const preview = await buildCourseImportPreview(input.payload);
  const summary = buildCourseImportBatchSummary(input.payload, preview);
  const cohortYears = importCohortYearsFromPayload(input.payload, preview);
  const hash = payloadHash(input.payload);

  if (input.duplicateMode === "reject_pending") {
    await rejectOverlappingPendingImports({
      appVersionId,
      schoolId: school?.id,
      cohortYears,
      admin: input.admin,
      reason: `Superseded by crawler import: ${input.name}`
    });
  } else {
    const pendingBatches = await prisma.courseImportBatch.findMany({
      where: {
        appVersionId,
        ...(school?.id ? { schoolId: school.id } : {}),
        status: "pending"
      },
      select: { id: true, cohortYears: true, payload: true, summary: true, createdAt: true }
    });
    const duplicatePending = pendingBatches.find((batch) => {
      const existingYears: number[] = numberValues(batch.cohortYears).length
        ? numberValues(batch.cohortYears)
        : isPlainRecord(batch.payload)
          ? importCohortYearsFromPayload(batch.payload)
          : numberValues(isPlainRecord(batch.summary) ? batch.summary.cohortYears : undefined);
      return hasOverlappingNumber(existingYears, cohortYears);
    });
    if (duplicatePending) {
      throw new ApiError(409, `已存在 ${cohortYears.join(", ")} admission 的 pending 配置，请先批准或拒绝旧配置后再创建。`, ERROR_CODES.COURSE_IMPORT_DUPLICATE_PENDING);
    }
  }

  const dataset = await createCourseImportDataset({ payload: input.payload, name: input.name, adminUserId: input.admin.id, schoolId: school?.id, preview });
  const batch = await prisma.courseImportBatch.create({
    data: {
      appVersionId,
      schoolId: school?.id,
      datasetId: dataset.id,
      name: input.name,
      schemaVersion: validation.schemaVersion ?? "teamaking.bnbu_course_import.v1",
      semesterCode: validation.semesterCode,
      cohortYears: toJson(cohortYears),
      payloadHash: hash,
      summary: toJson(summary),
      sourceLabel: summary.sourceLabel,
      status: "pending",
      payload: toJson({}),
      validationSummary: toJson({ ...validation, preview })
    }
  });
  await writeAudit(input.admin.id, "admin.course_imports.create", "CourseImportBatch", batch.id, null, { batch, validation, preview, source: "crawler" });
  return { batch, dataset, validation, preview, summary };
}

export async function listCourseImportBatches(input: { selectedId?: string } = {}) {
  const appVersionId = await getActiveAppVersionId();
  const importBatches = await prisma.courseImportBatch.findMany({
    where: { appVersionId },
    include: { school: true, dataset: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  const selectedBatch = input.selectedId
    ? await prisma.courseImportBatch.findUnique({ where: { id: input.selectedId }, include: { school: true, dataset: true } })
    : null;
  const selectedPayload = selectedBatch?.datasetId
    ? await payloadFromDataset(selectedBatch.datasetId)
    : selectedBatch && isPlainRecord(selectedBatch.payload)
      ? selectedBatch.payload
      : null;
  const preview = selectedPayload ? await buildCourseImportPreview(selectedPayload, isPlainRecord(selectedBatch?.approvalDecisions) ? selectedBatch.approvalDecisions as any : {}) : null;
  const databaseCoverage = await buildBnbuDatabaseCoverage();
  const selectedSummary = selectedBatch ? summarizeCourseImportBatch(selectedBatch, true) : null;
  return {
    importBatches: importBatches.map((batch) => summarizeCourseImportBatch(batch)),
    selectedBatch: selectedSummary && selectedPayload ? { ...selectedSummary, payload: selectedPayload } : selectedSummary,
    preview,
    databaseCoverage
  };
}

export async function rejectCourseImportBatch(batchId: string, adminNote: string | undefined, admin: any) {
  const before = await prisma.courseImportBatch.findUnique({ where: { id: batchId } });
  if (!before) throw new ApiError(404, "找不到这个课程配置操作。");
  const updated = await prisma.courseImportBatch.update({
    where: { id: batchId },
    data: {
      status: "rejected",
      rejectedByUserId: admin.id,
      rejectedAt: new Date(),
      adminNote
    }
  });
  await writeAudit(admin.id, "admin.course_imports.reject", "CourseImportBatch", batchId, before, updated);
  return { importBatch: updated };
}

export async function downloadCourseImportDataset(datasetId: string) {
  const dataset = await prisma.courseImportDataset.findUnique({ where: { id: datasetId }, include: { school: true } });
  if (!dataset) throw new ApiError(404, "找不到这个导入数据集。");
  return {
    content: await readStoredJson(dataset.originalStorageKey),
    filename: dataset.originalFileName
  };
}
