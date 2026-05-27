/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { Field, inputClass } from "@/components/pages/page-primitives";
import { previewValue } from "@/components/pages/shared/data-preview";
import type { AdminResourceContext } from "./resource-types";


export function CourseImportPreview({ preview, ctx }: { preview: any; ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

    if (!preview) return null;
    const counts = preview.counts ?? {};
    const validation = preview.validation ?? {};
    const coverage = preview.coverage ?? {};
    const databaseCoverage = preview.databaseCoverage ?? actionData?.databaseCoverage;
    const tables = preview.tables ?? {};
    const activeTable =
      importPreviewTab === "courses"
        ? tables.courses ?? []
        : importPreviewTab === "rules"
          ? tables.curriculumRules ?? []
          : importPreviewTab === "sources"
            ? tables.sourceRefs ?? []
            : importPreviewTab === "offerings"
              ? tables.offerings ?? []
              : [];
    const filteredTable = activeTable.filter((row: any) => JSON.stringify(row).toLowerCase().includes(importSearch.toLowerCase()));
    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(filteredTable.length / pageSize));
    const currentPage = Math.min(importPage, totalPages);
    const pageRows = filteredTable.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const metricRows = [
      ["New faculties", counts.newFaculties],
      ["Updated faculties", counts.updatedFaculties],
      ["New majors", counts.newMajors],
      ["Updated majors", counts.updatedMajors],
      ["New courses", counts.newCourses],
      ["Updated courses", counts.updatedCourses],
      ["New rules", counts.newRules],
      ["Changed rules", counts.changedRules],
      ["Retained rules", counts.retainedRules],
      ["Rules to deactivate", counts.rulesToDeactivate],
      ["Default-join rules", counts.defaultJoinRules],
      ["Searchable rules", counts.searchableRules],
      ["Offering courses", counts.offeringCourses],
      ["Offering sections", counts.offeringSections],
      ["Rules in term context", counts.rulesInAcademicTermContext],
      ["Boards to activate", counts.courseBoardsToActivate],
      ["Protected course conflicts", counts.protectedCourseConflicts],
      ["Estimated default joins", counts.estimatedDefaultJoinUsers]
    ];
    const tabs = [
      ["coverage", "Coverage"],
      ["courses", "Courses"],
      ["rules", "Rules"],
      ["sources", "Sources"],
      ["offerings", "Offerings"],
      ["diff", "Diff"]
    ];
    const coverageBlocks = [
      ["Admission years in this JSON", coverage.cohortYears],
      ["Admission years already in DB", databaseCoverage?.cohortYears],
      ["Classifications", coverage.classifications],
      ["Student actions", coverage.studentActions],
      ["Majors", coverage.majors],
      ["Relative terms", coverage.relativeTerms]
    ];
    function renderCountList(values: any[]) {
      const items = Array.isArray(values) ? values : [];
      return (
        <div className="max-h-56 overflow-auto pr-2">
          {items.length ? items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 border-b border-ink/10 py-1.5 text-sm">
              <span className="truncate text-ink/72">{item.key}</span>
              <span className="font-semibold text-ink">{item.count}</span>
            </div>
          )) : <p className="text-sm text-ink/48">None</p>}
        </div>
      );
    }
    function renderDataTable(rows: any[]) {
      const headers =
        importPreviewTab === "courses"
          ? ["code", "title", "credits", "status", "categoryTags", "protectedConflicts"]
          : importPreviewTab === "rules"
            ? ["id", "courseCode", "cohortYears", "majorCodes", "relativeTermCodes", "classification", "studentAction", "confidence"]
            : importPreviewTab === "sources"
              ? ["id", "title", "sourceType", "url"]
              : ["id", "courseCode", "semesterCode", "sections", "status", "sourceRefIds"];
      const headerLabels: Record<string, string> = {
        cohortYears: "admissionYears",
        semesterCode: "academicTerm",
        courseCode: "courseCode",
        relativeTermCodes: "relativeTerms"
      };
      const canEditRows = importPreviewTab === "courses" || importPreviewTab === "rules";
      return (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputClass} md:max-w-sm`}
              placeholder="Search code, major, classification, source..."
              value={importSearch}
              onChange={(event) => {
                setImportSearch(event.target.value);
                setImportPage(1);
              }}
            />
            <span className="text-sm text-ink/56">{filteredTable.length} rows</span>
            <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setImportPage(Math.max(1, currentPage - 1))}>Prev</button>
            <span className="text-sm font-semibold text-ink">Page {currentPage} / {totalPages}</span>
            <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setImportPage(Math.min(totalPages, currentPage + 1))}>Next</button>
          </div>
          <div className="max-h-[520px] overflow-auto border border-ink/15">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-ink text-paper">
                <tr>
                  {headers.map((header) => <th key={header} className="px-3 py-2 font-semibold">{headerLabels[header] ?? header}</th>)}
                  {canEditRows ? <th className="px-3 py-2 font-semibold">Edit</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-ink/10 odd:bg-chalk">
                    {headers.map((header) => (
                      <td key={header} className="max-w-[260px] px-3 py-2 align-top">
                        <span className="line-clamp-3 break-words">{previewValue(row[header])}</span>
                      </td>
                    ))}
                    {canEditRows ? (
                      <td className="px-3 py-2 align-top">
                        <button type="button" onClick={() => startImportEdit(row)} className="rounded-sm border border-ink/30 px-2 py-1 font-semibold">Edit</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    function renderDiffTable() {
      const asArray = (value: any) => Array.isArray(value) ? value : [];
      const rows = [
        ...asArray(preview.diff?.courses?.added).map((value: string) => ({ category: "Added course", item: value, details: "Will create a course catalog row." })),
        ...asArray(preview.diff?.courses?.updated).map((value: string) => ({ category: "Updated course", item: value, details: "Catalog metadata differs from this JSON." })),
        ...asArray(preview.diff?.courses?.protectedConflicts).map((item: any) => ({
          category: "Manual override conflict",
          item: item.code,
          details: asArray(item.fields).join(", ")
        })),
        ...asArray(preview.diff?.rules?.added).map((value: string) => ({ category: "Added rule", item: value, details: "Will add an admission-year curriculum rule." })),
        ...asArray(preview.diff?.rules?.changed).map((item: any) => ({
          category: "Changed rule",
          item: item.id,
          details: asArray(item.changedFields).join(", ")
        })),
        ...asArray(preview.diff?.rules?.wouldDeactivate).map((value: string) => ({ category: "Rule to deactivate", item: value, details: "Active database rule is absent from this JSON." }))
      ];
      const filteredRows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(importSearch.toLowerCase()));
      const diffTotalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
      const diffCurrentPage = Math.min(importPage, diffTotalPages);
      const diffPageRows = filteredRows.slice((diffCurrentPage - 1) * pageSize, diffCurrentPage * pageSize);

      return (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputClass} md:max-w-sm`}
              placeholder="Search diff by code, rule id, category..."
              value={importSearch}
              onChange={(event) => {
                setImportSearch(event.target.value);
                setImportPage(1);
              }}
            />
            <span className="text-sm text-ink/56">{filteredRows.length} changes</span>
            <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setImportPage(Math.max(1, diffCurrentPage - 1))}>Prev</button>
            <span className="text-sm font-semibold text-ink">Page {diffCurrentPage} / {diffTotalPages}</span>
            <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setImportPage(Math.min(diffTotalPages, diffCurrentPage + 1))}>Next</button>
          </div>
          <div className="max-h-[520px] overflow-auto border border-ink/15">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-ink text-paper">
                <tr>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Code / rule</th>
                  <th className="px-3 py-2 font-semibold">What changed</th>
                </tr>
              </thead>
              <tbody>
                {diffPageRows.length ? diffPageRows.map((row, index) => (
                  <tr key={`${row.category}-${row.item}-${index}`} className="border-b border-ink/10 odd:bg-chalk">
                    <td className="px-3 py-2 align-top font-semibold text-ink">{row.category}</td>
                    <td className="px-3 py-2 align-top font-mono text-ink/76">{row.item}</td>
                    <td className="px-3 py-2 align-top text-ink/64">{row.details || "No field detail available"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-3 py-4 text-sm text-ink/48" colSpan={3}>No diff rows match this search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return (
      <div className="grid gap-5 border-2 border-ink bg-paper p-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/12 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">Import Preview</h3>
            <p className="mt-1 text-sm text-ink/58">
              {preview.importMode === "cohort_handbook" ? "Admission-year programme handbook" : "Combined import"} · {preview.semester?.label ?? preview.semester?.code ?? "Academic term context"}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/64">{preview.semester?.note}</p>
          </div>
          <span className={`rounded-sm px-3 py-1 text-xs font-semibold ${validation.ok ? "bg-forest text-white" : "bg-rust text-white"}`}>
            {validation.ok ? "Valid" : "Invalid"}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          {metricRows.map(([label, value]) => (
            <div key={label as string} className="border border-ink/15 bg-chalk px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">{label}</p>
              <p className="mt-1 text-xl font-semibold text-ink">{String(value ?? 0)}</p>
            </div>
          ))}
        </div>
        {validation.errors?.length ? (
          <div className="border border-rust/40 bg-rust/5 p-3 text-sm text-rust">
            <p className="font-semibold">Errors</p>
            <ul className="mt-2 list-disc pl-5">
              {validation.errors.slice(0, 8).map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        {validation.warnings?.length ? (
          <div className="border border-ink/20 bg-chalk p-3 text-sm text-ink/68">
            <p className="font-semibold text-ink">Warnings</p>
            <ul className="mt-2 list-disc pl-5">
              {validation.warnings.slice(0, 8).map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setImportPreviewTab(key);
                setImportPage(1);
              }}
              className={`rounded-sm px-3 py-2 text-sm font-semibold ${importPreviewTab === key ? "bg-ink text-paper" : "border border-ink/30 text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {importPreviewTab === "coverage" ? (
          <div className="grid gap-3 md:grid-cols-3">
            {coverageBlocks.map(([label, values]) => (
              <div key={label as string} className="border border-ink/15 bg-chalk p-3">
                <p className="mb-2 text-sm font-semibold text-ink">{label as string}</p>
                {renderCountList(values as any[])}
              </div>
            ))}
          </div>
        ) : null}
        {["courses", "rules", "sources", "offerings"].includes(importPreviewTab) ? renderDataTable(pageRows) : null}
        {importPreviewTab === "diff" ? renderDiffTable() : null}
        {importEdit ? (
          <div className="border-2 border-coral bg-coral/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-ink">Editing {importEdit.kind === "courses" ? "course" : "curriculum rule"}: {importEdit.id}</p>
              <button type="button" className="rounded-sm border border-ink/30 px-3 py-1 text-sm font-semibold" onClick={() => setImportEdit(null)}>Close</button>
            </div>
            {importEdit.kind === "courses" ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Course code"><input className={inputClass} value={String(importEdit.draft.code ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, code: event.target.value } })} /></Field>
                <Field label="Title"><input className={inputClass} value={String(importEdit.draft.title ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, title: event.target.value } })} /></Field>
                <Field label="Credits"><input className={inputClass} value={String(importEdit.draft.credits ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, credits: event.target.value } })} /></Field>
                <Field label="Category tags"><input className={inputClass} value={String(importEdit.draft.categoryTags ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, categoryTags: event.target.value } })} /></Field>
                <Field label="Source refs"><input className={inputClass} value={String(importEdit.draft.sourceRefIds ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, sourceRefIds: event.target.value } })} /></Field>
                <Field label="Description"><textarea className={inputClass} rows={3} value={String(importEdit.draft.description ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, description: event.target.value } })} /></Field>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Course code"><input className={inputClass} value={String(importEdit.draft.courseCode ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, courseCode: event.target.value } })} /></Field>
                <Field label="Classification">
                  <select className={inputClass} value={String(importEdit.draft.classification ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, classification: event.target.value } })}>
                    {["major_required", "major_elective", "concentration_required", "free_elective", "university_core", "bba_core", "general_education", "internship", "final_year_project", "unknown"].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Student action">
                  <select className={inputClass} value={String(importEdit.draft.studentAction ?? "default_join")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, studentAction: event.target.value } })}>
                    {["default_join", "searchable_add", "recommend_only", "hidden"].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Major codes"><input className={inputClass} value={String(importEdit.draft.majorCodes ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, majorCodes: event.target.value } })} /></Field>
                <Field label="Faculty codes"><input className={inputClass} value={String(importEdit.draft.facultyCodes ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, facultyCodes: event.target.value } })} /></Field>
                <Field label="Admission years"><input className={inputClass} value={String(importEdit.draft.cohortYears ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, cohortYears: event.target.value } })} /></Field>
                <Field label="Relative terms"><input className={inputClass} value={String(importEdit.draft.relativeTermCodes ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, relativeTermCodes: event.target.value } })} /></Field>
                <Field label="Confidence"><input className={inputClass} value={String(importEdit.draft.confidence ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, confidence: event.target.value } })} /></Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={importEdit.draft.allMajors === true} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, allMajors: event.target.checked } })} />
                  All majors
                </label>
              </div>
            )}
            <details className="mt-3 text-xs text-ink/58">
              <summary className="cursor-pointer font-semibold text-ink">Advanced raw JSON preview</summary>
              <pre className="mt-2 max-h-56 overflow-auto border border-ink/15 bg-paper p-3">{JSON.stringify(importEdit.raw, null, 2)}</pre>
            </details>
            <button type="button" onClick={applyImportEdit} className="mt-3 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">Apply edit to JSON</button>
          </div>
        ) : null}
        </div>
    );

}
