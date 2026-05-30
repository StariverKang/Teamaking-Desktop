function compact(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 420);
}

function friendlyCrawlerError(line: string) {
  const text = compact(line);
  if (!text) return "";
  if (/^(PDF 解析依赖缺失|PDF\.js 运行时|网络或 PDF 下载中断|未在 handbook 总入口|Admission year 与页面内容不一致|单个 admission handbook 页面|无法从页面识别 admission year|没有匹配到 Programme\/Faculty|导入队列已有 pending 配置|AI strict 校验失败)/.test(text)) {
    return text;
  }
  if (/pdfjs-dist|ERR_MODULE_NOT_FOUND.*pdf/i.test(text)) {
    return `PDF 解析依赖缺失：请确认 pdfjs-dist 已安装并被部署打包。原始错误：${text}`;
  }
  if (/DOMMatrix|@napi-rs\/canvas|canvas/i.test(text)) {
    return `PDF.js 运行时缺少 DOM/canvas 兼容能力。原始错误：${text}`;
  }
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|TLS|certificate|GET .* failed/i.test(text)) {
    return `网络或 PDF 下载中断：可以重试该 admission job。原始错误：${text}`;
  }
  if (/Could not find programme handbook page .* admission/i.test(text)) {
    return `未在 handbook 总入口找到指定 admission year：${text}`;
  }
  if (/Admission year mismatch/i.test(text)) {
    return `Admission year 与页面内容不一致：${text}`;
  }
  if (/Handbook URL looks like a single admission page/i.test(text)) {
    return `单个 admission handbook 页面一次只能跑一个 admission year：${text}`;
  }
  if (/Could not infer admission year/i.test(text)) {
    return `无法从页面识别 admission year：${text}`;
  }
  if (/No programmes matched/i.test(text)) {
    return `没有匹配到 Programme/Faculty 过滤条件：${text}`;
  }
  if (/pending .*配置|pending configuration|已存在 .*pending/i.test(text)) {
    return `导入队列已有 pending 配置阻塞本次自动导入：${text}`;
  }
  if (/AI strict validation failed/i.test(text)) {
    return `AI strict 校验失败：${text}`;
  }
  return text;
}

export function crawlerErrorSummary(text: string, fallback?: string | null) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const candidates = [
    ...lines.filter((line) => /^Error(?:\s+\[[^\]]+\])?:/i.test(line)),
    ...lines.filter((line) => /^(TypeError|FetchError|SyntaxError|ReferenceError):/i.test(line)),
    ...lines.filter((line) => /\bERR_[A-Z0-9_]+\b/.test(line)),
    ...lines.filter((line) => /Could not|Admission year|Handbook URL|No programmes|AI strict|GET .* failed|fetch failed/i.test(line)),
    ...lines.filter((line) => line.startsWith("throw "))
  ];
  const firstUseful = candidates.find(Boolean);
  if (firstUseful) return friendlyCrawlerError(firstUseful);
  const nonVersionTail = [...lines].reverse().find((line) => !/^Node\.js v/i.test(line));
  return friendlyCrawlerError(nonVersionTail || fallback || "");
}
