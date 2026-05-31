"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Card, LoadingState, PageShell, StatusPill } from "@/components/app-shell";
import { useFeedback } from "@/components/feedback-provider";
import { ErrorBox, Field, formatFileSize, InlineFeedback, inputClass } from "@/components/pages/page-primitives";
import { crawlerResultStatus, CrawlerResultTone } from "@/lib/client/crawler-result-status";
import { api, useApi } from "@/lib/client/api";

const activeCrawlerStatuses = new Set(["running", "finalizing", "importing"]);
const resultToneClass: Record<CrawlerResultTone, string> = {
  active: "text-ink",
  success: "text-forest",
  warning: "text-coral",
  error: "text-rust",
  neutral: "text-ink/64"
};

export function CrawlerPortalPage() {
  const { runWithFeedback } = useFeedback();
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi("/api/crawler/options", [refresh]);
  const { data: jobsData } = useApi("/api/crawler/jobs", [refresh]);
  const [form, setForm] = useState<Record<string, string>>({
    name: "",
    target: "programme_handbook",
    handbookUrl: "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm",
    courseDescriptionsUrl: "https://ar.bnbu.edu.cn/info/1021/1430.htm",
    cohorts: "",
    catalogEffectiveYear: "2026",
    limit: "all",
    outputMode: "download",
    databaseAction: "download_only",
    aiMode: "off",
    aiMaxTokens: "2000",
    instruction: "填写某一个 admission year 的 programme handbook 页面，输出该届学生的 programme plan 配置 JSON。"
  });
  const [result, setResult] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const jobs = jobsData?.jobs ?? [];
    if (!jobs.some((job: any) => activeCrawlerStatuses.has(job.status))) return;
    const timer = window.setTimeout(() => setRefresh((value) => value + 1), 2000);
    return () => window.clearTimeout(timer);
  }, [jobsData, refresh]);

  async function startJob(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await runWithFeedback(
        () => api("/api/crawler/jobs", { method: "POST", body: JSON.stringify(form) }),
        { success: (response: any) => response.message ?? `已启动任务：${response.job?.id}` }
      );
      setResult({ type: "success", message: response.message ?? `已启动任务：${response.job?.id}` });
      setRefresh((value) => value + 1);
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "启动爬虫失败。" });
    } finally {
      setBusy(false);
    }
  }

  const jobs = jobsData?.jobs ?? [];
  const outputs = jobsData?.outputs ?? data?.outputs ?? [];
  const targets = data?.targets ?? [];
  const currentTarget = form.target ?? "programme_handbook";
  const isCourseCatalog = currentTarget === "course_catalog";
  const crawlerAi = data?.crawlerAi ?? {};

  return (
    <PageShell
      title="BNBU Crawler Portal"
      eyebrow="Crawler"
      aside="none"
      workspace
      description="独立爬虫入口：programme handbook 生成 admission-year 培养方案规则；Course Descriptions 生成学校级课程总表。"
    >
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {error && /请先完成|unauthorized|API_UNAUTHORIZED/i.test(error) ? (
        <Card>
          <h2 className="text-xl font-semibold text-ink">需要管理员登录</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">爬虫入口使用同一套管理员账号密码。请先登录，再回到本页面启动任务。</p>
          <Link href="/admin-login" className="mt-4 inline-flex rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">进入管理员登录</Link>
        </Card>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <Card className="xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
          <h2 className="text-xl font-semibold text-ink">Crawl request</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">推荐直接填写某一年的 admission handbook 页面并一次爬一年。Programme handbook 只生成该届学生的培养方案推荐；Course Descriptions 是学校级课程库，所有 active 课程都可搜索并手动打开课程板；BNBU class schedule 只是时间表，不作为课程存在依据。</p>
          <form className="mt-4 grid gap-4" onSubmit={startJob}>
            <Field label="Job name" help="给本次任务起一个可读名称；不填时系统会用 admission years 自动生成。">
              <input className={inputClass} placeholder="例如 2025+2024 admission handbook full crawl" value={form.name ?? ""} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="自然语言说明">
              <textarea className={inputClass} rows={4} value={form.instruction ?? ""} onChange={(event) => setForm({ ...form, instruction: event.target.value })} />
            </Field>
            <div className="grid gap-3 md:grid-cols-3">
              {targets.map((target: any) => (
                <label key={target.value} className={`border border-ink/15 p-3 text-sm ${target.supported ? "bg-paper" : "bg-chalk opacity-60"}`}>
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <input type="radio" name="target" value={target.value} checked={currentTarget === target.value} disabled={!target.supported} onChange={(event) => setForm({ ...form, target: event.target.value })} />
                    {target.label}
                  </span>
                  <span className="mt-2 block leading-5 text-ink/60">{target.description}</span>
                </label>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {isCourseCatalog ? (
                <Field label="Course catalog URL" help="填写 AR Course Descriptions 页面或 PDF；University Core 和 General Education 会自动从官方入口补入总表，不生成 admission-year 培养方案规则。">
                  <input className={inputClass} value={form.courseDescriptionsUrl ?? ""} onChange={(event) => setForm({ ...form, courseDescriptionsUrl: event.target.value })} />
                </Field>
              ) : (
                <>
                  <Field label="Handbook URL" help="推荐填某一年的 handbook 页面，例如 /info/1020/...；总入口也仍可用。">
                    <input
                      className={inputClass}
                      value={form.handbookUrl ?? ""}
                      onChange={(event) => {
                        const handbookUrl = event.target.value;
                        const shouldClearCohorts = /\/info\/1020\//.test(handbookUrl) && ((form.cohorts ?? "").includes(",") || form.cohorts === "2025,2024");
                        setForm({ ...form, handbookUrl, cohorts: shouldClearCohorts ? "" : form.cohorts ?? "" });
                      }}
                    />
                  </Field>
                  <Field label="Admission year" help="填写年份页面时可留空让系统从页面标题识别；总入口可填 2025 或 2025,2024。"><input className={inputClass} value={form.cohorts ?? ""} onChange={(event) => setForm({ ...form, cohorts: event.target.value })} /></Field>
                  <Field label="Programme codes"><input className={inputClass} placeholder="ACCT,MCOM 可留空" value={form.programmes ?? ""} onChange={(event) => setForm({ ...form, programmes: event.target.value })} /></Field>
                  <Field label="Faculty codes"><input className={inputClass} placeholder="FBM,FHSS 可留空" value={form.facultyCodes ?? ""} onChange={(event) => setForm({ ...form, facultyCodes: event.target.value })} /></Field>
                </>
              )}
              {isCourseCatalog ? (
                <Field label="Catalog effective year" help="用于课程目录版本和生命周期对比；不会创建 semester，也不会限制学生年级、专业或学期。"><input className={inputClass} value={form.catalogEffectiveYear ?? ""} onChange={(event) => setForm({ ...form, catalogEffectiveYear: event.target.value })} /></Field>
              ) : null}
              <Field label="Limit"><input className={inputClass} value={form.limit ?? "all"} onChange={(event) => setForm({ ...form, limit: event.target.value })} /></Field>
              <Field label="Output mode">
                <select className={inputClass} value={form.outputMode ?? "download"} onChange={(event) => setForm({ ...form, outputMode: event.target.value })}>
                  <option value="download">download-only storage</option>
                  <option value="git_import_json">course_imports/bnbu</option>
                </select>
              </Field>
              <Field label="After crawl" help={isCourseCatalog ? "默认只生成下载文件；如直接批准，会合并课程描述，不会创建 admission-year rules。" : "默认只生成下载文件；如选择直接批准，会写入线上课程目录和 admission-year programme plan rules，不在爬取时按 Spring/Fall 激活 Course Board。"}>
                <select className={inputClass} value={form.databaseAction ?? "download_only"} onChange={(event) => setForm({ ...form, databaseAction: event.target.value })}>
                  <option value="download_only">只生成并下载 JSON</option>
                  <option value="create_pending">创建待审批导入批次</option>
                  <option value="approve_import">直接批准并更新线上数据库</option>
                </select>
              </Field>
              <Field label="AI assist" help={crawlerAi.enabled ? `使用 ${crawlerAi.model ?? "OpenAI"} 补齐/检验缺失课程字段；API key: ${crawlerAi.apiKeySet ? crawlerAi.apiKeySource : "missing"}` : "后台 AI 爬虫配置未启用；选择后会记录 disabled，不会调用模型。"}>
                <select className={inputClass} value={form.aiMode ?? "off"} onChange={(event) => setForm({ ...form, aiMode: event.target.value })}>
                  <option value="off">关闭 AI</option>
                  <option value="validate">只检验缺失/异常字段</option>
                  <option value="enrich">补齐缺失字段</option>
                  <option value="strict">严格补齐并阻断失败结果</option>
                </select>
              </Field>
              <Field label="AI max tokens" help="控制单次 AI 输出上限；只在 AI assist 开启时生效。">
                <input className={inputClass} type="number" min={200} max={8000} value={form.aiMaxTokens ?? "2000"} onChange={(event) => setForm({ ...form, aiMaxTokens: event.target.value })} />
              </Field>
            </div>
            {form.databaseAction === "approve_import" ? (
              <div className="border border-rust/30 bg-rust/5 px-3 py-2 text-sm leading-6 text-rust">
                这个选项会在爬虫成功后自动创建导入批次并批准写入数据库；已有课程和用户数据不会被清空。
              </div>
            ) : null}
            {form.aiMode && form.aiMode !== "off" ? (
              <div className="border border-coral/30 bg-coral/5 px-3 py-2 text-sm leading-6 text-coral">
                AI assist 只会补齐缺失字段或记录校验结果，不会覆盖 crawler 已经解析出的非空字段；strict 模式发现仍有关键缺失时会让任务失败。
              </div>
            ) : null}
            <button disabled={busy} className="w-fit rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
              {busy ? "启动中..." : "启动爬虫"}
            </button>
            <InlineFeedback message={result?.message} tone={result?.type} />
          </form>
        </Card>

        <div className="grid min-w-0 gap-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-ink">Jobs</h2>
              <button type="button" onClick={() => setRefresh((value) => value + 1)} className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold">刷新</button>
            </div>
            <div className="mt-4 max-h-80 overflow-auto border border-ink/15">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper"><tr>{["Job", "Status", "Scope", "Catalog / plan", "Started", "Result", "Actions", "Log"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                <tbody>
                  {jobs.length ? jobs.map((job: any) => {
                    const result = crawlerResultStatus(job);
                    return (
                    <tr key={job.id} className="border-b border-ink/10">
                      <td className="px-3 py-2">
                        <p className="font-semibold">{job.name ?? job.id}</p>
                        <p className="mt-1 text-xs text-ink/48">{job.id}</p>
                      </td>
                      <td className="px-3 py-2"><StatusPill status={job.status} /></td>
                      <td className="px-3 py-2">{job.target === "course_catalog" ? "Course catalog" : job.input?.cohorts?.length ? job.input.cohorts.join(", ") : "inferred from page"}</td>
                      <td className="px-3 py-2">{job.target === "course_catalog" ? `effective ${job.input?.catalogEffectiveYear ?? "not set"}` : "admission-year plan"}</td>
                      <td className="px-3 py-2">{job.startedAt ? new Date(job.startedAt).toLocaleString() : ""}</td>
                      <td className="max-w-[300px] px-3 py-2 text-xs text-ink/64">
                        <div className="grid gap-1">
                          <span className={`font-semibold ${resultToneClass[result.tone]}`}>{result.label}</span>
                          {result.detail ? <span className="leading-5 text-ink/48">{result.detail}</span> : null}
                        </div>
                        {job.imports?.length ? (
                          <div className="mt-2 grid gap-1">
                            {job.imports.map((item: any) => (
                              <p key={`${item.outputName}-${item.batchId ?? item.error}`} className={item.status === "failed" ? "text-rust" : "text-forest"}>
                                {item.outputName}: {item.status}{item.batchId ? ` · batch ${item.batchId}` : ""}{item.error ? ` · ${item.error}` : ""}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        {job.outputs?.some((output: any) => output.aiAssist) ? (
                          <div className="mt-2 grid gap-1 border-t border-ink/10 pt-2">
                            {job.outputs.filter((output: any) => output.aiAssist).map((output: any) => (
                              <p key={`${output.storageKey}-ai`} className={output.aiAssist.status === "failed" ? "text-rust" : output.aiAssist.status === "disabled" ? "text-coral" : "text-forest"}>
                                AI {output.aiAssist.mode}: {output.aiAssist.status} · fixed {output.aiAssist.fieldsFixed ?? 0} · invalid {output.aiAssist.invalidCount ?? 0}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {job.outputs?.length ? (
                            <a className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" href={`/api/crawler/jobs/${job.id}/download`}>下载整包备份</a>
                          ) : null}
                          {job.outputs?.map((output: any) => (
                            <a key={output.storageKey} className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold text-ink/70" href={output.downloadUrl}>可导入 JSON：{output.name}</a>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-[360px] px-3 py-2"><pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">{(job.logs ?? []).join("").slice(-4000)}</pre></td>
                    </tr>
                    );
                  }) : (
                    <tr><td colSpan={8} className="px-3 py-4 text-ink/50">No crawler jobs yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-ink">Download outputs</h2>
            <div className="mt-4 max-h-80 overflow-auto border border-ink/15">
              <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper"><tr>{["File", "Size", "Modified", "Action"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                <tbody>
                  {outputs.length ? outputs.map((file: any) => (
                    <tr key={file.storageKey} className="border-b border-ink/10">
                      <td className="px-3 py-2 font-semibold">{file.name}</td>
                      <td className="px-3 py-2">{formatFileSize(file.size)}</td>
                      <td className="px-3 py-2">{file.modifiedAt ? new Date(file.modifiedAt).toLocaleString() : ""}</td>
                      <td className="px-3 py-2"><a className="rounded-sm border border-ink/30 px-3 py-1.5 text-xs font-semibold" href={file.downloadUrl}>下载 JSON</a></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="px-3 py-4 text-ink/50">No outputs yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
