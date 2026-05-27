/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";import { StatusPill } from "@/components/app-shell";

import { Field, inputClass } from "@/components/pages/page-primitives";
import type { AdminResourceContext } from "./resource-types";

export function CoursesAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const courses = data?.courses ?? [];
      const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: courses.length };
      const sources = data?.filters?.sources ?? [];
      const tags = data?.filters?.tags ?? [];
      return (
        <div className="grid gap-5">
          <div className="border border-ink/15 bg-chalk p-4">
            <h3 className="text-lg font-semibold text-ink">Course catalog search</h3>
            <p className="mt-1 text-sm leading-6 text-ink/62">课程目录是 Course；每届学生课程安排是 curriculum rules。相同 title 可以对应不同 code，实际身份以课程代码为准。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_180px_1fr_auto_auto]">
              <input className={inputClass} placeholder="Search code or title, e.g. Principles of" value={courseQuery} onChange={(event) => { setCourseQuery(event.target.value); setCoursePage(1); }} />
              <select className={inputClass} value={courseStatusFilter} onChange={(event) => { setCourseStatusFilter(event.target.value); setCoursePage(1); }}>
                {["all", "active", "inactive", "archived"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className={inputClass} value={courseSourceFilter} onChange={(event) => { setCourseSourceFilter(event.target.value); setCoursePage(1); }}>
                <option value="all">all sources</option>
                {sources.map((item: string) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input className={inputClass} list="course-tag-options" placeholder="Filter tag" value={courseTagFilter} onChange={(event) => { setCourseTagFilter(event.target.value); setCoursePage(1); }} />
              <datalist id="course-tag-options">{tags.map((item: string) => <option key={item} value={item} />)}</datalist>
              <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setCoursePage(Math.max(1, coursePage - 1))}>Prev</button>
              <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setCoursePage(Math.min(pagination.totalPages ?? 1, coursePage + 1))}>Next</button>
            </div>
            <p className="mt-3 text-sm font-semibold text-ink/64">Page {pagination.page ?? coursePage} / {pagination.totalPages ?? 1} · {pagination.total ?? courses.length} courses</p>
            <div className="mt-4 max-h-[520px] overflow-auto border border-ink/10 bg-paper">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper">
                  <tr>
                    {["Code", "Title", "Credits", "Status", "Source", "Tags", "Usage", "Action"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course: any) => (
                    <tr key={course.id} className={`border-b border-ink/10 ${selectedCourse?.id === course.id ? "bg-mist/60" : ""}`}>
                      <td className="px-3 py-2 font-semibold">{course.code}</td>
                      <td className="px-3 py-2">{course.title}</td>
                      <td className="px-3 py-2">{course.credits ?? ""}</td>
                      <td className="px-3 py-2"><StatusPill status={course.status} /></td>
                      <td className="px-3 py-2">{course.source}</td>
                      <td className="max-w-[260px] px-3 py-2 text-xs text-ink/62">{Array.isArray(course.categoryTags) ? course.categoryTags.join(", ") : ""}</td>
                      <td className="px-3 py-2 text-xs text-ink/62">{course.usage?.totalRules ?? 0} rules · {course._count?.offerings ?? 0} offerings</td>
                      <td className="px-3 py-2">
                        <button type="button" className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" onClick={() => openCourseEditor(course)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedCourse ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-ink/15 bg-mist/30 px-3 py-2 text-sm">
                <p className="font-semibold text-ink">正在编辑：{selectedCourse.code} · {selectedCourse.title}</p>
                <button type="button" className="rounded-sm border border-ink/30 px-3 py-1 font-semibold" onClick={() => courseEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  跳到编辑表单
                </button>
              </div>
            ) : (
              <p className="mt-4 border border-ink/10 bg-paper px-3 py-2 text-sm text-ink/62">点击某门课程右侧的 Edit 后，会打开这门课的视觉化编辑表单。</p>
            )}
          </div>

          <form
            className="grid gap-3 border border-ink/15 p-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/courses", "POST", textFields, {
                busy: "create-course",
                success: (response) => `已新增课程：${response.course?.code} ${response.course?.title}`,
                after: (response) => {
                  if (response.course?.id) setSelectedId(response.course.id);
                  setTextFields({});
                }
              });
            }}
          >
            <div className="md:col-span-4">
              <h3 className="text-lg font-semibold text-ink">Add course</h3>
              <p className="mt-1 text-sm text-ink/62">默认添加到 BNBU，不需要填写内部 schoolId。</p>
            </div>
            <input className={inputClass} placeholder="课程代码" value={textFields.code ?? ""} onChange={(event) => setTextFields({ ...textFields, code: event.target.value })} />
            <input className={inputClass} placeholder="课程名称" value={textFields.title ?? ""} onChange={(event) => setTextFields({ ...textFields, title: event.target.value })} />
            <input className={inputClass} placeholder="学分" value={textFields.credits ?? ""} onChange={(event) => setTextFields({ ...textFields, credits: event.target.value })} />
            <input className={inputClass} placeholder="标签，逗号分隔" value={textFields.categoryTags ?? ""} onChange={(event) => setTextFields({ ...textFields, categoryTags: event.target.value })} />
            <textarea className={`${inputClass} md:col-span-3`} rows={3} placeholder="课程描述" value={textFields.description ?? ""} onChange={(event) => setTextFields({ ...textFields, description: event.target.value })} />
            <button disabled={Boolean(busyAction)} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{busyAction === "create-course" ? "新增中..." : "新增课程"}</button>
          </form>

          {selectedCourse ? (
            <div ref={courseEditorRef} className="scroll-mt-24 grid gap-4 border border-ink/15 p-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">Edit {selectedCourse.code} · {selectedCourse.title}</h3>
                <p className="mt-1 text-sm text-ink/62">保存后这些字段会被标记为管理员手动覆盖，后续 JSON 导入默认不覆盖它们。</p>
              </div>
              <form
                className="grid gap-3 md:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(`/api/admin/courses/${selectedCourse.id}`, "PATCH", courseDraftPayload(), {
                    busy: "save-course",
                    success: (response) => `已保存课程：${response.course?.code} ${response.course?.title}`
                  });
                }}
              >
                <Field label="Code"><input className={inputClass} value={courseDraft.code ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, code: event.target.value })} /></Field>
                <Field label="Title"><input className={inputClass} value={courseDraft.title ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, title: event.target.value })} /></Field>
                <Field label="Credits"><input className={inputClass} value={courseDraft.credits ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, credits: event.target.value })} /></Field>
                <Field label="Course type"><input className={inputClass} value={courseDraft.courseType ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, courseType: event.target.value })} /></Field>
                <Field label="Status">
                  <select className={inputClass} value={courseDraft.status ?? "active"} onChange={(event) => setCourseDraft({ ...courseDraft, status: event.target.value })}>
                    {["active", "inactive", "archived"].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Category tags"><input className={inputClass} value={courseDraft.categoryTags ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, categoryTags: event.target.value })} /></Field>
                <Field label="Owner unit JSON"><textarea className={inputClass} rows={4} value={courseDraft.ownerUnit ?? "{}"} onChange={(event) => setCourseDraft({ ...courseDraft, ownerUnit: event.target.value })} /></Field>
                <Field label="Manual note"><textarea className={inputClass} rows={4} value={courseDraft.manualNote ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, manualNote: event.target.value })} /></Field>
                <Field label="Description"><textarea className={inputClass} rows={4} value={courseDraft.description ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, description: event.target.value })} /></Field>
                <div className="md:col-span-3">
                  <button disabled={Boolean(busyAction)} className="rounded-sm bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyAction === "save-course" ? "保存中..." : "保存课程"}</button>
                </div>
              </form>
              <div className="grid gap-4 border border-ink/15 bg-chalk p-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Course offerings</p>
                  <p className="mt-1 text-xs text-ink/58">Course 是课程目录；CourseOffering 是某学期开课配置，可从这里生成或复用 Course Board。</p>
                </div>
                <form
                  className="grid gap-3 md:grid-cols-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runAction(`/api/admin/courses/${selectedCourse.id}/offerings`, "POST", {
                      semesterId: textFields.offeringSemesterId || data?.semesters?.[0]?.id,
                      teacherName: textFields.offeringTeacherName,
                      section: textFields.offeringSection,
                      status: textFields.offeringStatus || "active",
                      createBoard: true,
                      boardTitle: textFields.offeringBoardTitle
                    }, {
                      busy: "create-offering",
                      success: (response) => response.reused ? "已复用并更新开课配置。" : "已新增开课配置并生成 Course Board。"
                    });
                  }}
                >
                  <select className={inputClass} value={textFields.offeringSemesterId || data?.semesters?.[0]?.id || ""} onChange={(event) => setTextFields({ ...textFields, offeringSemesterId: event.target.value })}>
                    {(data?.semesters ?? []).map((semester: any) => <option key={semester.id} value={semester.id}>{semester.name} · {semester.term}</option>)}
                  </select>
                  <input className={inputClass} placeholder="老师（可选）" value={textFields.offeringTeacherName ?? ""} onChange={(event) => setTextFields({ ...textFields, offeringTeacherName: event.target.value })} />
                  <input className={inputClass} placeholder="Section（可选）" value={textFields.offeringSection ?? ""} onChange={(event) => setTextFields({ ...textFields, offeringSection: event.target.value })} />
                  <input className={inputClass} placeholder="Board 标题（可选）" value={textFields.offeringBoardTitle ?? ""} onChange={(event) => setTextFields({ ...textFields, offeringBoardTitle: event.target.value })} />
                  <button disabled={Boolean(busyAction)} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{busyAction === "create-offering" ? "保存中..." : "新增开课"}</button>
                </form>
                <div className="max-h-52 overflow-auto border border-ink/10 bg-paper">
                  <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                    <thead className="bg-ink text-paper"><tr>{["Semester", "Teacher", "Section", "Boards", "Status"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                    <tbody>
                      {(selectedCourse.offerings ?? []).map((offering: any) => (
                        <tr key={offering.id} className="border-b border-ink/10">
                          <td className="px-3 py-2">{offering.semester?.name ?? ""}</td>
                          <td className="px-3 py-2">{offering.teacherName ?? ""}</td>
                          <td className="px-3 py-2">{offering.section ?? ""}</td>
                          <td className="px-3 py-2">{offering.boards?.length ?? 0}</td>
                          <td className="px-3 py-2"><StatusPill status={offering.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <form
                className="grid gap-3 border border-rust/30 bg-rust/5 p-3 md:grid-cols-[1fr_1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(`/api/admin/courses/${selectedCourse.id}/merge`, "POST", {
                    targetCourseId: textFields.mergeTargetCourseId,
                    adminNote: textFields.mergeNote
                  }, {
                    busy: "merge-course",
                    success: (response) => response.message ?? "课程已合并。"
                  });
                }}
              >
                <select className={inputClass} value={textFields.mergeTargetCourseId ?? ""} onChange={(event) => setTextFields({ ...textFields, mergeTargetCourseId: event.target.value })}>
                  <option value="">选择合并目标课程</option>
                  {courses.filter((course: any) => course.id !== selectedCourse.id).map((course: any) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
                </select>
                <input className={inputClass} placeholder="合并备注（可选）" value={textFields.mergeNote ?? ""} onChange={(event) => setTextFields({ ...textFields, mergeNote: event.target.value })} />
                <button disabled={Boolean(busyAction) || !textFields.mergeTargetCourseId} className="rounded-sm border border-rust px-4 py-2 text-sm font-semibold text-rust disabled:opacity-50">{busyAction === "merge-course" ? "合并中..." : "合并并归档源课"}</button>
              </form>
              <details className="border border-ink/15 bg-chalk p-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Advanced JSON editor</summary>
                <p className="mt-2 text-sm leading-6 text-ink/60">备用入口：只接受课程目录字段，不直接编辑内部 schoolId、rule 或 offering。</p>
                <textarea
                  className={`${inputClass} mt-3 font-mono text-xs`}
                  rows={12}
                  value={courseDraft.rawJson ?? courseRawJsonText()}
                  onChange={(event) => setCourseDraft({ ...courseDraft, rawJson: event.target.value })}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold"
                    onClick={() => setCourseDraft({ ...courseDraft, rawJson: courseRawJsonText() })}
                  >
                    从表单生成 JSON
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyAction)}
                    className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-50"
                    onClick={() => {
                      try {
                        const payload = coursePayloadFromRawJson(courseDraft.rawJson ?? "{}");
                        runAction(`/api/admin/courses/${selectedCourse.id}`, "PATCH", payload, {
                          busy: "save-course-json",
                          success: (response) => `已通过 JSON 保存课程：${response.course?.code} ${response.course?.title}`
                        });
                      } catch (error) {
                        setResult({ type: "error", message: error instanceof Error ? error.message : "课程 JSON 格式错误。" });
                      }
                    }}
                  >
                    {busyAction === "save-course-json" ? "保存中..." : "使用 JSON 保存"}
                  </button>
                </div>
              </details>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="border border-ink/15 bg-chalk p-3">
                  <p className="text-sm font-semibold text-ink">Manual override fields</p>
                  <p className="mt-2 text-sm text-ink/62">{Array.isArray(selectedCourse.manualOverrideFields) && selectedCourse.manualOverrideFields.length ? selectedCourse.manualOverrideFields.join(", ") : "None"}</p>
                </div>
                {[
                  ["Admission years", selectedCourse.usage?.cohortYears],
                  ["Majors", selectedCourse.usage?.majors],
                  ["Relative terms", selectedCourse.usage?.relativeTerms],
                  ["Academic terms", selectedCourse.usage?.academicTerms]
                ].map(([label, values]) => (
                  <div key={label as string} className="max-h-44 overflow-auto border border-ink/15 bg-chalk p-3">
                    <p className="text-sm font-semibold text-ink">{label as string}</p>
                    <div className="mt-2 grid gap-1 text-sm text-ink/62">
                      {Array.isArray(values) && values.length ? values.slice(0, 12).map((item: any) => <p key={item.key} className="flex justify-between gap-3"><span>{item.key}</span><strong>{item.count}</strong></p>) : <p>None</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border border-ink/15">
                <div className="border-b border-ink/10 bg-chalk px-3 py-2">
                  <p className="text-sm font-semibold text-ink">Academic term configuration</p>
                  <p className="mt-1 text-xs text-ink/58">显示这门课会在真实哪个学期配置给哪年入学、哪个专业或受众的学生。</p>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-ink text-paper"><tr>{["Academic term", "Admission", "Audience", "Relative term", "Classification", "Action", "Rule"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                    <tbody>
                      {(selectedCourse.usage?.academicTermRows ?? []).length ? (selectedCourse.usage?.academicTermRows ?? []).map((row: any) => (
                        <tr key={`${row.ruleId}-${row.entryYear}-${row.audience}-${row.relativeTermCode}`} className="border-b border-ink/10">
                          <td className="px-3 py-2 font-semibold">{row.academicTermLabel}</td>
                          <td className="px-3 py-2">{row.entryYear} {row.entryTerm}</td>
                          <td className="px-3 py-2">{row.audience}</td>
                          <td className="px-3 py-2">{row.relativeTermCode}</td>
                          <td className="px-3 py-2">{row.classification}</td>
                          <td className="px-3 py-2">{row.studentAction}</td>
                          <td className="px-3 py-2">{row.externalId}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-3 py-4 text-sm text-ink/48" colSpan={7}>No academic term configuration rows for this course.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="max-h-72 overflow-auto border border-ink/15">
                <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-ink text-paper"><tr>{["Rule", "Admission", "Major", "Term", "Classification", "Action"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                  <tbody>
                    {(selectedCourse.usage?.rules ?? []).map((rule: any) => (
                      <tr key={rule.id} className="border-b border-ink/10">
                        <td className="px-3 py-2">{rule.externalId}</td>
                        <td className="px-3 py-2">{rule.cohortYears?.join(", ")}</td>
                        <td className="px-3 py-2">{rule.allMajors ? "ALL" : rule.majorCodes?.join(", ")}</td>
                        <td className="px-3 py-2">{rule.relativeTermCodes?.join(", ")}</td>
                        <td className="px-3 py-2">{rule.classification}</td>
                        <td className="px-3 py-2">{rule.studentAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      );

}
