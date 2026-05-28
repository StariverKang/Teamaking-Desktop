"use client";

import { KeyRound, Save } from "lucide-react";
import { StatusPill } from "@/components/app-shell";
import { inputClass } from "@/components/pages/page-primitives";
import { previewValue } from "@/components/pages/shared/data-preview";
import type { AdminResourceContext } from "./resource-types";

function actorLabel(log: any) {
  return log.actor?.profile?.displayName ?? log.actor?.email ?? log.actorUserId ?? log.actorRole ?? "system";
}

function resultPreview(result: any) {
  if (!result || typeof result !== "object") return "";
  const highlights = Array.isArray(result.highlights) ? result.highlights : [];
  return `${result.summaryTitle ?? ""}${highlights.length ? ` · ${highlights.length} highlights` : ""}`;
}

export function AiResumeAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { busyAction, data, runAction, setTextFields, textFields } = ctx;
  const config = data?.config ?? {};
  const logs = data?.logs ?? [];
  const enabledValue = textFields.aiResumeEnabled ?? (config.enabled === false ? "false" : "true");
  const modelValue = textFields.aiResumeModel ?? config.model ?? "gpt-4.1-mini";
  const inputLimitValue = textFields.aiResumeInputLimit ?? String(config.inputLimit ?? 14000);
  const apiKeyValue = textFields.aiResumeApiKey ?? "";
  const clearApiKey = textFields.aiResumeClearApiKey === "true";

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="border border-ink/15 bg-chalk p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">Status</p>
          <div className="mt-2"><StatusPill status={config.enabled === false ? "paused" : "active"} /></div>
        </div>
        <div className="border border-ink/15 bg-chalk p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">Provider</p>
          <p className="mt-2 font-semibold text-ink">{config.provider ?? "openai"}</p>
        </div>
        <div className="border border-ink/15 bg-chalk p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">Model</p>
          <p className="mt-2 font-semibold text-ink">{config.model ?? "gpt-4.1-mini"}</p>
        </div>
        <div className="border border-ink/15 bg-chalk p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">API Key</p>
          <p className="mt-2 font-semibold text-ink">{config.apiKeySet ? `${config.apiKeySource}: ${config.apiKeyPreview}` : "missing"}</p>
        </div>
      </div>

      <form
        className="grid gap-3 border-2 border-coral/40 bg-coral/5 p-4 md:grid-cols-[140px_1fr_160px_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          runAction("/api/admin/ai-resume/config", "PATCH", {
            enabled: enabledValue === "true",
            model: modelValue,
            inputLimit: Number(inputLimitValue),
            apiKey: apiKeyValue,
            clearApiKey
          }, {
            busy: "ai-resume-config",
            success: (response) => response.message ?? "AI 简历整理配置已保存。",
            after: () => setTextFields((current) => ({ ...current, aiResumeApiKey: "", aiResumeClearApiKey: "false" }))
          });
        }}
      >
        <select className={inputClass} value={enabledValue} onChange={(event) => setTextFields({ ...textFields, aiResumeEnabled: event.target.value })}>
          <option value="true">启用</option>
          <option value="false">暂停</option>
        </select>
        <input className={inputClass} value={modelValue} onChange={(event) => setTextFields({ ...textFields, aiResumeModel: event.target.value })} placeholder="gpt-4.1-mini" />
        <input className={inputClass} type="number" min={2000} max={24000} value={inputLimitValue} onChange={(event) => setTextFields({ ...textFields, aiResumeInputLimit: event.target.value })} />
        <div className="grid gap-2">
          <div className="relative">
            <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" aria-hidden />
            <input className={`${inputClass} pl-9`} type="password" value={apiKeyValue} onChange={(event) => setTextFields({ ...textFields, aiResumeApiKey: event.target.value })} placeholder={config.apiKeySet ? "留空则保留当前 key" : "OpenAI API key"} />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink/62">
            <input type="checkbox" checked={clearApiKey} onChange={(event) => setTextFields({ ...textFields, aiResumeClearApiKey: event.target.checked ? "true" : "false" })} />
            清除已保存 key，改用环境变量
          </label>
        </div>
        <button disabled={busyAction === "ai-resume-config"} className="inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
          <Save size={16} aria-hidden />
          {busyAction === "ai-resume-config" ? "保存中" : "保存"}
        </button>
      </form>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">Resume AI 调用日志</h3>
            <p className="text-sm leading-6 text-ink/62">这里展示最近 100 次整理的模型、状态和结构化结果；不会展示原始简历文本或 API key。</p>
          </div>
        </div>
        <div className="max-h-[560px] overflow-auto border border-ink/15">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-ink text-paper">
              <tr>{["Time", "User", "Trigger", "Model", "Status", "Summary", "Result"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
            </thead>
            <tbody>
              {logs.length ? logs.map((log: any) => (
                <tr key={log.id} className="border-b border-ink/10 align-top">
                  <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</td>
                  <td className="max-w-[180px] truncate px-3 py-2">{actorLabel(log)}</td>
                  <td className="px-3 py-2">{log.trigger ?? ""}</td>
                  <td className="px-3 py-2">{log.provider ?? ""} / {log.model ?? ""}</td>
                  <td className="px-3 py-2"><StatusPill status={log.analysisStatus ?? log.status} /></td>
                  <td className="max-w-[280px] px-3 py-2">
                    <p className="font-semibold text-ink">{log.summaryTitle ?? ""}</p>
                    <p className="text-xs text-ink/50">{log.highlightCount ?? 0} highlights · {log.inputChars ?? 0} chars · {log.durationMs ?? 0} ms</p>
                  </td>
                  <td className="max-w-[360px] px-3 py-2 text-xs">
                    <details>
                      <summary className="cursor-pointer font-semibold text-coral">{resultPreview(log.analysisResult) || "查看结果"}</summary>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap border border-ink/10 bg-chalk p-2">{previewValue(log.analysisResult)}</pre>
                    </details>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-3 py-4 text-ink/48">还没有简历 AI 整理调用记录。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
