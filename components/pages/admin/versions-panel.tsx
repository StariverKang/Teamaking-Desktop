/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";import { StatusPill } from "@/components/app-shell";
import { inputClass } from "@/components/pages/page-primitives";

import { previewValue } from "@/components/pages/shared/data-preview";
import type { AdminResourceContext } from "./resource-types";

export function VersionsAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const activeVersion = data?.activeVersion;
      const versions = data?.versions ?? [];
      const checkpoints = data?.checkpoints ?? [];
      return (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="border border-ink/15 bg-chalk p-4 md:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Active version</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{activeVersion?.name ?? "Unknown"}</h3>
              <p className="mt-2 text-sm text-ink/62">{activeVersion?.phase ?? "testing"} · {activeVersion?.status ?? "active"} · started {activeVersion?.startedAt ? new Date(activeVersion.startedAt).toLocaleString() : ""}</p>
            </div>
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() => runAction("/api/admin/versions/checkpoints", "POST", { label: textFields.checkpointLabel, reason: textFields.checkpointReason }, {
                busy: "create-checkpoint",
                success: (response) => response.message ?? "已创建检查点。"
              })}
              className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busyAction === "create-checkpoint" ? "创建中..." : "创建检查点"}
            </button>
            <input className={inputClass} placeholder="检查点名称（可选）" value={textFields.checkpointLabel ?? ""} onChange={(event) => setTextFields({ ...textFields, checkpointLabel: event.target.value })} />
          </div>

          <form
            className="grid gap-3 border border-rust/25 bg-rust/5 p-4 md:grid-cols-[1fr_160px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/versions", "POST", {
                name: textFields.versionName,
                phase: textFields.versionPhase,
                notes: textFields.versionNotes,
                reason: textFields.versionReason
              }, {
                busy: "open-version",
                success: (response) => response.message ?? "已开启新版本。"
              });
            }}
          >
            <div className="md:col-span-4">
              <h3 className="text-lg font-semibold text-ink">Open a new blank version</h3>
              <p className="mt-1 text-sm leading-6 text-ink/62">会先保存当前版本最终状态，再开启新版本。普通用户、课程、学期、导入数据不复制；管理员账号和学校邮箱域名会复制，便于继续管理。</p>
            </div>
            <input className={inputClass} placeholder="新版本名称，例如 2026-05 online test" value={textFields.versionName ?? ""} onChange={(event) => setTextFields({ ...textFields, versionName: event.target.value })} />
            <select className={inputClass} value={textFields.versionPhase ?? "testing"} onChange={(event) => setTextFields({ ...textFields, versionPhase: event.target.value })}>
              {["testing", "staging", "production"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <input className={inputClass} placeholder="原因 / 备注" value={textFields.versionReason ?? ""} onChange={(event) => setTextFields({ ...textFields, versionReason: event.target.value })} />
            <button disabled={Boolean(busyAction)} className="rounded-sm bg-rust px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{busyAction === "open-version" ? "开启中..." : "开启新版本"}</button>
          </form>

          <div className="border border-ink/15">
            <div className="border-b border-ink/10 bg-chalk px-4 py-3">
              <h3 className="font-semibold text-ink">Versions</h3>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper"><tr>{["Name", "Phase", "Status", "Users", "Schools", "Imports", "Datasets", "Started", "Ended"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                <tbody>
                  {versions.map((version: any) => (
                    <tr key={version.id} className="border-b border-ink/10">
                      <td className="px-3 py-2 font-semibold">{version.name}</td>
                      <td className="px-3 py-2">{version.phase}</td>
                      <td className="px-3 py-2"><StatusPill status={version.status} /></td>
                      <td className="px-3 py-2">{version.counts?.users ?? 0}</td>
                      <td className="px-3 py-2">{version.counts?.schools ?? 0}</td>
                      <td className="px-3 py-2">{version.counts?.importBatches ?? 0}</td>
                      <td className="px-3 py-2">{version.counts?.importDatasets ?? 0}</td>
                      <td className="px-3 py-2">{version.startedAt ? new Date(version.startedAt).toLocaleString() : ""}</td>
                      <td className="px-3 py-2">{version.endedAt ? new Date(version.endedAt).toLocaleString() : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-ink/15">
            <div className="border-b border-ink/10 bg-chalk px-4 py-3">
              <h3 className="font-semibold text-ink">Checkpoints</h3>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper"><tr>{["Label", "Version", "Kind", "Summary", "Created", "Action"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                <tbody>
                  {checkpoints.map((checkpoint: any) => (
                    <tr key={checkpoint.id} className="border-b border-ink/10">
                      <td className="px-3 py-2 font-semibold">{checkpoint.label}</td>
                      <td className="px-3 py-2">{checkpoint.appVersionName}</td>
                      <td className="px-3 py-2">{checkpoint.kind}</td>
                      <td className="max-w-[280px] truncate px-3 py-2 text-xs">{previewValue(checkpoint.summary)}</td>
                      <td className="px-3 py-2">{checkpoint.createdAt ? new Date(checkpoint.createdAt).toLocaleString() : ""}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <a className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" href={checkpoint.downloadUrl}>下载</a>
                          <button
                            type="button"
                            className="rounded-sm border border-rust/50 px-2 py-1 text-xs font-semibold text-rust"
                            onClick={() => runAction(`/api/admin/versions/checkpoints/${checkpoint.id}/restore-as-new-version`, "POST", {}, {
                              busy: `restore-${checkpoint.id}`,
                              success: (response) => response.message ?? "已从检查点创建新版本。"
                            })}
                          >
                            恢复为新版本
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );

}
