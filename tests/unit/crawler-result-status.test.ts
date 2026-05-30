import { describe, expect, it } from "vitest";
import { crawlerResultStatus } from "@/lib/client/crawler-result-status";

describe("crawler result status labels", () => {
  it("labels active crawler phases", () => {
    expect(crawlerResultStatus({ status: "running" })).toMatchObject({ label: "爬取中", tone: "active" });
    expect(crawlerResultStatus({ status: "finalizing" })).toMatchObject({ label: "整理中", tone: "active" });
    expect(crawlerResultStatus({ status: "importing", input: { databaseAction: "approve_import" } })).toMatchObject({
      label: "导入中",
      detail: "正在批准并写入数据库",
      tone: "active"
    });
  });

  it("labels timeout, process, finalization, and import failures", () => {
    expect(crawlerResultStatus({ status: "timed_out", errorMessage: "任务长时间没有更新" })).toMatchObject({ label: "Time out", tone: "warning" });
    expect(crawlerResultStatus({ status: "process_error", exitCode: 1, logs: ["Node.js v24.14.1\n", "Error: Could not infer admission year from URL\n"] })).toMatchObject({
      label: "进程错误",
      detail: "Error: Could not infer admission year from URL",
      tone: "error"
    });
    expect(crawlerResultStatus({ status: "finalization_failed" })).toMatchObject({ label: "整理失败", tone: "error" });
    expect(crawlerResultStatus({ status: "failed", imports: [{ status: "failed" }] })).toMatchObject({ label: "导入失败", tone: "error" });
  });

  it("labels completed jobs with output count", () => {
    expect(crawlerResultStatus({ status: "completed", outputs: [{}, {}] })).toMatchObject({
      label: "完成",
      detail: "2 个输出文件已生成",
      tone: "success"
    });
  });
});
