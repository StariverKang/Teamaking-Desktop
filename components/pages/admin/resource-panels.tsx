/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";import { StatusPill } from "@/components/app-shell";
import { inputClass } from "@/components/pages/page-primitives";

import type { AdminResourceContext } from "./resource-types";

export function UsersAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      return (
        <form
          className="grid gap-3 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(`/api/admin/users/${selectedId}`, "PATCH", { role, status, suspendedUntil: textFields.suspendedUntil, adminNote, onboardingCompleted: true });
          }}
        >
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
          </select>
          <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value)}>
            {["verified_user", "profile_completed_user", "course_moderator", "school_admin", "super_admin"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {["active", "suspended", "banned"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className={inputClass} type="datetime-local" value={textFields.suspendedUntil ?? ""} onChange={(event) => setTextFields({ ...textFields, suspendedUntil: event.target.value })} />
          <input className={inputClass} placeholder="管理员备注" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存用户</button>
        </form>
      );

}

export function AdminUsersPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const adminUsers = data?.adminUsers ?? [];
      return (
        <div className="grid gap-5">
          <form
            className="grid gap-3 md:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/admin-users", "POST", {
                email: textFields.email,
                password: textFields.password,
                displayName: textFields.displayName,
                role
              }, {
                busy: "create-admin-user",
                success: (response) => response.message ?? "管理员账号已创建。"
              });
            }}
          >
            <input className={inputClass} placeholder="管理员邮箱" value={textFields.email ?? ""} onChange={(event) => setTextFields({ ...textFields, email: event.target.value })} />
            <input className={inputClass} placeholder="显示名" value={textFields.displayName ?? ""} onChange={(event) => setTextFields({ ...textFields, displayName: event.target.value })} />
            <input className={inputClass} type="password" placeholder="初始密码" value={textFields.password ?? ""} onChange={(event) => setTextFields({ ...textFields, password: event.target.value })} />
            <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value)}>
              {["school_admin", "course_moderator", "super_admin"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <button disabled={Boolean(busyAction)} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
              {busyAction === "create-admin-user" ? "保存中..." : "创建/重置管理员"}
            </button>
          </form>
          <div className="overflow-auto border border-ink/15">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-ink text-paper"><tr>{["Email", "Display name", "Role", "Status"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
              <tbody>
                {adminUsers.map((user: any) => (
                  <tr key={user.id} className="border-b border-ink/10">
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.profile?.displayName ?? ""}</td>
                    <td className="px-3 py-2"><StatusPill status={user.role} /></td>
                    <td className="px-3 py-2"><StatusPill status={user.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

}

export function SchoolsAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      return (
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("/api/admin/schools", "POST", {
              name: textFields.name,
              shortName: textFields.shortName,
              domains: (textFields.domains ?? "").split(",").map((item) => item.trim()).filter(Boolean)
            });
          }}
        >
          <input className={inputClass} placeholder="学校名称" value={textFields.name ?? ""} onChange={(event) => setTextFields({ ...textFields, name: event.target.value })} />
          <input className={inputClass} placeholder="简称" value={textFields.shortName ?? ""} onChange={(event) => setTextFields({ ...textFields, shortName: event.target.value })} />
          <input className={inputClass} placeholder="邮箱域名，逗号分隔" value={textFields.domains ?? ""} onChange={(event) => setTextFields({ ...textFields, domains: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增学校</button>
        </form>
      );

}

export function MajorsAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const schools = data?.schools ?? [];
      const selectedSchoolId = textFields.schoolId || schools[0]?.id || "";
      const faculties = (data?.faculties ?? []).filter((faculty: any) => !selectedSchoolId || faculty.schoolId === selectedSchoolId);
      const selectedType = textFields.type ?? "major";
      return (
        <form
          className="grid gap-3 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("/api/admin/majors", "POST", {
              ...textFields,
              schoolId: selectedSchoolId,
              facultyId: textFields.facultyId || faculties[0]?.id
            });
          }}
        >
          <select className={inputClass} value={selectedType} onChange={(event) => setTextFields({ ...textFields, type: event.target.value })}>
            <option value="faculty">Faculty</option>
            <option value="major">Major</option>
            <option value="semester">Semester</option>
          </select>
          <select className={inputClass} value={selectedSchoolId} onChange={(event) => setTextFields({ ...textFields, schoolId: event.target.value, facultyId: "" })}>
            {schools.map((school: any) => <option key={school.id} value={school.id}>{school.shortName} · {school.name}</option>)}
          </select>
          <input className={inputClass} placeholder="名称" value={textFields.name ?? ""} onChange={(event) => setTextFields({ ...textFields, name: event.target.value })} />
          {selectedType === "major" ? (
            <select className={inputClass} value={textFields.facultyId || faculties[0]?.id || ""} onChange={(event) => setTextFields({ ...textFields, facultyId: event.target.value })}>
              {faculties.map((faculty: any) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
            </select>
          ) : null}
          {selectedType === "semester" ? (
            <>
              <input className={inputClass} placeholder="年份，例如 2025" value={textFields.year ?? ""} onChange={(event) => setTextFields({ ...textFields, year: event.target.value })} />
              <select className={inputClass} value={textFields.term ?? "Fall"} onChange={(event) => setTextFields({ ...textFields, term: event.target.value })}>
                {["Fall", "Spring", "Summer"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </>
          ) : null}
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增结构项</button>
        </form>
      );

}

export function BoardsAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const offerings = data?.offerings ?? [];
      const selectedOfferingId = textFields.courseOfferingId || offerings[0]?.id || "";
      const offeringLabel = (offering: any) => `${offering.course?.code ?? ""} ${offering.course?.title ?? ""} · ${offering.semester?.name ?? ""}${offering.section ? ` · ${offering.section}` : ""}`;
      return (
        <div className="grid gap-5">
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/boards", "POST", {
                courseOfferingId: selectedOfferingId,
                title: textFields.title,
                rules: textFields.rules,
                status
              });
            }}
          >
            <select className={inputClass} value={selectedOfferingId} onChange={(event) => setTextFields({ ...textFields, courseOfferingId: event.target.value })}>
              {offerings.map((offering: any) => <option key={offering.id} value={offering.id}>{offeringLabel(offering)}</option>)}
            </select>
            <input className={inputClass} placeholder="Course Board 标题" value={textFields.title ?? ""} onChange={(event) => setTextFields({ ...textFields, title: event.target.value })} />
            <input className={inputClass} placeholder="规则文案（可选）" value={textFields.rules ?? ""} onChange={(event) => setTextFields({ ...textFields, rules: event.target.value })} />
            <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增 Course Board</button>
          </form>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(`/api/admin/boards/${selectedId}`, "PATCH", { status, title: textFields.title, rules: textFields.rules });
            }}
          >
            <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
            </select>
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              {["active", "paused", "closed"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <input className={inputClass} placeholder="规则文案（可选）" value={textFields.rules ?? ""} onChange={(event) => setTextFields({ ...textFields, rules: event.target.value })} />
            <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存 Course Board</button>
          </form>
        </div>
      );

}

export function SocialModerationPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const statusOptions = resource === "teamaking-posts" ? ["open", "paused", "closed", "expired"] : ["reported", "closed", "deleted"];
      const path = resource === "teamaking-posts" ? `/api/admin/teamaking-posts/${selectedId}` : `/api/admin/team-up-requests/${selectedId}`;
      return (
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(path, "PATCH", { status });
          }}
        >
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存状态</button>
        </form>
      );

}

export function ConfigsPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const key = textFields.key ?? "developer_contact";
      const value = key === "system_status" ? { status: textFields.systemStatus ?? "active", message: textFields.value ?? "" } : { text: textFields.value ?? "" };
      return (
        <form
          className="grid gap-3 md:grid-cols-[220px_180px_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(`/api/admin/configs/${key}`, "PATCH", { value });
          }}
        >
          <select className={inputClass} value={key} onChange={(event) => setTextFields({ ...textFields, key: event.target.value })}>
            {["developer_contact", "landing_page", "onboarding_guide", "course_board_rules", "system_status"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className={inputClass} value={textFields.systemStatus ?? "active"} onChange={(event) => setTextFields({ ...textFields, systemStatus: event.target.value })} disabled={key !== "system_status"}>
            {["active", "paused"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className={inputClass} placeholder={key === "system_status" ? "暂停提示文案" : "配置内容"} value={textFields.value ?? ""} onChange={(event) => setTextFields({ ...textFields, value: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存配置</button>
        </form>
      );

}
