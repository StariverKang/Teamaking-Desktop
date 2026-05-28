"use client";

import Link from "next/link";import { useEffect, useMemo, useRef, useState } from "react";
import { Card, LoadingState, PageShell, StatusPill } from "@/components/app-shell";

import { ErrorBox, inputClass } from "@/components/pages/page-primitives";

import { api, useApi } from "@/lib/client/api";
import { contentImageUrls } from "@/components/pages/shared/content-parts";
import { previewValue, rowsFromData } from "@/components/pages/shared/data-preview";
import { ContentAdminPanel } from "./content-panel";
import { CourseImportsAdminPanel } from "./course-imports-panel";
import { CoursesAdminPanel } from "./courses-panel";
import { LogsAdminPanel, ErrorEventsAdminPanel, DeprecatedCourseSubmissionsPanel } from "./logs-panel";
import { SupportTicketsPanel } from "./support-tickets-panel";
import { VersionsAdminPanel } from "./versions-panel";import { AdminUsersPanel, BoardsAdminPanel, ConfigsPanel, MajorsAdminPanel, SchoolsAdminPanel, SocialModerationPanel, UsersAdminPanel } from "./resource-panels";

export function AdminResourcePage({
  title,
  endpoint,
  description,
  initialContentTab = "developer_contact"
}: {
  title: string;
  endpoint: string;
  description: string;
  defaultActionPath?: string;
  initialContentTab?: "developer_contact" | "developer_log" | "help" | "announcements";
}) {
  const [refresh, setRefresh] = useState(0);
  const resource = endpoint.includes("support-tickets")
    ? "support-tickets"
    : endpoint.includes("team-up-requests")
      ? "team-up-requests"
      : endpoint.split("/").filter(Boolean).pop() ?? "";
  const [courseQuery, setCourseQuery] = useState("");
  const [courseStatusFilter, setCourseStatusFilter] = useState("all");
  const [courseSourceFilter, setCourseSourceFilter] = useState("all");
  const [courseTagFilter, setCourseTagFilter] = useState("");
  const [coursePage, setCoursePage] = useState(1);
  const courseEndpoint = `/api/admin/courses?query=${encodeURIComponent(courseQuery)}&status=${encodeURIComponent(courseStatusFilter)}&source=${encodeURIComponent(courseSourceFilter)}&tag=${encodeURIComponent(courseTagFilter)}&page=${coursePage}&pageSize=25`;
  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState("all");
  const supportEndpoint = `/api/admin/support-tickets?query=${encodeURIComponent(ticketQuery)}&status=${encodeURIComponent(ticketStatusFilter)}&category=${encodeURIComponent(ticketCategoryFilter)}`;
  const [errorEventQuery, setErrorEventQuery] = useState("");
  const errorEventEndpoint = `/api/admin/error-events?query=${encodeURIComponent(errorEventQuery)}`;
  const dataEndpoint = resource === "courses" ? courseEndpoint : resource === "support-tickets" ? supportEndpoint : resource === "error-events" ? errorEventEndpoint : endpoint;
  const { data, error, loading } = useApi(dataEndpoint, [refresh]);
  const {
    data: contentAnnouncementData,
    error: contentAnnouncementError,
    loading: contentAnnouncementLoading
  } = useApi(resource === "content" ? "/api/admin/announcements" : null, [refresh]);
  const rows = useMemo(() => rowsFromData(data), [data]);
  const primaryRows = useMemo(() => rows[0]?.[1] ?? [], [rows]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("active");
  const [role, setRole] = useState("profile_completed_user");
  const [adminNote, setAdminNote] = useState("");
  const [approvalDecisions, setApprovalDecisions] = useState<Record<string, any>>({});
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [actionData, setActionData] = useState<any>(null);
  const [importPreviewTab, setImportPreviewTab] = useState("coverage");
  const [importSearch, setImportSearch] = useState("");
  const [importPage, setImportPage] = useState(1);
  const [importEdit, setImportEdit] = useState<{ kind: string; id: string; draft: Record<string, string | boolean>; raw: any } | null>(null);
  const [courseDraft, setCourseDraft] = useState<Record<string, string>>({});
  const courseEditorRef = useRef<HTMLDivElement | null>(null);
  const [adminTableQuery, setAdminTableQuery] = useState("");
  const [contentTreeQuery, setContentTreeQuery] = useState("");
  const [contentTab, setContentTab] = useState<"developer_contact" | "developer_log" | "help" | "announcements">(initialContentTab);
  const [contentExpandedIds, setContentExpandedIds] = useState<Set<string>>(new Set());
  const [contentCreating, setContentCreating] = useState(false);
  const [contentAnnouncementId, setContentAnnouncementId] = useState("");
  const [contentAnnouncementCreating, setContentAnnouncementCreating] = useState(false);

  useEffect(() => {
    if (resource === "content" || resource === "courses") return;
    if (primaryRows.length > 0 && !selectedId) setSelectedId(primaryRows[0].id ?? primaryRows[0].key ?? "");
  }, [primaryRows, resource, selectedId]);

  const selectedCourse = resource === "courses" ? (data?.courses ?? []).find((course: any) => course.id === selectedId) ?? null : null;

  useEffect(() => {
    if (resource !== "courses" || !selectedCourse) return;
    setSelectedId(selectedCourse.id);
    setCourseDraft({
      code: selectedCourse.code ?? "",
      title: selectedCourse.title ?? "",
      description: selectedCourse.description ?? "",
      credits: selectedCourse.credits === null || selectedCourse.credits === undefined ? "" : String(selectedCourse.credits),
      ownerUnit: JSON.stringify(selectedCourse.ownerUnit ?? {}, null, 2),
      categoryTags: Array.isArray(selectedCourse.categoryTags) ? selectedCourse.categoryTags.join(", ") : "",
      courseType: selectedCourse.courseType ?? "coursework",
      status: selectedCourse.status ?? "active",
      manualNote: selectedCourse.manualNote ?? "",
      rawJson: JSON.stringify({
        code: selectedCourse.code ?? "",
        title: selectedCourse.title ?? "",
        description: selectedCourse.description ?? "",
        credits: selectedCourse.credits ?? "",
        ownerUnit: selectedCourse.ownerUnit ?? {},
        categoryTags: Array.isArray(selectedCourse.categoryTags) ? selectedCourse.categoryTags : [],
        courseType: selectedCourse.courseType ?? "coursework",
        status: selectedCourse.status ?? "active",
        manualNote: selectedCourse.manualNote ?? ""
      }, null, 2)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, selectedCourse?.id, selectedCourse?.updatedAt]);

  useEffect(() => {
    if (resource !== "content") return;
    if (contentTab === "announcements") return;
    const documents = data?.documents ?? [];
    const current = documents.find((document: any) => document.id === selectedId);
    if (contentCreating) return;
    if (!current || current.kind !== contentTab) {
      const next = documents.find((document: any) => document.kind === contentTab);
      setSelectedId(next?.id ?? "");
    }
  }, [resource, contentTab, contentCreating, data?.documents, selectedId]);

  useEffect(() => {
    if (resource !== "content" || contentTab === "announcements") return;
    const selectedDocument = (data?.documents ?? []).find((document: any) => document.id === selectedId && document.kind === contentTab);
    if (!selectedDocument) return;
    setContentCreating(false);
    setTextFields((current) => ({
      ...current,
      contentKind: selectedDocument.kind ?? "help",
      contentNodeType: selectedDocument.nodeType ?? "document",
      contentTitle: selectedDocument.title ?? "",
      contentSlug: selectedDocument.slug ?? "",
      contentParentId: selectedDocument.parentId ?? "",
      contentSummary: selectedDocument.summary ?? "",
      contentBodyMarkdown: selectedDocument.bodyMarkdown ?? "",
      contentImageUrls: contentImageUrls(selectedDocument.imageUrls).join(", "),
      contentStatus: selectedDocument.status ?? "draft",
      contentDisplayOrder: String(selectedDocument.displayOrder ?? 0)
    }));
  }, [resource, contentTab, selectedId, data?.documents]);

  useEffect(() => {
    if (resource !== "content" || contentTab === "announcements" || contentCreating || selectedId) return;
    const documents = data?.documents ?? [];
    const firstDocument = documents.find((document: any) => document.kind === contentTab);
    if (firstDocument) setSelectedId(firstDocument.id);
  }, [resource, contentTab, contentCreating, data?.documents, selectedId]);

  useEffect(() => {
    if (resource !== "content") return;
    const documents = data?.documents ?? [];
    if (!documents.length) return;
    setContentExpandedIds((current) => {
      const next = new Set(current);
      documents.filter((document: any) => !document.parentId && document.kind === contentTab).forEach((document: any) => next.add(document.id));
      return next;
    });
  }, [resource, contentTab, data?.documents]);

  useEffect(() => {
    if (resource !== "content" || contentTab !== "announcements" || contentAnnouncementCreating) return;
    const announcements = contentAnnouncementData?.announcements ?? [];
    const current = announcements.find((announcement: any) => announcement.id === contentAnnouncementId);
    if (!current && announcements.length) setContentAnnouncementId(announcements[0].id);
  }, [resource, contentTab, contentAnnouncementCreating, contentAnnouncementData?.announcements, contentAnnouncementId]);

  useEffect(() => {
    if (resource !== "content" || contentTab !== "announcements" || contentAnnouncementCreating) return;
    const selectedAnnouncement = (contentAnnouncementData?.announcements ?? []).find((announcement: any) => announcement.id === contentAnnouncementId);
    if (!selectedAnnouncement) return;
    setTextFields((current) => ({
      ...current,
      announcementTitleZh: selectedAnnouncement.titleZh ?? "",
      announcementTitleEn: selectedAnnouncement.titleEn ?? "",
      announcementBodyZh: selectedAnnouncement.bodyZh ?? "",
      announcementBodyEn: selectedAnnouncement.bodyEn ?? "",
      announcementPriority: String(selectedAnnouncement.priority ?? 0),
      announcementStatus: selectedAnnouncement.status ?? "draft",
      announcementStartsAt: selectedAnnouncement.startsAt ? String(selectedAnnouncement.startsAt).slice(0, 16) : "",
      announcementEndsAt: selectedAnnouncement.endsAt ? String(selectedAnnouncement.endsAt).slice(0, 16) : ""
    }));
  }, [resource, contentTab, contentAnnouncementCreating, contentAnnouncementId, contentAnnouncementData?.announcements]);

  async function runAction(path: string, method: string, body: Record<string, unknown>, options: { busy?: string; success?: (response: any) => string; after?: (response: any) => void } = {}) {
    setResult(null);
    setBusyAction(options.busy ?? path);
    try {
      const response = await api(path, { method, body: JSON.stringify(body) });
      setActionData(response);
      setResult({ type: "success", message: options.success ? options.success(response) : response.message ?? "操作已完成。" });
      options.after?.(response);
      setRefresh((value) => value + 1);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败，请稍后再试。";
      setResult({ type: "error", message });
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function loadCourseImportPreview(importBatchId: string) {
    if (!importBatchId) return;
    setResult(null);
    setBusyAction("load-import-diff");
    try {
      const response = await api(`/api/admin/course-imports/${importBatchId}`);
      setActionData(response);
      setApprovalDecisions(response.selectedBatch?.approvalDecisions ?? {});
      setImportPreviewTab("diff");
      const summary = response.selectedBatch?.summary;
      const counts = summary?.counts ?? response.preview?.counts ?? {};
      setResult({ type: "success", message: `已载入差异：${summary?.cohortYears?.join(", ") || "unknown"} admission，${counts.courses ?? 0} courses，${counts.curriculumRules ?? 0} rules。` });
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "查看差异失败。" });
    } finally {
      setBusyAction("");
    }
  }

  function payloadForEditing() {
    if (textFields.payload) return textFields.payload;
    const batchPayload = actionData?.selectedBatch?.payload;
    return batchPayload ? JSON.stringify(batchPayload, null, 2) : "";
  }

  function startImportEdit(row: any) {
    if (row.kind === "courses") {
      setImportEdit({
        kind: row.kind,
        id: row.id,
        raw: row.raw ?? row,
        draft: {
          code: row.code ?? "",
          title: row.title ?? "",
          credits: row.credits === null || row.credits === undefined ? "" : String(row.credits),
          description: row.raw?.description ?? "",
          categoryTags: Array.isArray(row.categoryTags) ? row.categoryTags.join(", ") : "",
          sourceRefIds: Array.isArray(row.sourceRefIds) ? row.sourceRefIds.join(", ") : ""
        }
      });
      return;
    }
    const audience = row.raw?.audience ?? {};
    setImportEdit({
      kind: row.kind,
      id: row.id,
      raw: row.raw ?? row,
      draft: {
        courseCode: row.courseCode ?? "",
        classification: row.classification ?? "",
        classificationLabel: row.classificationLabel ?? "",
        studentAction: row.studentAction ?? "default_join",
        allMajors: row.allMajors === true,
        majorCodes: Array.isArray(row.majorCodes) ? row.majorCodes.join(", ") : "",
        cohortYears: Array.isArray(row.cohortYears) ? row.cohortYears.join(", ") : "",
        relativeTermCodes: Array.isArray(row.relativeTermCodes) ? row.relativeTermCodes.join(", ") : "",
        sourceRefIds: Array.isArray(row.sourceRefIds) ? row.sourceRefIds.join(", ") : "",
        confidence: row.confidence ?? "",
        facultyCodes: Array.isArray(row.facultyCodes) ? row.facultyCodes.join(", ") : "",
        grades: Array.isArray(audience.grades) ? audience.grades.join(", ") : ""
      }
    });
  }

  function applyImportEdit() {
    try {
      if (!importEdit) return;
      const rawPayload = payloadForEditing();
      const parsed = JSON.parse(rawPayload);
      const edited = { ...(importEdit.raw ?? {}) };
      if (importEdit.kind === "courses") {
        edited.code = String(importEdit.draft.code ?? "").trim().toUpperCase();
        edited.title = String(importEdit.draft.title ?? "").trim();
        edited.description = String(importEdit.draft.description ?? "");
        const credits = Number(importEdit.draft.credits);
        edited.credits = Number.isFinite(credits) ? credits : undefined;
        edited.categoryTags = String(importEdit.draft.categoryTags ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        edited.sourceRefIds = String(importEdit.draft.sourceRefIds ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      } else {
        const audience = { ...(edited.audience ?? {}) };
        edited.courseCode = String(importEdit.draft.courseCode ?? "").trim().toUpperCase();
        edited.classification = String(importEdit.draft.classification ?? "").trim();
        edited.classificationLabel = String(importEdit.draft.classificationLabel ?? "").trim();
        edited.studentAction = String(importEdit.draft.studentAction ?? "default_join");
        audience.allMajors = importEdit.draft.allMajors === true;
        audience.majorCodes = String(importEdit.draft.majorCodes ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
        audience.facultyCodes = String(importEdit.draft.facultyCodes ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
        audience.grades = String(importEdit.draft.grades ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        audience.cohortYears = String(importEdit.draft.cohortYears ?? "").split(",").map((item) => Number(item.trim())).filter(Number.isFinite);
        edited.audience = audience;
        edited.relativeTermCodes = String(importEdit.draft.relativeTermCodes ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
        edited.sourceRefIds = String(importEdit.draft.sourceRefIds ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        edited.confidence = String(importEdit.draft.confidence ?? "unknown");
      }
      const list = Array.isArray(parsed[importEdit.kind]) ? parsed[importEdit.kind] : [];
      const index = list.findIndex((item: any) => {
        if (importEdit.kind === "courses") return item.code === importEdit.id;
        return item.id === importEdit.id;
      });
      if (index < 0) throw new Error(`找不到要编辑的 ${importEdit.kind}: ${importEdit.id}`);
      list[index] = edited;
      parsed[importEdit.kind] = list;
      setTextFields({ ...textFields, payload: JSON.stringify(parsed, null, 2) });
      setImportEdit(null);
      setResult({ type: "info", message: "已写入 JSON 文本，请重新点击“校验 JSON”更新预览。" });
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "编辑失败。" });
    }
  }

  function selectedLabel(row: any) {
    return row.profile?.displayName ?? row.title ?? row.name ?? row.key ?? row.email ?? row.id;
  }

  function openCourseEditor(course: any) {
    setSelectedId(course.id);
    setResult({ type: "info", message: `正在编辑课程：${course.code} · ${course.title}` });
    window.setTimeout(() => courseEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function courseDraftPayload(draft: Record<string, string> = courseDraft) {
    const payload: Record<string, unknown> = {};
    ["code", "title", "description", "credits", "ownerUnit", "categoryTags", "courseType", "status", "manualNote"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(draft, field)) payload[field] = draft[field];
    });
    return payload;
  }

  function courseRawJsonText(draft: Record<string, string> = courseDraft) {
    return JSON.stringify(courseDraftPayload(draft), null, 2);
  }

  function coursePayloadFromRawJson(rawJson: string) {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("课程 JSON 必须是一个对象。");
    }
    const source = parsed as Record<string, unknown>;
    const payload: Record<string, unknown> = {};
    ["code", "title", "description", "credits", "courseType", "status", "manualNote"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(source, field)) payload[field] = source[field] === null || source[field] === undefined ? "" : String(source[field]);
    });
    if (Object.prototype.hasOwnProperty.call(source, "ownerUnit")) {
      payload.ownerUnit = typeof source.ownerUnit === "string" ? source.ownerUnit : JSON.stringify(source.ownerUnit ?? {}, null, 2);
    }
    if (Object.prototype.hasOwnProperty.call(source, "categoryTags")) {
      payload.categoryTags = Array.isArray(source.categoryTags) ? source.categoryTags.join(", ") : String(source.categoryTags ?? "");
    }
    return payload;
  }

  const ctx = {
    actionData,
    adminNote,
    approvalDecisions,
    busyAction,
    contentAnnouncementCreating,
    contentAnnouncementData,
    contentAnnouncementError,
    contentAnnouncementId,
    contentAnnouncementLoading,
    contentCreating,
    contentExpandedIds,
    contentTab,
    contentTreeQuery,
    courseDraft,
    courseEditorRef,
    coursePage,
    courseQuery,
    courseSourceFilter,
    courseStatusFilter,
    courseTagFilter,
    data,
    errorEventQuery,
    importEdit,
    importPage,
    importPreviewTab,
    importSearch,
    loadCourseImportPreview,
    openCourseEditor,
    primaryRows,
    resource,
    role,
    rows,
    runAction,
    selectedCourse,
    selectedId,
    selectedLabel,
    setAdminNote,
    setApprovalDecisions,
    setContentAnnouncementCreating,
    setContentAnnouncementId,
    setContentCreating,
    setContentExpandedIds,
    setContentTab,
    setContentTreeQuery,
    setCourseDraft,
    setCoursePage,
    setCourseQuery,
    setCourseSourceFilter,
    setCourseStatusFilter,
    setCourseTagFilter,
    setErrorEventQuery,
    setImportEdit,
    setImportPage,
    setImportPreviewTab,
    setImportSearch,
    setResult,
    setSelectedId,
    setStatus,
    setTextFields,
    setTicketCategoryFilter,
    setTicketQuery,
    setTicketStatusFilter,
    setRole,
    startImportEdit,
    status,
    textFields,
    ticketCategoryFilter,
    ticketQuery,
    ticketStatusFilter,
    courseDraftPayload,
    coursePayloadFromRawJson,
    courseRawJsonText,
    payloadForEditing,
    applyImportEdit
  };

  function renderAdminForm() {
    if (resource === "content") return <ContentAdminPanel ctx={ctx} />;
    if (resource === "versions") return <VersionsAdminPanel ctx={ctx} />;
    if (resource === "logs") return <LogsAdminPanel ctx={ctx} />;
    if (resource === "error-events") return <ErrorEventsAdminPanel ctx={ctx} />;
    if (resource === "course-submissions") return <DeprecatedCourseSubmissionsPanel />;
    if (resource === "course-imports") return <CourseImportsAdminPanel ctx={ctx} />;
    if (resource === "users") return <UsersAdminPanel ctx={ctx} />;
    if (resource === "admin-users") return <AdminUsersPanel ctx={ctx} />;
    if (resource === "schools") return <SchoolsAdminPanel ctx={ctx} />;
    if (resource === "majors") return <MajorsAdminPanel ctx={ctx} />;
    if (resource === "courses") return <CoursesAdminPanel ctx={ctx} />;
    if (resource === "boards") return <BoardsAdminPanel ctx={ctx} />;
    if (resource === "teamaking-posts" || resource === "team-up-requests") return <SocialModerationPanel ctx={ctx} />;
    if (resource === "support-tickets") return <SupportTicketsPanel ctx={ctx} />;
    if (resource === "configs") return <ConfigsPanel ctx={ctx} />;
    return <p className="text-sm text-ink/62">这个管理页目前只展示数据。</p>;
  }

  return (
    <PageShell title={title} eyebrow="Admin" description={description} aside="admin">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-5">
        {!["course-imports", "courses", "versions", "logs", "support-tickets", "content"].includes(resource) ? rows.map(([key, rows]) => {
          const filteredRows = rows.filter((row) => !adminTableQuery || JSON.stringify(row).toLowerCase().includes(adminTableQuery.toLowerCase()));
          const rawColumns = Object.keys(rows[0] ?? { empty: "" }).filter((column) => column !== "appVersionId");
          const columns = [...rawColumns.filter((column) => column !== "id").slice(0, 7), ...(rawColumns.includes("id") ? ["id"] : [])];
          return (
            <Card key={key}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-ink">{key}</h2>
                  <span className="rounded-lg bg-mist px-2.5 py-1 text-xs font-semibold text-moss">{filteredRows.length} / {rows.length} records</span>
                </div>
                <input className={`${inputClass} md:max-w-xs`} value={adminTableQuery} onChange={(event) => setAdminTableQuery(event.target.value)} placeholder="搜索邮箱、名称、role、code、year/status" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-ink/58">
                      {key === "users" ? <th className="px-3 py-2 font-semibold">Profile</th> : null}
                      {columns.map((column) => (
                          <th key={column} className="px-3 py-2 font-semibold">
                            {column}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id ?? JSON.stringify(row).slice(0, 20)} className="border-b border-ink/6">
                        {key === "users" ? (
                          <td className="px-3 py-2">
                            <Link href={`/profile/${row.id}`} className="border border-ink/30 px-2 py-1 text-xs font-semibold">查看 Profile</Link>
                          </td>
                        ) : null}
                        {columns.map((column) => (
                            <td key={column} className="max-w-[220px] truncate px-3 py-2 text-ink/72">
                              {column === "status" || column === "role" ? <StatusPill status={previewValue(row[column])} /> : previewValue(row[column])}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        }) : null}
        <Card>
          <h2 className="text-xl font-semibold text-ink">无代码管理操作</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">使用表单、下拉框和按钮完成管理，不需要手写接口路径或 JSON。</p>
          {result ? (
            <div className={`mt-4 border px-3 py-2 text-sm font-medium ${
              result.type === "error"
                ? "border-rust/40 bg-rust/5 text-rust"
                : result.type === "info"
                  ? "border-gold/40 bg-gold/10 text-ink"
                  : "border-forest/30 bg-forest/10 text-forest"
            }`}>
              {result.message}
            </div>
          ) : null}
          <div className="mt-4">{renderAdminForm()}</div>
        </Card>
      </div>
    </PageShell>
  );
}
