"use client";

import { useState } from "react";
import { Card, LoadingState, PageShell } from "@/components/app-shell";
import { ErrorBox, Field, inputClass } from "@/components/pages/page-primitives";
import { api, useApi } from "@/lib/client/api";

export function AdminMaintenancePage() {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi("/api/admin/maintenance", [refresh]);
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const summary = data?.summary ?? {};
  const canSubmit = confirmation.trim() === "CLEAR_TEAMING_STATE";

  async function clearCourseTeamingState() {
    setBusy(true);
    setResult(null);
    try {
      const response = await api("/api/admin/maintenance/clear-course-teaming-state", {
        method: "POST",
        body: JSON.stringify({ confirmation })
      });
      setResult({ type: "success", message: response.message ?? "课程组队状态已清空。" });
      setConfirmation("");
      setRefresh((value) => value + 1);
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "操作失败。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Maintenance" eyebrow="Admin" description="执行少量高风险维护操作。所有动作都会写入审计日志；默认只做软清空，不删除历史记录。" aside="admin">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-5">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Course teaming state</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">清空目前所有课程组队状态</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/64">
            这个操作用于新一轮测试或运营重置：它会移除当前活跃的课程组队状态，但不会删除好友关系、加入过的课程记录、发送过的组队帖或 TeamUp 请求记录。
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {[
              ["Active course joins", summary.activeMemberships ?? 0],
              ["Historical joins", summary.historicalMemberships ?? 0],
              ["Open posts", summary.openPosts ?? 0],
              ["Active TeamUp", summary.activeTeamUpRequests ?? 0],
              ["Friendships", summary.acceptedFriendships ?? 0]
            ].map(([label, value]) => (
              <div key={String(label)} className="border border-ink/18 bg-paper/70 p-3">
                <p className="text-xs text-ink/52">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{String(value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border border-rust/35 bg-rust/5 p-4">
            <h3 className="text-sm font-semibold text-rust">将发生什么</h3>
            <ul className="mt-2 grid gap-1 text-sm leading-6 text-ink/70">
              <li>活跃课程加入记录会变成 `history`，保留 joinedAt 和 leftAt，继续作为 Matches 推荐依据。</li>
              <li>open/paused 的 Teamaking Post 会变成 `closed`，发帖记录仍可在后台追溯。</li>
              <li>sent/viewed/mutual 的 TeamUp 请求会变成 `closed`，历史请求记录不会删除。</li>
              <li>accepted 好友关系完全不变；二度、三度好友网络仍会用于 Relevant Users 推荐。</li>
            </ul>
          </div>
          {result ? (
            <div className={`mt-4 border px-3 py-2 text-sm font-semibold ${result.type === "error" ? "border-rust/40 bg-rust/5 text-rust" : "border-forest/30 bg-forest/10 text-forest"}`}>
              {result.message}
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="确认文本">
              <input
                className={inputClass}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="输入 CLEAR_TEAMING_STATE 后才能执行"
              />
            </Field>
            <button
              type="button"
              disabled={!canSubmit || busy}
              onClick={clearCourseTeamingState}
              className="mt-auto border border-rust bg-rust px-4 py-3 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "处理中..." : "清空当前组队状态"}
            </button>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
