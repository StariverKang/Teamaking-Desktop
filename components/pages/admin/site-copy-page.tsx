"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Save, Send } from "lucide-react";

import { Card, LoadingState, PageShell, StatusPill } from "@/components/app-shell";
import { useFeedback } from "@/components/feedback-provider";
import { ErrorBox, InlineFeedback, inputClass } from "@/components/pages/page-primitives";
import { api, useApi } from "@/lib/client/api";
import { type SiteCopyEntry, type SiteCopyValue } from "@/lib/site-copy";

function valueForEntry(data: any, entry: SiteCopyEntry) {
  return {
    ...entry.defaultValue,
    ...(data?.values?.[entry.key] ?? data?.draft?.[entry.key] ?? data?.published?.[entry.key])
  };
}

function valueChanged(data: any, entry: SiteCopyEntry, value: SiteCopyValue) {
  const published = data?.publishedValues?.[entry.key] ?? entry.defaultValue;
  return (published.zh ?? "") !== (value.zh ?? "") || (published.en ?? "") !== (value.en ?? "");
}

export function SiteCopyAdminPage() {
  const { runWithFeedback } = useFeedback();
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const [edits, setEdits] = useState<Record<string, SiteCopyValue>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" | "info" } | null>(null);
  const { data, error, loading } = useApi("/api/admin/site-copy", [refresh]);
  const entries: SiteCopyEntry[] = useMemo(() => data?.entries ?? [], [data?.entries]);
  const changedKeys = useMemo(() => new Set<string>(data?.changedKeys ?? []), [data?.changedKeys]);

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (changedOnly && !changedKeys.has(entry.key)) return false;
      if (!needle) return true;
      return [entry.key, entry.route, entry.group, entry.label, entry.kind, entry.defaultValue.zh, entry.defaultValue.en]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [changedKeys, changedOnly, entries, query]);

  async function saveEntry(entry: SiteCopyEntry) {
    const value = edits[entry.key] ?? valueForEntry(data, entry);
    setBusy(entry.key);
    setMessage(null);
    try {
      const response = await runWithFeedback(
        () => api("/api/admin/site-copy/draft", {
          method: "PATCH",
          body: JSON.stringify({ changes: { [entry.key]: value } })
        }),
        { success: (response: any) => response.message ?? "草稿已保存。" }
      );
      setEdits((current) => {
        const next = { ...current };
        delete next[entry.key];
        return next;
      });
      setMessage({ text: response.message ?? "草稿已保存。", tone: "success" });
      setRefresh((value) => value + 1);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "草稿保存失败。", tone: "error" });
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    setBusy("publish");
    setMessage(null);
    try {
      const response = await runWithFeedback(
        () => api("/api/admin/site-copy/publish", { method: "POST", body: JSON.stringify({}) }),
        { success: (response: any) => response.message ?? "界面文案已发布。" }
      );
      setEdits({});
      setMessage({ text: response.message ?? "界面文案已发布。", tone: "success" });
      setRefresh((value) => value + 1);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "界面文案发布失败。", tone: "error" });
    } finally {
      setBusy("");
    }
  }

  async function discard() {
    setBusy("discard");
    setMessage(null);
    try {
      const response = await runWithFeedback(
        () => api("/api/admin/site-copy/discard", { method: "POST", body: JSON.stringify({}) }),
        { success: (response: any) => response.message ?? "界面文案草稿已丢弃。" }
      );
      setEdits({});
      setMessage({ text: response.message ?? "界面文案草稿已丢弃。", tone: "success" });
      setRefresh((value) => value + 1);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "界面文案草稿丢弃失败。", tone: "error" });
    } finally {
      setBusy("");
    }
  }

  return (
    <PageShell
      title="Interface Copy"
      eyebrow="Admin"
      description="编辑用户端短界面文案：页面标题、字段 label、placeholder、功能说明、按钮和引导文案。草稿发布后才对普通用户可见。"
      aside="admin"
      workspace
    >
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-5">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">文案草稿</h2>
              <p className="mt-1 text-sm leading-6 text-ink/58">当前有 {changedKeys.size} 个字段与已发布版本不同。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setChangedOnly((value) => !value)} className={`border px-3 py-2 text-sm font-semibold ${changedOnly ? "border-ink bg-ink text-paper" : "border-ink/30"}`}>
                {changedOnly ? "显示全部" : "只看改动"}
              </button>
              <button type="button" onClick={publish} disabled={busy === "publish" || changedKeys.size === 0} className="inline-flex items-center gap-2 border border-forest/35 bg-forest/10 px-3 py-2 text-sm font-semibold text-forest disabled:opacity-50">
                <Send size={15} aria-hidden />
                发布草稿
              </button>
              <button type="button" onClick={discard} disabled={busy === "discard" || !data?.hasDraft} className="inline-flex items-center gap-2 border border-rust/35 px-3 py-2 text-sm font-semibold text-rust disabled:opacity-50">
                <RotateCcw size={15} aria-hidden />
                丢弃草稿
              </button>
            </div>
          </div>
          <input className={`${inputClass} mt-4`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 key、页面、分组、默认文案" />
          <div className="mt-3">
            <InlineFeedback message={message?.text} tone={message?.tone} />
          </div>
        </Card>

        <div className="grid gap-4">
          {visibleEntries.map((entry) => {
            const value = edits[entry.key] ?? valueForEntry(data, entry);
            const changed = valueChanged(data, entry, value);
            const dirty = Boolean(edits[entry.key]);
            return (
              <Card key={entry.key}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-coral">{entry.group} · {entry.route}</p>
                        <h3 className="mt-1 text-lg font-semibold text-ink">{entry.label}</h3>
                        <p className="mt-1 break-all text-xs text-ink/50">{entry.key}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={entry.kind} />
                        {changed ? <StatusPill status="draft changed" /> : <StatusPill status="published" />}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 border border-ink/12 bg-paper px-3 py-2 text-sm leading-6 text-ink/68">
                      <p><span className="font-semibold text-ink">默认中文：</span>{entry.defaultValue.zh}</p>
                      <p><span className="font-semibold text-ink">Default EN：</span>{entry.defaultValue.en}</p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <label className="grid gap-1 text-sm font-semibold text-ink">
                      中文草稿
                      <textarea
                        className={inputClass}
                        rows={3}
                        maxLength={entry.maxLength}
                        value={value.zh ?? ""}
                        onChange={(event) => setEdits((current) => ({ ...current, [entry.key]: { ...value, zh: event.target.value } }))}
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-ink">
                      English draft
                      <textarea
                        className={inputClass}
                        rows={3}
                        maxLength={entry.maxLength}
                        value={value.en ?? ""}
                        onChange={(event) => setEdits((current) => ({ ...current, [entry.key]: { ...value, en: event.target.value } }))}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => saveEntry(entry)} disabled={busy === entry.key || (!dirty && !changed)} className="inline-flex w-fit items-center gap-2 bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-50">
                        {dirty ? <Save size={15} aria-hidden /> : <Check size={15} aria-hidden />}
                        {busy === entry.key ? "保存中..." : "保存草稿"}
                      </button>
                      <span className="text-xs text-ink/50">最多 {entry.maxLength} 个字符</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {!loading && visibleEntries.length === 0 ? <Card><p className="text-sm text-ink/58">没有匹配的界面文案字段。</p></Card> : null}
        </div>
      </div>
    </PageShell>
  );
}
