import { NextResponse } from "next/server";
import { ApiContext } from "@/lib/server/api-context";
import { courseImportPayloadFromBody } from "@/lib/server/course-import/payload";
import { CourseImportWorkflow } from "@/lib/server/course-import/workflow";
import { summarizeCourseImportBatch } from "@/lib/server/course-import/import-helpers";
import { ApiError, created, ok, optionalString } from "@/lib/http";

type CourseImportAdminModuleDeps = {
  workflow: CourseImportWorkflow;
};

export function isCourseImportAdminPath(path: string[]) {
  return path[0] === "admin" && ["course-imports", "course-import-datasets"].includes(path[1] ?? "");
}

export function createCourseImportAdminModule(deps: CourseImportAdminModuleDeps) {
  return async function handleAdminCourseImports(context: ApiContext) {
    const admin = await context.requireAdmin();
    const resource = context.path[1];
    const id = context.path[2];
    const action = context.path[3];

    if (context.method === "GET" && resource === "course-import-datasets" && id && action === "download") {
      const dataset = await deps.workflow.downloadDataset(id);
      return new NextResponse(dataset.content, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${dataset.filename}"`
        }
      });
    }

    if (context.method === "POST" && resource === "course-imports" && id === "validate") {
      const body = await context.body();
      const payload = courseImportPayloadFromBody(body);
      const { validation, preview } = await deps.workflow.validatePayload(payload);
      return ok({ validation, preview });
    }

    if (context.method === "GET" && resource === "course-imports") {
      return ok(await deps.workflow.listBatches({ selectedId: id }));
    }

    if (context.method === "POST" && resource === "course-imports" && id === "clear-admission") {
      const result = await deps.workflow.clearAllAdmissionImports(admin);
      return ok({ result });
    }

    if (context.method === "POST" && resource === "course-imports" && id === "activate-semester") {
      const body = await context.body();
      const result = await deps.workflow.activateAdmissionSemester(body, admin);
      return ok({ result });
    }

    if (context.method === "POST" && resource === "course-imports" && !id) {
      const body = await context.body();
      const payload = courseImportPayloadFromBody(body);
      const name = optionalString(body.name) ?? optionalString(body.configName) ?? optionalString(body.sourceLabel);
      if (!name) throw new ApiError(400, "请为本次配置填写一个名称。");
      const createdBatch = await deps.workflow.createBatchFromPayload({ payload, name, admin, duplicateMode: "block" });
      return created({
        importBatch: summarizeCourseImportBatch(createdBatch.batch),
        validation: createdBatch.validation,
        preview: createdBatch.preview
      });
    }

    if (context.method === "POST" && resource === "course-imports" && id && action === "approve") {
      const body = await context.body();
      const approvalDecisions = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).approvalDecisions as Record<string, unknown> | undefined : undefined;
      const approved = await deps.workflow.approveBatch(id, admin, approvalDecisions);
      return ok({ importBatch: summarizeCourseImportBatch(approved.importBatch), result: approved.result });
    }

    if (context.method === "POST" && resource === "course-imports" && id && action === "reject") {
      const body = await context.body();
      const rejected = await deps.workflow.rejectBatch(id, optionalString(body.adminNote), admin);
      return ok({ importBatch: summarizeCourseImportBatch(rejected.importBatch) });
    }

    if (context.method === "POST" && resource === "course-imports" && id && action === "clear-admission") {
      const result = await deps.workflow.clearAdmissionImportBatch(id, admin);
      return ok({ result });
    }

    throw new ApiError(404, "找不到课程配置接口。");
  };
}
