/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";

import { Card, EmptyState, LoadingState, StatusPill } from "@/components/app-shell";

import { ErrorBox, Field, inputClass } from "@/components/pages/page-primitives";
import { MarkdownRenderer, contentKindLabels, buildContentTree, contentNodeType, ContentDocumentTree, ContentDocumentReader, contentImageUrls } from "@/components/pages/shared/content-parts";
import { api } from "@/lib/client/api";
import { parseContentMarkdownFile, type ContentMarkdownDraft } from "@/lib/content-markdown";

import type { AdminResourceContext } from "./resource-types";

export function ContentAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { actionData, adminNote, busyAction, contentAnnouncementCreating, contentAnnouncementData, contentAnnouncementError, contentAnnouncementId, contentAnnouncementLoading, contentCreating, contentExpandedIds, contentTab, contentTreeQuery, courseDraft, courseEditorRef, coursePage, courseQuery, courseSourceFilter, courseStatusFilter, courseTagFilter, data, errorEventQuery, importEdit, importPage, importPreviewTab, importSearch, loadCourseImportPreview, openCourseEditor, primaryRows, resource, role, rows, runAction, selectedCourse, selectedId, selectedLabel, setAdminNote, setContentAnnouncementCreating, setContentAnnouncementId, setContentCreating, setContentExpandedIds, setContentTab, setContentTreeQuery, setCourseDraft, setCoursePage, setCourseQuery, setCourseSourceFilter, setCourseStatusFilter, setCourseTagFilter, setErrorEventQuery, setImportEdit, setImportPage, setImportPreviewTab, setImportSearch, setResult, setSelectedId, setStatus, setTextFields, setTicketCategoryFilter, setTicketQuery, setTicketStatusFilter, setRole, startImportEdit, status, textFields, ticketCategoryFilter, ticketQuery, ticketStatusFilter, courseDraftPayload, coursePayloadFromRawJson, courseRawJsonText, payloadForEditing, applyImportEdit } = ctx;

      const documents = data?.documents ?? [];
      const announcements = contentAnnouncementData?.announcements ?? [];
      const contentTabs: { key: typeof contentTab; label: string; note: string }[] = [
        { key: "developer_contact", label: "联系开发者", note: "单页面内容，不使用树状结构" },
        { key: "developer_log", label: "开发日志", note: "可用树状结构管理版本记录" },
        { key: "help", label: "帮助中心", note: "可用树状结构管理帮助文档" },
        { key: "announcements", label: "全站公告", note: "公告弹窗与历史记录" }
      ];
      const query = contentTreeQuery.trim().toLowerCase();
      const activeDocumentKind = contentTab === "announcements" ? "help" : contentTab;
      const tabDocuments = documents.filter((document: any) => document.kind === activeDocumentKind);
      const visibleDocuments = tabDocuments.filter((document: any) => !query || [document.title, document.slug, document.summary, document.kind, document.status].some((value) => String(value ?? "").toLowerCase().includes(query)));
      const documentTree = buildContentTree(visibleDocuments);
      const selectedDocument = contentCreating ? null : tabDocuments.find((document: any) => document.id === selectedId);
      const draft = {
        kind: textFields.contentKind ?? selectedDocument?.kind ?? activeDocumentKind,
        nodeType: contentTab === "developer_contact" ? "document" : textFields.contentNodeType ?? selectedDocument?.nodeType ?? "document",
        title: textFields.contentTitle ?? selectedDocument?.title ?? "",
        slug: textFields.contentSlug ?? selectedDocument?.slug ?? "",
        parentId: textFields.contentParentId ?? selectedDocument?.parentId ?? "",
        summary: textFields.contentSummary ?? selectedDocument?.summary ?? "",
        bodyMarkdown: textFields.contentBodyMarkdown ?? selectedDocument?.bodyMarkdown ?? "",
        imageUrls: textFields.contentImageUrls ?? contentImageUrls(selectedDocument?.imageUrls).join(", "),
        status: textFields.contentStatus ?? selectedDocument?.status ?? "draft",
        displayOrder: textFields.contentDisplayOrder ?? String(selectedDocument?.displayOrder ?? 0)
      };
      const setDraft = (key: string, value: string) => setTextFields({ ...textFields, [key]: value });
      const startNewDocument = (nodeType: "folder" | "document" = "document", parent?: any) => {
        const nextKind = parent?.kind ?? activeDocumentKind;
        setContentCreating(true);
        setSelectedId("");
        setTextFields({
          ...textFields,
          contentKind: nextKind,
          contentNodeType: nodeType,
          contentTitle: "",
          contentSlug: "",
          contentParentId: parent?.id ?? "",
          contentSummary: "",
          contentBodyMarkdown: "",
          contentImageUrls: "",
          contentStatus: "draft",
          contentDisplayOrder: "0"
        });
        if (parent?.id) {
          setContentExpandedIds((current) => new Set(current).add(parent.id));
        }
      };
      const selectContentDocument = (document: any) => {
        setContentCreating(false);
        setSelectedId(document.id);
      };
      const draftImageUrls = draft.imageUrls.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3);
      const previewDocument = selectedDocument ?? {
        kind: draft.kind,
        slug: draft.slug || "new-document",
        title: draft.title || "未命名文档",
        nodeType: draft.nodeType,
        summary: draft.summary,
        bodyMarkdown: draft.bodyMarkdown,
        imageUrls: draftImageUrls,
        status: draft.status,
        updatedAt: null
      };
      const parentOptions = tabDocuments.filter((document: any) => document.id !== selectedDocument?.id && document.kind === draft.kind && contentNodeType(document) === "folder");
      const selectedAnnouncement = contentAnnouncementCreating ? null : announcements.find((announcement: any) => announcement.id === contentAnnouncementId);
      const announcementDraft = {
        titleZh: textFields.announcementTitleZh ?? selectedAnnouncement?.titleZh ?? "",
        titleEn: textFields.announcementTitleEn ?? selectedAnnouncement?.titleEn ?? "",
        bodyZh: textFields.announcementBodyZh ?? selectedAnnouncement?.bodyZh ?? "",
        bodyEn: textFields.announcementBodyEn ?? selectedAnnouncement?.bodyEn ?? "",
        priority: textFields.announcementPriority ?? String(selectedAnnouncement?.priority ?? 0),
        status: textFields.announcementStatus ?? selectedAnnouncement?.status ?? "draft",
        startsAt: textFields.announcementStartsAt ?? (selectedAnnouncement?.startsAt ? String(selectedAnnouncement.startsAt).slice(0, 16) : ""),
        endsAt: textFields.announcementEndsAt ?? (selectedAnnouncement?.endsAt ? String(selectedAnnouncement.endsAt).slice(0, 16) : "")
      };
      const setAnnouncementDraft = (key: string, value: string) => setTextFields({ ...textFields, [key]: value });
      const startNewAnnouncement = () => {
        setContentAnnouncementCreating(true);
        setContentAnnouncementId("");
        setTextFields({
          ...textFields,
          announcementTitleZh: "",
          announcementTitleEn: "",
          announcementBodyZh: "",
          announcementBodyEn: "",
          announcementPriority: "0",
          announcementStatus: "draft",
          announcementStartsAt: "",
          announcementEndsAt: ""
        });
      };
      const selectAnnouncement = (announcement: any) => {
        setContentAnnouncementCreating(false);
        setContentAnnouncementId(announcement.id);
      };
      const [markdownImports, setMarkdownImports] = useState<ContentMarkdownDraft[]>([]);
      const [markdownImporting, setMarkdownImporting] = useState(false);
      const markdownImportRows = buildMarkdownImportRows(markdownImports, tabDocuments);
      const blockingMarkdownRows = markdownImportRows.filter((row) => row.blocking);
      const readableMarkdownRows = markdownImportRows.filter((row) => row.action !== "skip");
      const handleMarkdownFiles = async (fileList: FileList | null) => {
        const files = Array.from(fileList ?? []).filter((file) => /\.md$/i.test(file.name));
        if (!files.length) {
          setMarkdownImports([]);
          setResult({ type: "error", message: "请选择 .md 文件。" });
          return;
        }
        const drafts = await Promise.all(files.map(async (file, index) => parseContentMarkdownFile({
          fileName: file.name,
          relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
          raw: await file.text(),
          index,
          kind: activeDocumentKind
        })));
        setMarkdownImports(drafts);
        setResult({ type: "info", message: `已读取 ${drafts.length} 个 Markdown 文件，请检查导入预览。` });
      };
      const applyMarkdownImports = async () => {
        if (!readableMarkdownRows.length) {
          setResult({ type: "error", message: "没有可导入的 Markdown 文件。" });
          return;
        }
        if (blockingMarkdownRows.length) {
          setResult({ type: "error", message: `还有 ${blockingMarkdownRows.length} 个 Markdown 条目无法导入，请先处理父级或重复 slug。` });
          return;
        }
        setMarkdownImporting(true);
        try {
          const idBySlug = new Map(tabDocuments.map((document: any) => [document.slug, document.id]));
          const sortedRows = [...readableMarkdownRows].sort((left, right) => {
            const leftFolder = left.draft.nodeType === "folder" ? 0 : 1;
            const rightFolder = right.draft.nodeType === "folder" ? 0 : 1;
            return leftFolder - rightFolder || left.draft.displayOrder - right.draft.displayOrder || left.draft.slug.localeCompare(right.draft.slug);
          });
          let changed = 0;
          for (const row of sortedRows) {
            const parentId = row.draft.parentSlug ? idBySlug.get(row.draft.parentSlug) ?? "" : "";
            const body = {
              kind: activeDocumentKind,
              nodeType: row.draft.nodeType,
              title: row.draft.title,
              slug: row.draft.slug,
              parentId,
              summary: row.draft.summary,
              bodyMarkdown: row.draft.bodyMarkdown,
              imageUrls: row.draft.imageUrls,
              status: row.draft.status,
              displayOrder: row.draft.displayOrder
            };
            const response = row.existing
              ? await api(`/api/admin/content/${row.existing.id}`, { method: "PATCH", body: JSON.stringify(body) })
              : await api("/api/admin/content", { method: "POST", body: JSON.stringify(body) });
            if (!response.document?.id) throw new Error(`导入 ${row.draft.fileName} 后没有返回文档 ID。`);
            idBySlug.set(row.draft.slug, response.document.id);
            changed += 1;
          }
          setMarkdownImports([]);
          setResult({ type: "success", message: `Markdown 导入完成：创建/更新 ${changed} 个内容节点。页面数据会自动刷新；如列表未变化，请刷新页面。` });
          window.setTimeout(() => window.location.reload(), 650);
        } catch (error) {
          setResult({ type: "error", message: error instanceof Error ? error.message : "Markdown 导入失败。" });
        } finally {
          setMarkdownImporting(false);
        }
      };
      const renderContentTabs = () => (
        <Card>
          <div className="grid gap-2 md:grid-cols-4">
            {contentTabs.map((tab) => {
              const active = contentTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setContentTab(tab.key);
                    setContentCreating(false);
                    setContentAnnouncementCreating(false);
                    setContentTreeQuery("");
                    setSelectedId("");
                    setContentAnnouncementId("");
                  }}
                  className={`rounded-sm border px-3 py-3 text-left ${active ? "border-ink bg-ink text-paper" : "border-ink/20 bg-paper text-ink hover:bg-chalk"}`}
                >
                  <span className="block font-semibold">{tab.label}</span>
                  <span className={`mt-1 block text-xs leading-5 ${active ? "text-paper/72" : "text-ink/52"}`}>{tab.note}</span>
                </button>
              );
            })}
          </div>
        </Card>
      );
      if (contentTab === "announcements") {
        return (
          <div className="grid gap-5">
            {renderContentTabs()}
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-ink">公告列表</h2>
                    <p className="mt-1 text-sm leading-6 text-ink/58">选择已有公告进行编辑；点新建公告才会进入新建模式。</p>
                  </div>
                  <span className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold text-moss">{announcements.length} 条</span>
                </div>
                <button type="button" onClick={startNewAnnouncement} className="mt-4 w-full rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper">新建公告</button>
                {contentAnnouncementLoading ? <LoadingState /> : null}
                <ErrorBox message={contentAnnouncementError ?? undefined} />
                <div className="mt-4 max-h-[620px] overflow-auto border border-ink/15 bg-paper">
                  {announcements.length ? announcements.map((announcement: any) => (
                    <button
                      key={announcement.id}
                      type="button"
                      onClick={() => selectAnnouncement(announcement)}
                      className={`block w-full border-b border-ink/10 px-3 py-3 text-left last:border-b-0 ${selectedAnnouncement?.id === announcement.id ? "bg-coral/10" : "hover:bg-chalk"}`}
                    >
                      <span className="block font-semibold text-ink">{announcement.titleZh}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/52">
                        <StatusPill status={announcement.status} />
                        <span>阅读 {announcement.readCount ?? 0}</span>
                        <span>{announcement.publishedAt ? new Date(announcement.publishedAt).toLocaleString() : "未发布"}</span>
                      </span>
                    </button>
                  )) : <EmptyState title="暂无公告" body="创建第一条公告后，会显示在这里。" />}
                </div>
              </Card>
              <div className="grid gap-5">
                <Card>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-ink">{selectedAnnouncement ? "编辑已有公告" : "新建公告"}</h2>
                      <p className="mt-1 text-sm text-ink/56">{selectedAnnouncement ? "正在编辑已保存公告；发布/归档按钮在表单底部。" : "这是一条尚未保存的新公告。"}</p>
                    </div>
                    {selectedAnnouncement ? <StatusPill status={selectedAnnouncement.status} /> : <StatusPill status="new" />}
                  </div>
                  <div className="border border-ink/15 bg-chalk p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rust">公告预览</p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{announcementDraft.titleZh || "未命名公告"}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink/68">{announcementDraft.bodyZh || "公告正文会显示在这里。"}</p>
                    {announcementDraft.titleEn || announcementDraft.bodyEn ? (
                      <div className="mt-4 border-t border-ink/10 pt-3 text-sm leading-6 text-ink/52">
                        <p className="font-semibold">{announcementDraft.titleEn}</p>
                        <p className="mt-1 whitespace-pre-wrap">{announcementDraft.bodyEn}</p>
                      </div>
                    ) : null}
                  </div>
                </Card>
                <Card>
                  <h2 className="text-xl font-semibold text-ink">公告编辑</h2>
                  <form
                    className="mt-4 grid gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const body = {
                        titleZh: announcementDraft.titleZh,
                        titleEn: announcementDraft.titleEn,
                        bodyZh: announcementDraft.bodyZh,
                        bodyEn: announcementDraft.bodyEn,
                        priority: Number(announcementDraft.priority) || 0,
                        status: selectedAnnouncement ? undefined : announcementDraft.status,
                        startsAt: announcementDraft.startsAt,
                        endsAt: announcementDraft.endsAt
                      };
                      runAction(selectedAnnouncement ? `/api/admin/announcements/${selectedAnnouncement.id}` : "/api/admin/announcements", selectedAnnouncement ? "PATCH" : "POST", body, {
                        success: (response) => response.message ?? "公告已保存。",
                        after: (response) => {
                          if (response.announcement?.id) {
                            setContentAnnouncementCreating(false);
                            setContentAnnouncementId(response.announcement.id);
                          }
                        }
                      });
                    }}
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="中文标题">
                        <input className={inputClass} value={announcementDraft.titleZh} onChange={(event) => setAnnouncementDraft("announcementTitleZh", event.target.value)} required />
                      </Field>
                      <Field label="English title">
                        <input className={inputClass} value={announcementDraft.titleEn} onChange={(event) => setAnnouncementDraft("announcementTitleEn", event.target.value)} />
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="中文正文">
                        <textarea className={inputClass} rows={7} value={announcementDraft.bodyZh} onChange={(event) => setAnnouncementDraft("announcementBodyZh", event.target.value)} required />
                      </Field>
                      <Field label="English body">
                        <textarea className={inputClass} rows={7} value={announcementDraft.bodyEn} onChange={(event) => setAnnouncementDraft("announcementBodyEn", event.target.value)} />
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="优先级">
                        <input type="number" className={inputClass} value={announcementDraft.priority} onChange={(event) => setAnnouncementDraft("announcementPriority", event.target.value)} />
                      </Field>
                      <Field label="新建后状态">
                        <select className={inputClass} value={announcementDraft.status} onChange={(event) => setAnnouncementDraft("announcementStatus", event.target.value)} disabled={Boolean(selectedAnnouncement)}>
                          <option value="draft">草稿</option>
                          <option value="published">创建后立即发布</option>
                        </select>
                      </Field>
                      <Field label="开始时间（可选）">
                        <input type="datetime-local" className={inputClass} value={announcementDraft.startsAt} onChange={(event) => setAnnouncementDraft("announcementStartsAt", event.target.value)} />
                      </Field>
                      <Field label="结束时间（可选）">
                        <input type="datetime-local" className={inputClass} value={announcementDraft.endsAt} onChange={(event) => setAnnouncementDraft("announcementEndsAt", event.target.value)} />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">{selectedAnnouncement ? "保存公告修改" : "创建公告"}</button>
                      {selectedAnnouncement && selectedAnnouncement.status !== "published" ? (
                        <button type="button" onClick={() => runAction(`/api/admin/announcements/${selectedAnnouncement.id}/publish`, "POST", {}, { success: (response) => response.message ?? "公告已发布。" })} className="rounded-sm border border-ink/30 px-4 py-2 text-sm font-semibold">
                          发布
                        </button>
                      ) : null}
                      {selectedAnnouncement && selectedAnnouncement.status !== "archived" ? (
                        <button type="button" onClick={() => runAction(`/api/admin/announcements/${selectedAnnouncement.id}/archive`, "POST", {}, { success: (response) => response.message ?? "公告已归档。" })} className="rounded-sm border border-rust/40 px-4 py-2 text-sm font-semibold text-rust">
                          归档
                        </button>
                      ) : null}
                    </div>
                  </form>
                </Card>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="grid gap-5">
          {renderContentTabs()}
          <div className={`grid gap-5 ${contentTab === "developer_contact" ? "xl:grid-cols-[360px_1fr]" : "xl:grid-cols-[380px_1fr]"}`}>
            <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">{contentTab === "developer_contact" ? "联系开发者页面" : "已有内容"}</h2>
                <p className="mt-1 text-sm leading-6 text-ink/58">{contentTab === "developer_contact" ? "这是单页面内容；选择已有页面编辑，或新建替代页面。" : "展开目录、点击文档后在右侧编辑；新建内容单独进入新建模式。"}</p>
              </div>
              <span className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold text-moss">{visibleDocuments.length} / {tabDocuments.length}</span>
            </div>
            <div className="mt-4 grid gap-3">
              <input className={inputClass} value={contentTreeQuery} onChange={(event) => setContentTreeQuery(event.target.value)} placeholder="搜索标题、slug、摘要、状态" />
              <div className="flex flex-wrap gap-2">
                {contentTab === "developer_contact" ? (
                  <button type="button" onClick={() => startNewDocument("document")} className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper">新建联系开发者页面</button>
                ) : (
                  <>
                    <button type="button" onClick={() => startNewDocument("folder")} className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper">新建根文件夹</button>
                    <button type="button" onClick={() => startNewDocument("document")} className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold">新建根文档</button>
                  </>
                )}
              </div>
              {contentTab !== "developer_contact" ? (
                <div className="grid gap-3 border border-ink/15 bg-chalk p-3">
                  <div>
                    <h3 className="text-base font-semibold text-ink">导入 Markdown</h3>
                    <p className="mt-1 text-sm leading-6 text-ink/58">选择本地 .md 文件或文件夹；系统会读取 frontmatter、标题、摘要和父级关系，先显示预览，不会上传原始文件。</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm font-semibold hover:bg-mist">
                      选择 Markdown 文件
                      <input
                        className="hidden"
                        type="file"
                        accept=".md,text/markdown"
                        multiple
                        onChange={(event) => handleMarkdownFiles(event.target.files)}
                      />
                    </label>
                    <label className="cursor-pointer rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm font-semibold hover:bg-mist">
                      选择 Markdown 文件夹
                      <input
                        className="hidden"
                        type="file"
                        accept=".md,text/markdown"
                        multiple
                        onChange={(event) => handleMarkdownFiles(event.target.files)}
                        {...({ webkitdirectory: "", directory: "" } as any)}
                      />
                    </label>
                    {markdownImports.length ? (
                      <button
                        type="button"
                        onClick={() => setMarkdownImports([])}
                        className="rounded-sm border border-rust/40 px-3 py-2 text-sm font-semibold text-rust"
                      >
                        清空预览
                      </button>
                    ) : null}
                  </div>
                  {markdownImports.length ? (
                    <div className="grid gap-3">
                      <div className="max-h-80 overflow-auto border border-ink/12 bg-paper">
                        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                          <thead className="bg-ink text-paper">
                            <tr>
                              {["文件", "动作", "节点", "Slug", "父级", "状态", "标题", "提示"].map((header) => <th key={header} className="px-2 py-2">{header}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {markdownImportRows.map((row) => (
                              <tr key={`${row.draft.relativePath}-${row.draft.slug}`} className={`border-b border-ink/10 ${row.blocking ? "bg-rust/5" : row.action === "skip" ? "bg-ink/5 text-ink/48" : ""}`}>
                                <td className="max-w-[180px] truncate px-2 py-2">{row.draft.relativePath}</td>
                                <td className="px-2 py-2 font-semibold">{row.action === "create" ? "创建" : row.action === "update" ? "更新" : "跳过"}</td>
                                <td className="px-2 py-2">{row.draft.nodeType === "folder" ? "文件夹" : "文档"}</td>
                                <td className="px-2 py-2">{row.draft.slug}</td>
                                <td className="px-2 py-2">{row.draft.parentSlug || "根"}</td>
                                <td className="px-2 py-2">{row.draft.status}</td>
                                <td className="max-w-[180px] truncate px-2 py-2">{row.draft.title}</td>
                                <td className="max-w-[220px] px-2 py-2 text-rust">{row.reason || row.draft.warnings.join("; ")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={markdownImporting || blockingMarkdownRows.length > 0 || readableMarkdownRows.length === 0}
                          onClick={applyMarkdownImports}
                          className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-50"
                        >
                          {markdownImporting ? "导入中..." : `导入 ${readableMarkdownRows.length} 个内容节点`}
                        </button>
                        {blockingMarkdownRows.length ? <span className="text-sm font-semibold text-rust">{blockingMarkdownRows.length} 个条目需要处理后才能导入。</span> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="max-h-[620px] overflow-auto border border-ink/15 bg-paper p-2">
                {contentTab === "developer_contact" ? (
                  visibleDocuments.length ? visibleDocuments.map((document: any) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => selectContentDocument(document)}
                      className={`block w-full border-b border-ink/10 px-3 py-3 text-left last:border-b-0 ${selectedDocument?.id === document.id ? "bg-coral/10" : "hover:bg-chalk"}`}
                    >
                      <span className="block font-semibold text-ink">{document.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/52">
                        <StatusPill status={document.status} />
                        <span>/{document.slug}</span>
                      </span>
                    </button>
                  )) : <EmptyState title="暂无联系开发者页面" body="点击上方按钮新建内容。" />
                ) : (
                  <ContentDocumentTree
                    documents={documentTree}
                    selectedId={selectedDocument?.id}
                    expandedIds={contentExpandedIds}
                    onToggle={(id) => setContentExpandedIds((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })}
                    onSelect={selectContentDocument}
                    onCreateFolder={(parent) => startNewDocument("folder", parent)}
                    onCreateDocument={(parent) => startNewDocument("document", parent)}
                    showStatus
                    selectFolders
                  />
                )}
              </div>
            </div>
          </Card>
          <div className="grid gap-5">
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-ink">预览</h2>
                  <p className="mt-1 text-sm text-ink/56">{selectedDocument ? `正在编辑已有${contentNodeType(selectedDocument) === "folder" ? "文件夹" : "文档"}` : `正在新建${draft.nodeType === "folder" ? "文件夹" : "文档"}，尚未保存`}</p>
                </div>
                {selectedDocument ? (
                  <button type="button" onClick={() => runAction(`/api/admin/content/${selectedDocument.id}`, "DELETE", {}, { success: (response) => response.message ?? "内容已删除。", after: () => startNewDocument("document") })} className="border border-rust/40 px-3 py-2 text-sm font-semibold text-rust">
                    删除内容
                  </button>
                ) : null}
              </div>
              <ContentDocumentReader document={previewDocument} emptyTitle="选择或新建一篇文档" />
            </Card>
            <Card>
              <h2 className="text-xl font-semibold text-ink">{selectedDocument ? `编辑已有${draft.nodeType === "folder" ? "文件夹" : "文档"}` : `新建${draft.nodeType === "folder" ? "文件夹" : "文档"}`}</h2>
              <p className="mt-1 text-sm leading-6 text-ink/58">{selectedDocument ? "这里修改的是当前已保存内容。" : "这里创建的是全新内容；保存前不会影响已有内容。"}</p>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const body = {
                kind: draft.kind,
                nodeType: draft.nodeType,
                title: draft.title,
                slug: draft.slug || `${draft.kind}-${Date.now()}`,
                parentId: draft.parentId,
                summary: draft.summary,
                bodyMarkdown: draft.nodeType === "folder" ? "" : draft.bodyMarkdown,
                imageUrls: draft.nodeType === "folder" ? [] : draftImageUrls,
                status: draft.status,
                displayOrder: Number(draft.displayOrder) || 0
              };
              runAction(selectedDocument ? `/api/admin/content/${selectedDocument.id}` : "/api/admin/content", selectedDocument ? "PATCH" : "POST", body, {
                success: (response) => response.message ?? "文档已保存。",
                after: (response) => {
                  if (response.document?.id) {
                    setContentCreating(false);
                    setSelectedId(response.document.id);
                  }
                }
              });
            }}
          >
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="类型">
                <select className={inputClass} value={draft.kind} onChange={(event) => setDraft("contentKind", event.target.value)}>
                  <option value={activeDocumentKind}>{contentKindLabels[activeDocumentKind]}</option>
                </select>
              </Field>
              <Field label="节点">
                <select className={inputClass} value={draft.nodeType} onChange={(event) => setDraft("contentNodeType", event.target.value)} disabled={contentTab === "developer_contact"}>
                  <option value="folder">分类文件夹</option>
                  <option value="document">文档</option>
                </select>
              </Field>
              <Field label="状态">
                <select className={inputClass} value={draft.status} onChange={(event) => setDraft("contentStatus", event.target.value)}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="hidden">hidden</option>
                </select>
              </Field>
              <Field label="Slug">
                <input className={inputClass} value={draft.slug} onChange={(event) => setDraft("contentSlug", event.target.value)} />
              </Field>
              <Field label="排序">
                <input className={inputClass} type="number" value={draft.displayOrder} onChange={(event) => setDraft("contentDisplayOrder", event.target.value)} />
              </Field>
            </div>
            <Field label="标题">
              <input className={inputClass} value={draft.title} onChange={(event) => setDraft("contentTitle", event.target.value)} />
            </Field>
            {contentTab !== "developer_contact" ? (
              <Field label="父级文档">
                <select className={inputClass} value={draft.parentId} onChange={(event) => setDraft("contentParentId", event.target.value)}>
                  <option value="">无父级，作为根文档显示</option>
                  {parentOptions.map((document: any) => (
                    <option key={document.id} value={document.id}>{document.title} · /{document.slug}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            {draft.nodeType === "document" ? (
              <>
                <Field label="摘要">
                  <input className={inputClass} value={draft.summary} onChange={(event) => setDraft("contentSummary", event.target.value)} />
                </Field>
                <Field label="图片 URL，逗号分隔，最多 3 张">
                  <input className={inputClass} value={draft.imageUrls} onChange={(event) => setDraft("contentImageUrls", event.target.value)} />
                </Field>
                <Field label="Markdown 正文">
                  <textarea className={inputClass} rows={12} value={draft.bodyMarkdown} onChange={(event) => setDraft("contentBodyMarkdown", event.target.value)} />
                </Field>
                <div className="grid gap-3 border border-ink/15 bg-chalk p-3">
                  <p className="text-sm font-semibold text-ink">预览</p>
                  <MarkdownRenderer>{draft.bodyMarkdown}</MarkdownRenderer>
                </div>
              </>
            ) : (
              <p className="border border-ink/15 bg-chalk px-3 py-2 text-sm leading-6 text-ink/62">分类文件夹只负责组织子文档，不编辑正文。请在文件夹上使用“新建文档”添加内容。</p>
            )}
            <button className="w-fit bg-ink px-4 py-2 text-sm font-semibold text-paper">{selectedDocument ? "更新内容" : "创建内容"}</button>
          </form>
            </Card>
          </div>
          </div>
        </div>
      );

}

function buildMarkdownImportRows(drafts: ContentMarkdownDraft[], documents: any[]) {
  const existingBySlug = new Map(documents.map((document: any) => [document.slug, document]));
  const importedFolders = new Set(drafts.filter((draft) => draft.nodeType === "folder" && !draft.archived).map((draft) => draft.slug));
  const slugCounts = drafts.reduce((map, draft) => map.set(draft.slug, (map.get(draft.slug) ?? 0) + 1), new Map<string, number>());
  return drafts.map((draft) => {
    const existing = existingBySlug.get(draft.slug);
    const duplicate = (slugCounts.get(draft.slug) ?? 0) > 1;
    const parentKnown = !draft.parentSlug || existingBySlug.has(draft.parentSlug) || importedFolders.has(draft.parentSlug);
    const archived = draft.archived;
    const blocking = !archived && (duplicate || !parentKnown);
    const reason = archived
      ? "归档区默认跳过"
      : duplicate
        ? "本次选择中 slug 重复"
        : !parentKnown
          ? `找不到父级 ${draft.parentSlug}`
          : "";
    return {
      draft,
      existing,
      action: archived ? "skip" : existing ? "update" : "create",
      blocking,
      reason
    };
  });
}
