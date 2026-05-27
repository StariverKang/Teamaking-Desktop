/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";import { StatusPill } from "@/components/app-shell";
import { inputClass } from "@/components/pages/page-primitives";

import type { AdminResourceContext } from "./resource-types";

import { CourseImportPreview } from "./course-import-preview";

export function CourseImportsAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const preview = actionData?.preview ?? actionData?.validation?.preview;
      const importBatches = data?.importBatches ?? [];
      const selectedBatch = importBatches.find((row: any) => row.id === selectedId) ?? importBatches[0];
      const selectedBatchId = selectedBatch?.id;
      const readableBatchLabel = (row: any) => {
        const years = row.cohortYears?.length ? `${row.cohortYears.join(", ")} admission` : "unknown admission";
        const counts = row.summary?.counts ?? {};
        const created = row.createdAt ? new Date(row.createdAt).toLocaleString() : "unknown time";
        return `${row.name ?? "Untitled"} · ${years} · preview ${row.semesterCode ?? "no activation term"} · ${counts.curriculumRules ?? 0} rules · ${row.status} · created ${created}`;
      };
      const pendingCount = importBatches.filter((row: any) => row.status === "pending").length;
      return (
        <div className="grid gap-5">
          <div className="border border-ink/15 bg-chalk p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Admission-year configuration operations</p>
                <h3 className="mt-1 text-xl font-semibold text-ink">导入队列与配置历史</h3>
                <p className="mt-1 text-sm text-ink/60">每一行是一份 JSON 配置操作。批准后会写入课程目录和 admission-year 课程安排规则；旧的 approved 行是历史记录，不代表同一 JSON 被拆成多个 pending。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-sm bg-paper px-3 py-1 text-sm font-semibold text-ink">{pendingCount} pending</span>
                <span className="rounded-sm bg-paper px-3 py-1 text-sm font-semibold text-ink">{importBatches.length} total records</span>
              </div>
            </div>
            <div className="mt-4 max-h-80 overflow-auto border border-ink/10 bg-paper">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper">
                  <tr>
                    {["配置名称", "Admission year", "激活预览学期", "状态", "课程目录项", "配置规则", "Warnings", "来源", "创建时间", "操作"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {importBatches.map((row: any) => {
                    const counts = row.summary?.counts ?? {};
                    return (
                      <tr key={row.id} className={`border-b border-ink/10 ${selectedBatchId === row.id ? "bg-mist/60" : ""}`}>
                        <td className="px-3 py-2 font-semibold">{row.name ?? row.sourceLabel ?? "Untitled import"}</td>
                        <td className="px-3 py-2">{row.cohortYears?.length ? row.cohortYears.join(", ") : "Unknown"}</td>
                        <td className="px-3 py-2">{row.semesterCode ?? "None"}</td>
                        <td className="px-3 py-2"><StatusPill status={row.status} /></td>
                        <td className="px-3 py-2">{counts.courses ?? 0}</td>
                        <td className="px-3 py-2">{counts.curriculumRules ?? 0}</td>
                        <td className="px-3 py-2">{counts.warnings ?? 0}</td>
                        <td className="max-w-[260px] truncate px-3 py-2">{row.sourceLabel ?? row.summary?.sourceLabel ?? "Unknown source"}</td>
                        <td className="px-3 py-2">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => { setSelectedId(row.id); loadCourseImportPreview(row.id); }} className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold">
                              查看差异
                            </button>
                            {row.status === "pending" ? (
                              <button
                                type="button"
                                disabled={Boolean(busyAction)}
                                onClick={() => {
                                  setSelectedId(row.id);
                                  runAction(`/api/admin/course-imports/${row.id}/approve`, "POST", {}, {
                                    busy: "approve-import",
                                    success: (response) => {
                                      const activated = response.result?.activatedBoards?.length ?? 0;
                                      return `已批准 ${row.name ?? "配置"}：课程目录和 admission-year 配置规则已写入，激活/复用 ${activated} 个 Course Board。`;
                                    }
                                  });
                                }}
                                className="rounded-sm bg-forest px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                批准
                              </button>
                            ) : null}
                            {row.status === "pending" ? (
                              <button
                                type="button"
                                disabled={Boolean(busyAction)}
                                onClick={() => {
                                  const note = window.prompt("拒绝原因 / 管理备注，可留空") ?? "";
                                  setSelectedId(row.id);
                                  runAction(`/api/admin/course-imports/${row.id}/reject`, "POST", { adminNote: note }, {
                                    busy: "reject-import",
                                    success: () => `已拒绝 ${row.name ?? "该配置"}，课程目录和配置规则未改变。`
                                  });
                                }}
                                className="rounded-sm border border-rust px-2 py-1 text-xs font-semibold text-rust disabled:opacity-50"
                              >
                                拒绝
                              </button>
                            ) : null}
                            {row.dataset?.downloadUrl ? <a className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" href={row.dataset.downloadUrl}>下载</a> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <form
            className="grid gap-3 border border-ink/15 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/course-imports", "POST", { payload: textFields.payload, name: textFields.importName }, {
                busy: "create-import",
                success: (response) => {
                  const summary = response.importBatch?.summary;
                  const counts = summary?.counts ?? response.validation?.counts ?? {};
                  const years = response.importBatch?.cohortYears?.join(", ") || summary?.cohortYears?.join(", ") || "unknown";
                  return `已创建待审批配置：${years} admission，${counts.courses ?? 0} courses，${counts.curriculumRules ?? 0} rules。`;
                },
                after: (response) => {
                  if (response.importBatch?.id) setSelectedId(response.importBatch.id);
                  setImportPreviewTab("coverage");
                }
              });
            }}
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Step 1</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Paste and validate JSON</h3>
              <p className="mt-1 text-sm text-ink/60">校验只读取 JSON，不写入数据库；创建待审批配置只会生成一条 pending 操作。系统会把 JSON 理解为课程目录、admission-year 配置规则和来源证据，便于之后查询、编辑、审计和回溯。</p>
              <p className="mt-1 text-xs text-ink/50">如果 JSON 来自 crawler，请粘贴单个 “可导入 JSON：bnbu-YYYY-admission-handbook.teamaking.json”。“下载整包备份”包含多个文件，不能作为一份配置直接导入。</p>
            </div>
            <input
              className={inputClass}
              placeholder="本次配置名称，例如 2025 admission handbook · first full import"
              value={textFields.importName ?? ""}
              onChange={(event) => setTextFields({ ...textFields, importName: event.target.value })}
            />
            <textarea
              className={`${inputClass} min-h-[220px] font-mono text-xs`}
              placeholder='粘贴 BNBU cleaned JSON，例如 {"schemaVersion":"teamaking.bnbu_course_import.v2", ...}'
              value={textFields.payload ?? ""}
              onChange={(event) => setTextFields({ ...textFields, payload: event.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => runAction("/api/admin/course-imports/validate", "POST", { payload: textFields.payload }, {
                  busy: "validate-import",
                  success: (response) => {
                    const counts = response.validation?.counts ?? {};
                    const years = response.preview?.coverage?.cohortYears?.map((item: any) => item.key).join(", ") || "unknown";
                    return `校验通过：${years} admission，${counts.courses ?? 0} courses，${counts.curriculumRules ?? 0} rules，${response.validation?.warnings?.length ?? 0} warnings。`;
                  },
                  after: () => setImportPreviewTab("coverage")
                })}
                className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busyAction === "validate-import" ? "校验中..." : "校验 JSON"}
              </button>
              <button disabled={Boolean(busyAction)} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
                {busyAction === "create-import" ? "创建中..." : "创建待审批配置"}
              </button>
            </div>
          </form>
          <div className="border border-ink/15 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Step 2</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Preview, search, edit and compare</h3>
              <p className="mt-1 text-sm text-ink/60">Diff 的基线是当前数据库 active 数据；课程目录和 admission-year 配置规则分开显示。</p>
            </div>
          {preview ? <CourseImportPreview preview={preview} ctx={ctx} /> : null}
          </div>
          <form
            className="grid gap-3 border border-ink/15 p-4 md:grid-cols-[1fr_auto_1fr_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(`/api/admin/course-imports/${selectedBatchId}/approve`, "POST", {}, {
                busy: "approve-import",
                success: (response) => {
                  const activated = response.result?.activatedBoards?.length ?? 0;
                  return `已批准导入：激活/复用 ${activated} 个 Course Board，课程目录和 admission-year 配置规则已写入。`;
                }
              });
            }}
          >
            <div className="md:col-span-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Step 3</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Approve or reject one pending configuration</h3>
            </div>
            <select className={inputClass} value={selectedBatchId ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
              {importBatches.map((row: any) => <option key={row.id} value={row.id}>{readableBatchLabel(row)}</option>)}
            </select>
            <button type="button" onClick={() => loadCourseImportPreview(selectedBatchId)} className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
              {busyAction === "load-import-diff" ? "载入中..." : "查看差异"}
            </button>
            <input className={inputClass} placeholder="拒绝原因 / 管理备注" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
            <button disabled={!selectedBatchId || Boolean(busyAction)} className="rounded-sm bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyAction === "approve-import" ? "批准中..." : "批准导入"}</button>
            <button
              type="button"
              disabled={!selectedBatchId || Boolean(busyAction)}
              onClick={() => runAction(`/api/admin/course-imports/${selectedBatchId}/reject`, "POST", { adminNote }, {
                busy: "reject-import",
                success: () => "已拒绝该待审批配置，数据库课程和规则未改变。"
              })}
              className="rounded-sm border border-rust px-4 py-2 text-sm font-semibold text-rust disabled:opacity-50"
            >
              {busyAction === "reject-import" ? "拒绝中..." : "拒绝"}
            </button>
          </form>
        </div>
      );

}
