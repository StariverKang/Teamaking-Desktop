"use client";

import { FormEvent, useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { Card } from "@/components/app-shell";
import { useFeedback } from "@/components/feedback-provider";
import { ErrorBox, InlineFeedback, inputClass } from "@/components/pages/page-primitives";
import { EditableCopy } from "@/components/site-copy-runtime";
import { api, useApi } from "@/lib/client/api";

export function visibleMatchReasonTags(reasons: string[] = []) {
  const tags = new Set<string>();
  for (const value of reasons) {
    const reason = String(value ?? "").trim();
    const normalized = reason.toLowerCase();
    if (!reason) continue;
    if (reason === "同一课程记录" || reason.includes("同一门课程") || normalized.includes("same course")) {
      tags.add("同一课程记录");
    } else if (reason === "二度" || reason.includes("二度") || normalized.includes("second-degree")) {
      tags.add("二度");
    } else if (reason === "三度" || reason.includes("三度") || normalized.includes("third-degree")) {
      tags.add("三度");
    }
  }
  return [...tags];
}

export function majorsForFaculty(majors: any[], facultyId?: string) {
  return majors.filter((major) => !facultyId || major.facultyId === facultyId);
}

export function normalizeAcademicSelection(faculties: any[], majors: any[], preferredFacultyId?: string | null, preferredMajorId?: string | null) {
  const facultyExists = (id?: string | null) => Boolean(id && faculties.some((faculty) => faculty.id === id));
  const preferredMajor = preferredMajorId ? majors.find((major) => major.id === preferredMajorId) : null;
  const facultyId = facultyExists(preferredFacultyId)
    ? String(preferredFacultyId)
    : preferredMajor?.facultyId ?? faculties[0]?.id ?? "";
  const scopedMajors = majorsForFaculty(majors, facultyId);
  const majorId = preferredMajor && (!facultyId || preferredMajor.facultyId === facultyId)
    ? preferredMajor.id
    : scopedMajors[0]?.id ?? "";
  return { facultyId, majorId };
}

export function OfficialAcademicLinks({ links, compact = false }: { links?: any[]; compact?: boolean }) {
  const rows = links ?? [];
  if (!rows.length) return null;
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral"><EditableCopy copyKey="officialLinks.eyebrow" fallback="Official references" /></p>
          <h2 className="mt-1 font-serif text-xl font-semibold text-ink"><EditableCopy copyKey="officialLinks.title" fallback="官方查询入口" /></h2>
        </div>
        <p className="max-w-xl text-xs leading-5 text-ink/58">
          <EditableCopy copyKey="officialLinks.description" fallback="TEAMAKING 的 Course Board 是平台内协作入口；专业介绍、官方四年安排和真实选课请以学校网站与 MIS 为准。" />
        </p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {rows.map((link) => (
          <a
            key={link.key ?? link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="group border border-ink/18 bg-paper/70 p-3 hover:border-ink/42 hover:bg-mist/45"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <EditableCopy copyKey={link.key ? `officialLinks.${link.key}.label` : undefined} fallback={link.label} />
              <LinkIcon size={14} aria-hidden className="text-coral" />
            </span>
            {link.description ? <span className="mt-2 block text-xs leading-5 text-ink/58">{link.description}</span> : null}
          </a>
        ))}
      </div>
    </>
  );
  return compact ? <div className="border border-ink/18 bg-paper/60 p-3">{content}</div> : <Card>{content}</Card>;
}

export function CourseCommentItem({ comment, onReply, onDelete }: { comment: any; onReply: (id: string, body: string) => void; onDelete: (id: string) => void }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [body, setBody] = useState("");
  const [showReplies, setShowReplies] = useState(true);

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    await onReply(comment.id, body);
    setBody("");
    setReplyOpen(false);
    setShowReplies(true);
  }

  return (
    <div className="border border-ink/15 bg-paper p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{comment.user?.profile?.displayName ?? comment.user?.email ?? "用户"}</p>
          <p className="text-xs text-ink/50">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ""}</p>
        </div>
        <button type="button" onClick={() => onDelete(comment.id)} className="border border-ink/30 px-2 py-1 text-xs font-semibold text-rust">
          删除
        </button>
      </div>
      <p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${comment.deleted ? "text-ink/45" : "text-ink/72"}`}>{comment.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setReplyOpen((value) => !value)} className="border border-ink/30 px-2 py-1 text-xs font-semibold">回复</button>
        {(comment.replies ?? []).length ? (
          <button type="button" onClick={() => setShowReplies((value) => !value)} className="border border-ink/30 px-2 py-1 text-xs font-semibold">
            {showReplies ? "收起回复" : `展开 ${comment.replies.length} 条回复`}
          </button>
        ) : null}
      </div>
      {replyOpen ? (
        <form onSubmit={submitReply} className="mt-3 grid gap-2">
          <textarea className={inputClass} rows={2} value={body} onChange={(event) => setBody(event.target.value)} placeholder="写一条回复" />
          <button className="w-fit border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-paper">发布回复</button>
        </form>
      ) : null}
      {showReplies && (comment.replies ?? []).length ? (
        <div className="mt-3 grid gap-3 border-l-2 border-ink/15 pl-3">
          {comment.replies.map((reply: any) => (
            <CourseCommentItem key={reply.id} comment={reply} onReply={onReply} onDelete={onDelete} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CourseCommentsSection({ courseId }: { courseId: string }) {
  const { runWithFeedback } = useFeedback();
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);
  const { data, error, loading } = useApi(`/api/courses/${courseId}/comments?page=${page}&pageSize=8`, [page, refresh, courseId]);
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    try {
      await runWithFeedback(
        () => api(`/api/courses/${courseId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
        { success: "课程评价已发布。" }
      );
      setBody("");
      setRefresh((value) => value + 1);
      setFeedback({ message: "课程评价已发布。", tone: "success" });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "课程评价发布失败，请稍后再试。", tone: "error" });
    }
  }

  async function reply(parentId: string, replyBody: string) {
    setFeedback(null);
    try {
      await runWithFeedback(
        () => api(`/api/course-comments/${parentId}/replies`, { method: "POST", body: JSON.stringify({ body: replyBody }) }),
        { success: "回复已发布。" }
      );
      setRefresh((value) => value + 1);
      setFeedback({ message: "回复已发布。", tone: "success" });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "回复发布失败，请稍后再试。", tone: "error" });
      throw error;
    }
  }

  async function remove(commentId: string) {
    setFeedback(null);
    try {
      await runWithFeedback(
        () => api(`/api/course-comments/${commentId}`, { method: "DELETE" }),
        { success: "评论已删除。" }
      );
      setRefresh((value) => value + 1);
      setFeedback({ message: "评论已删除。", tone: "success" });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "评论删除失败，请稍后再试。", tone: "error" });
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold text-ink">课程评价</h2>
      <p className="mt-2 text-sm leading-6 text-ink/62">绑定真实课程目录，不绑定某个具体 Course Board；评论记录真实时间，不支持点赞。</p>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <textarea className={inputClass} rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="写下课程体验、任务类型、组队建议或注意事项。" />
        <button className="focus-ring w-fit bg-coral px-4 py-2 text-sm font-semibold text-paper">发布评价</button>
      </form>
      <div className="mt-3">
        <InlineFeedback message={feedback?.message} tone={feedback?.tone} />
      </div>
      {loading ? <p className="mt-4 text-sm text-ink/56">正在读取评论...</p> : <ErrorBox message={error} />}
      <div className="mt-4 grid gap-3">
        {(data?.comments ?? []).map((comment: any) => (
          <CourseCommentItem key={comment.id} comment={comment} onReply={reply} onDelete={remove} />
        ))}
        {(data?.comments ?? []).length === 0 ? <p className="text-sm text-ink/56">还没有课程评价。</p> : null}
      </div>
      <div className="pagination-safe-zone mt-4 flex items-center justify-between border border-ink/15 bg-chalk px-3 py-2 text-sm">
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="border border-ink/30 px-3 py-1 font-semibold disabled:opacity-40">上一页</button>
        <span>{pagination.page} / {pagination.totalPages} · {pagination.total} 条</span>
        <button type="button" onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={page >= pagination.totalPages} className="border border-ink/30 px-3 py-1 font-semibold disabled:opacity-40">下一页</button>
      </div>
    </Card>
  );
}
