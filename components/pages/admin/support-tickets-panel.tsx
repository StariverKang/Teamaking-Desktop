/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";import { StatusPill } from "@/components/app-shell";

import { Field, inputClass } from "@/components/pages/page-primitives";
import type { AdminResourceContext } from "./resource-types";

export function SupportTicketsPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const tickets = data?.tickets ?? [];
      const summary = data?.summary ?? {};
      const selectedTicket = tickets.find((ticket: any) => ticket.id === selectedId) ?? tickets[0];
      const categoryLabels: Record<string, string> = {
        missing_course: "缺失课程",
        course_config_error: "课程配置错误",
        bug: "Bug",
        error_report: "报错",
        admin_request: "后台需求",
        other: "其他"
      };
      const ticketStatusValue = ["open", "in_progress", "resolved", "closed"].includes(status) ? status : selectedTicket?.status ?? "open";
      const selectTicket = (ticket: any) => {
        setSelectedId(ticket.id);
        setStatus(ticket.status ?? "open");
        setAdminNote(ticket.adminNote ?? "");
        setTextFields({ ...textFields, adminReply: ticket.adminReply ?? "" });
      };
      return (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["全部工单", summary.total ?? tickets.length],
              ["当前显示", summary.visible ?? tickets.length],
              ["待处理", summary.byStatus?.open ?? 0],
              ["处理中", summary.byStatus?.in_progress ?? 0]
            ].map(([label, value]) => (
              <div key={label as string} className="border border-ink/15 bg-chalk px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">{label as string}</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{String(value ?? 0)}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <input
              className={inputClass}
              placeholder="搜索标题、描述、邮箱、课程代码或备注"
              value={ticketQuery}
              onChange={(event) => setTicketQuery(event.target.value)}
            />
            <select className={inputClass} value={ticketCategoryFilter} onChange={(event) => setTicketCategoryFilter(event.target.value)}>
              <option value="all">全部类型</option>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className={inputClass} value={ticketStatusFilter} onChange={(event) => setTicketStatusFilter(event.target.value)}>
              {["all", "open", "in_progress", "resolved", "closed"].map((item) => <option key={item} value={item}>{item === "all" ? "全部状态" : item}</option>)}
            </select>
          </div>
          <div className="max-h-[420px] overflow-auto border border-ink/15">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-ink text-paper">
                <tr>{["类型", "状态", "标题", "提交人", "创建时间", "更新时间", "操作"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
              </thead>
              <tbody>
                {tickets.length ? tickets.map((ticket: any) => (
                  <tr key={ticket.id} className={`border-b border-ink/10 ${selectedTicket?.id === ticket.id ? "bg-mist/60" : ""}`}>
                    <td className="px-3 py-2 font-semibold">{categoryLabels[ticket.category] ?? ticket.category}</td>
                    <td className="px-3 py-2"><StatusPill status={ticket.status} /></td>
                    <td className="max-w-[280px] truncate px-3 py-2">{ticket.title}</td>
                    <td className="max-w-[220px] truncate px-3 py-2">{ticket.submittedBy?.profile?.displayName ?? ticket.email ?? ticket.submittedBy?.email ?? "未登录用户"}</td>
                    <td className="px-3 py-2">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2">{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" onClick={() => selectTicket(ticket)}>查看 / 处理</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-3 py-4 text-ink/48">没有符合筛选条件的工单。</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {selectedTicket ? (
            <div className="grid gap-4 border border-ink/15 bg-chalk p-4 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-ink/48">Selected ticket</p>
                <h3 className="mt-1 text-lg font-semibold text-ink">{categoryLabels[selectedTicket.category] ?? selectedTicket.category} · {selectedTicket.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/70">{selectedTicket.description}</p>
                {selectedTicket.relatedUrl ? <p className="mt-2 text-sm text-ink/58">相关页面：{selectedTicket.relatedUrl}</p> : null}
                <p className="mt-2 text-sm text-ink/58">联系：{selectedTicket.email ?? selectedTicket.submittedBy?.email ?? "未提供"}</p>
              </div>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(`/api/admin/support-tickets/${selectedTicket.id}`, "PATCH", { status: ticketStatusValue, adminNote, adminReply: textFields.adminReply }, {
                    busy: "save-ticket",
                    success: (response) => `已更新工单：${response.ticket?.title ?? selectedTicket.title}`
                  });
                }}
              >
                <Field label="状态">
                  <select className={inputClass} value={ticketStatusValue} onChange={(event) => setStatus(event.target.value)}>
                    {["open", "in_progress", "resolved", "closed"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="管理员备注">
                  <textarea className={inputClass} rows={4} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="内部处理记录，不直接展示给用户" />
                </Field>
                <Field label="给用户的回复">
                  <textarea className={inputClass} rows={4} value={textFields.adminReply ?? ""} onChange={(event) => setTextFields({ ...textFields, adminReply: event.target.value })} placeholder="需要回传给用户时填写" />
                </Field>
                <button disabled={Boolean(busyAction)} className="w-fit rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
                  {busyAction === "save-ticket" ? "保存中..." : "保存工单处理结果"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      );

}
