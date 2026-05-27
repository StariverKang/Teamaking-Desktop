/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import Link from "next/link";import { StatusPill } from "@/components/app-shell";
import { inputClass } from "@/components/pages/page-primitives";

import { previewValue } from "@/components/pages/shared/data-preview";
import type { AdminResourceContext } from "./resource-types";

export function LogsAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const operationLogs = data?.operationLogs ?? [];
      const auditLogs = data?.logs ?? [];
      return (
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-ink/62">操作日志记录写入、编辑和与他人的交互；翻页、跳转、只读浏览不会记录。</p>
          <div className="max-h-96 overflow-auto border border-ink/15">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-ink text-paper"><tr>{["Time", "Actor", "Action", "Target", "Status", "Summary"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
              <tbody>
                {operationLogs.map((log: any) => (
                  <tr key={log.id} className="border-b border-ink/10">
                    <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2">{log.actor?.profile?.displayName ?? log.actor?.email ?? log.actorRole ?? "system"}</td>
                    <td className="px-3 py-2 font-semibold">{log.action}</td>
                    <td className="px-3 py-2">{log.targetType ?? ""} {log.targetId ?? ""}</td>
                    <td className="px-3 py-2"><StatusPill status={log.status} /></td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-xs">{previewValue(log.summary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="border border-ink/15 bg-chalk p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Admin audit details</summary>
            <div className="mt-3 max-h-72 overflow-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-ink text-paper"><tr>{["Time", "Admin", "Action", "Target", "After"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                <tbody>
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-ink/10">
                      <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</td>
                      <td className="px-3 py-2">{log.adminUser?.profile?.displayName ?? log.adminUser?.email}</td>
                      <td className="px-3 py-2">{log.action}</td>
                      <td className="px-3 py-2">{log.targetType} {log.targetId}</td>
                      <td className="max-w-[320px] truncate px-3 py-2">{previewValue(log.afterValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      );

}

export function ErrorEventsAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const events = data?.errorEvents ?? [];
      const summary = data?.summary ?? {};
      return (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className={inputClass}
              placeholder="搜索 errorCode / requestId / userId / path"
              value={errorEventQuery}
              onChange={(event) => setErrorEventQuery(event.target.value)}
            />
            <span className="rounded-sm border border-ink/20 px-3 py-2 text-sm font-semibold text-ink">{summary.total ?? events.length} events</span>
          </div>
          <div className="max-h-[560px] overflow-auto border border-ink/15">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-ink text-paper">
                <tr>{["Time", "Code", "Request", "User", "Path", "Status", "Message"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
              </thead>
              <tbody>
                {events.length ? events.map((event: any) => (
                  <tr key={event.id} className="border-b border-ink/10">
                    <td className="px-3 py-2">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2 font-semibold text-rust">{event.errorCode}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs">{event.requestId}</td>
                    <td className="max-w-[200px] truncate px-3 py-2">{event.user?.profile?.displayName ?? event.user?.email ?? event.userId ?? "anonymous"}</td>
                    <td className="max-w-[260px] truncate px-3 py-2">{event.method} {event.path}</td>
                    <td className="px-3 py-2">{event.status}</td>
                    <td className="max-w-[320px] truncate px-3 py-2">{event.message}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-3 py-4 text-ink/48">没有匹配的错误事件。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );

}

export function DeprecatedCourseSubmissionsPanel() {

      return (
        <div className="grid gap-3">
          <p className="text-sm leading-6 text-ink/62">缺失课程提交审核已弃用。新的 bug、报错、缺失课程都走 Support Tickets。</p>
          <Link href="/admin/support-tickets" className="w-fit rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
            去处理工单
          </Link>
        </div>
      );

}
