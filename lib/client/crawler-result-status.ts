export type CrawlerResultTone = "active" | "success" | "warning" | "error" | "neutral";

export type CrawlerResultStatus = {
  label: string;
  detail?: string;
  tone: CrawlerResultTone;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function importFailed(job: any) {
  return Array.isArray(job?.imports) && job.imports.some((item: any) => item?.status === "failed");
}

function timeoutLike(error: string) {
  return /任务长时间没有更新|time[\s_-]*out|timed out|timeout|超时/i.test(error);
}

function outputCount(job: any) {
  return Array.isArray(job?.outputs) ? job.outputs.length : 0;
}

function logTail(job: any) {
  const logs = Array.isArray(job?.logs) ? job.logs.map(textValue).filter(Boolean) : [];
  const tail = logs.join("\n").split("\n").map((line: string) => line.trim()).filter(Boolean).reverse()
    .find((line: string) => !/^Node\.js v/i.test(line) && !/^Finished with exit code/i.test(line));
  return tail?.slice(0, 360) ?? "";
}

export function crawlerResultStatus(job: any): CrawlerResultStatus {
  const status = textValue(job?.status);
  const error = textValue(job?.errorMessage);
  const databaseAction = textValue(job?.input?.databaseAction);

  if (status === "completed") {
    const count = outputCount(job);
    return {
      label: "完成",
      detail: count ? `${count} 个输出文件已生成` : "任务已完成",
      tone: "success"
    };
  }

  if (status === "running") {
    return { label: "爬取中", detail: "正在抓取网页/PDF 并解析课程行", tone: "active" };
  }

  if (status === "finalizing") {
    return { label: "整理中", detail: "正在收集输出文件并准备后续动作", tone: "active" };
  }

  if (status === "importing") {
    return {
      label: "导入中",
      detail: databaseAction === "approve_import" ? "正在批准并写入数据库" : "正在创建待审批导入批次",
      tone: "active"
    };
  }

  if (status === "timed_out" || timeoutLike(error)) {
    return { label: "Time out", detail: error || "任务长时间没有更新", tone: "warning" };
  }

  if (status === "process_error" || (Number.isFinite(job?.exitCode) && job.exitCode !== 0)) {
    const detail = error || logTail(job) || `Crawler exited with code ${job.exitCode}`;
    return { label: "进程错误", detail, tone: "error" };
  }

  if (status === "finalization_failed") {
    return { label: "整理失败", detail: error || "输出整理阶段失败", tone: "error" };
  }

  if (status === "import_failed" || importFailed(job)) {
    return { label: "导入失败", detail: error || "爬取成功，但后续导入失败", tone: "error" };
  }

  if (status === "failed") {
    return { label: "失败", detail: error || "任务失败", tone: "error" };
  }

  if (status) {
    return { label: status, detail: error || undefined, tone: error ? "error" : "neutral" };
  }

  return { label: "等待输出", detail: "等待 crawler 输出第一批日志", tone: "neutral" };
}
