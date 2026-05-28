"use client";

import { KeyRound, Save } from "lucide-react";
import { StatusPill } from "@/components/app-shell";
import { inputClass } from "@/components/pages/page-primitives";
import { previewValue } from "@/components/pages/shared/data-preview";
import type { AdminResourceContext } from "./resource-types";

function actorLabel(log: any) {
  return log.actor?.profile?.displayName ?? log.actor?.email ?? log.actorUserId ?? log.actorRole ?? "system";
}

function aiSummary(log: any) {
  return log.summary?.aiAssist ?? log.metadata?.aiAssist ?? {};
}

export function AiCrawlerAdminPanel({ ctx }: { ctx: AdminResourceContext }) {
  const { busyAction, data, runAction, setTextFields, textFields } = ctx;
  const config = data?.config ?? {};
  const logs = data?.logs ?? [];
  const enabledValue = textFields.aiCrawlerEnabled ?? (config.enabled ? "true" : "false");
  const modelValue = textFields.aiCrawlerModel ?? config.model ?? "gpt-4.1-mini";
  const timeoutValue = textFields.aiCrawlerTimeoutMs ?? String(config.timeoutMs ?? 25000);
  const strictMode = textFields.aiCrawlerStrictMode ?? (config.strictMode ? "true" : "false");
  const apiKeyValue = textFields.aiCrawlerApiKey ?? "";
  const clearApiKey = textFields.aiCrawlerClearApiKey === "true";

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="border border-ink/15 bg-chalk p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">Status</p>
          <div className="mt-2"><StatusPill status={config.enabled ? "active" : "paused"} /></div>
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
        className="grid gap-3 border-2 border-coral/40 bg-coral/5 p-4 md:grid-cols-[120px_1fr_140px_120px_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          runAction("/api/admin/ai-crawler/config", "PATCH", {
            enabled: enabledValue === "true",
            model: modelValue,
            timeoutMs: Number(timeoutValue),
            strictMode: strictMode === "true",
            apiKey: apiKeyValue,
            clearApiKey
          }, {
            busy: "ai-crawler-config",
            success: (response) => response.message ?? "AI 爬虫配置已保存。",
            after: () => setTextFields((current) => ({ ...current, aiCrawlerApiKey: "", aiCrawlerClearApiKey: "false" }))
          });
        }}
      >
        <select className={inputClass} value={enabledValue} onChange={(event) => setTextFields({ ...textFields, aiCrawlerEnabled: event.target.value })}>
          <option value="true">启用</option>
          <option value="false">暂停</option>
        </select>
        <input className={inputClass} value={modelValue} onChange={(event) => setTextFields({ ...textFields, aiCrawlerModel: event.target.value })} placeholder="gpt-4.1-mini" />
        <input className={inputClass} type="number" min={3000} max={120000} value={timeoutValue} onChange={(event) => setTextFields({ ...textFields, aiCrawlerTimeoutMs: event.target.value })} />
        <select className={inputClass} value={strictMode} onChange={(event) => setTextFields({ ...textFields, aiCrawlerStrictMode: event.target.value })}>
          <option value="false">宽松</option>
          <option value="true">严格</option>
        </select>
        <div className="grid gap-2">
          <div className="relative">
            <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" aria-hidden />
            <input className={`${inputClass} pl-9`} type="password" value={apiKeyValue} onChange={(event) => setTextFields({ ...textFields, aiCrawlerApiKey: event.target.value })} placeholder={config.apiKeySet ? "留空则保留当前 key" : "OpenAI API key"} />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink/62">
            <input type="checkbox" checked={clearApiKey} onChange={(event) => setTextFields({ ...textFields, aiCrawlerClearApiKey: event.target.checked ? "true" : "false" })} />
            清除已保存 key，改用环境变量
          </label>
        </div>
        <button disabled={busyAction === "ai-crawler-config"} className="inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
          <Save size={16} aria-hidden />
          {busyAction === "ai-crawler-config" ? "保存中" : "保存"}
        </button>
      </form>

      <div className="grid gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">Crawler AI 调用日志</h3>
          <p className="text-sm leading-6 text-ink/62">这里展示最近 100 次 crawler 输出的 AI 补齐/检验摘要；不会展示原始 API key。</p>
        </div>
        <div className="max-h-[560px] overflow-auto border border-ink/15">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-ink text-paper">
              <tr>{["Time", "Admin", "Output", "Mode", "Status", "Fixed / Invalid", "Result"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
            </thead>
            <tbody>
              {logs.length ? logs.map((log: any) => {
                const summary = aiSummary(log);
                return (
                  <tr key={log.id} className="border-b border-ink/10 align-top">
                    <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</td>
                    <td className="max-w-[180px] truncate px-3 py-2">{actorLabel(log)}</td>
                    <td className="max-w-[240px] truncate px-3 py-2">{log.summary?.outputName ?? ""}</td>
                    <td className="px-3 py-2">{summary.mode ?? ""} / {summary.model ?? ""}</td>
                    <td className="px-3 py-2"><StatusPill status={summary.status ?? log.status} /></td>
                    <td className="px-3 py-2">{summary.fieldsFixed ?? 0} fixed · {summary.invalidCount ?? 0} invalid</td>
                    <td className="max-w-[380px] px-3 py-2 text-xs">
                      <details>
                        <summary className="cursor-pointer font-semibold text-coral">{summary.warnings?.length ? `${summary.warnings.length} warning(s)` : "查看结果"}</summary>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap border border-ink/10 bg-chalk p-2">{previewValue(log.metadata?.aiAssist ?? summary)}</pre>
                      </details>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="px-3 py-4 text-ink/48">还没有 crawler AI 调用记录。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
