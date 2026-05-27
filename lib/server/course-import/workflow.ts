export type CourseImportWorkflow = {
  validatePayload: (payload: Record<string, unknown>) => Promise<{ validation: unknown; preview: unknown }>;
  listBatches: (input?: { selectedId?: string }) => Promise<unknown>;
  createBatchFromPayload: (input: {
    payload: Record<string, unknown>;
    name: string;
    admin: any;
    duplicateMode?: "block" | "reject_pending";
  }) => Promise<any>;
  approveBatch: (batchId: string, admin: any) => Promise<any>;
  rejectBatch: (batchId: string, adminNote: string | undefined, admin: any) => Promise<any>;
  downloadDataset: (datasetId: string) => Promise<{ content: string; filename: string }>;
};

import { approveCourseImportBatch } from "@/lib/server/course-import/workflows/approval-workflow";
import { createCourseImportBatchFromPayload, downloadCourseImportDataset, listCourseImportBatches, rejectCourseImportBatch } from "@/lib/server/course-import/workflows/batch-workflow";
import { buildCourseImportPreview } from "@/lib/server/course-import/workflows/preview-workflow";

export function createCourseImportWorkflow(): CourseImportWorkflow {
  return {
    validatePayload: async (payload) => {
      const preview = await buildCourseImportPreview(payload);
      return { validation: preview.validation, preview };
    },
    listBatches: listCourseImportBatches,
    createBatchFromPayload: createCourseImportBatchFromPayload,
    approveBatch: approveCourseImportBatch,
    rejectBatch: rejectCourseImportBatch,
    downloadDataset: downloadCourseImportDataset
  };
}

export { applyBnbuCourseImport } from "@/lib/server/course-import/workflows/apply-workflow";
export { approveCourseImportBatch } from "@/lib/server/course-import/workflows/approval-workflow";
export { createCourseImportBatchFromPayload, downloadCourseImportDataset, listCourseImportBatches, rejectCourseImportBatch } from "@/lib/server/course-import/workflows/batch-workflow";
export { createCourseImportDataset, payloadFromDataset } from "@/lib/server/course-import/workflows/dataset-workflow";
export { buildBnbuDatabaseCoverage, buildCourseImportPreview } from "@/lib/server/course-import/workflows/preview-workflow";
export { summarizeCourseImportBatch } from "@/lib/server/course-import/import-helpers";
