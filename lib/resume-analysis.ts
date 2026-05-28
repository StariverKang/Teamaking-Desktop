export const resumeAiParserVersion = "resume-ai-v1";
export const resumeAiHighlightLimit = 8;

export type ResumeKeywordGroup = {
  label: string;
  keywords: string[];
};

export type ResumeHighlight = {
  title: string;
  evidence: string;
  category: string;
  keywords: string[];
};

export type ResumeAnalysis = {
  parserVersion: string;
  summaryTitle: string;
  summaryBody: string;
  keywordGroups: ResumeKeywordGroup[];
  highlights: ResumeHighlight[];
  generatedAt: string;
  provider: string;
  model: string;
  status: "generated" | "fallback" | "manual";
  source?: string;
  error?: string;
};

export type ResolvedResumeAnalysis = {
  analysis: ResumeAnalysis;
  source: "manual" | "ai" | "fallback";
};

type ResumeAnalysisOptions = {
  provider?: string;
  model?: string;
  status?: ResumeAnalysis["status"];
  source?: string;
  error?: string;
  generatedAt?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compactSpaces(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[\-•·\s]+/, "")
    .trim();
}

function shorten(value: unknown, limit: number) {
  const text = compactSpaces(value);
  if (text.length <= limit) return text;
  const breakpoint = text.slice(0, limit).search(/[。；;，,][^。；;，,]*$/);
  const sliceAt = breakpoint > 50 ? breakpoint + 1 : limit;
  return `${text.slice(0, sliceAt).trim()}...`;
}

function textList(value: unknown, limit = 30) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = compactSpaces(item);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function sectionItems(parsed: Record<string, unknown>, key: string) {
  const sections = asRecord(parsed.sections);
  const section = asRecord(sections[key]);
  return textList(section.items, 40);
}

function existingSkills(parsed: Record<string, unknown>) {
  return textList(parsed.skills, 18).filter((item) => item.length <= 32);
}

function scoreLine(line: string) {
  let score = 0;
  if (/[0-9]+|%|\+|十|百|千|万/.test(line)) score += 5;
  if (/增长|转化|复盘|优化|输出|搭建|负责|推动|提升|建联|合作|分析|调研|报告|标准化|上线|落地|筛查|识别|控制/i.test(line)) score += 4;
  if (/KOL|GM|AMA|SOP|UX|Bug|listing|Dapp|TikTok|Instagram|Telegram|Binance|Gate|MEXC|KuCoin/i.test(line)) score += 3;
  if (/项目背景|教育背景|实习经历|工作经历|个人信息|求职意向/i.test(line)) score -= 6;
  if (line.length > 170) score -= 1;
  return score;
}

function categoryForLine(line: string) {
  if (/KOL|推广|社媒|社群|公众号|视频|GM|AMA|TikTok|Instagram|Telegram/i.test(line)) return "增长 / 内容运营";
  if (/数据|分析|复盘|指标|爬取|报表|转化|曝光|互动率/i.test(line)) return "数据分析";
  if (/产品|UX|Bug|竞品|体验|优化|迭代/i.test(line)) return "产品洞察";
  if (/教学|雅思|学生|授课|SOP/i.test(line)) return "教学与体系化";
  if (/视觉|海报|设计|物料|banner|排版|素材/i.test(line)) return "视觉物料";
  if (/活动|拉新|空投|listing|Dapp|Web3/i.test(line)) return "活动运营";
  return "项目执行";
}

function titleForLine(line: string, category: string) {
  const [prefix] = line.split(/[：:]/);
  if (prefix && prefix.length >= 3 && prefix.length <= 18 && !/项目背景|本项目/.test(prefix)) return shorten(prefix, 22);
  if (category === "增长 / 内容运营") return "增长与内容推广";
  if (category === "数据分析") return "数据复盘与策略支持";
  if (category === "产品洞察") return "产品体验与竞品拆解";
  if (category === "教学与体系化") return "教学体系与结果沉淀";
  if (category === "视觉物料") return "视觉物料与素材沉淀";
  if (category === "活动运营") return "活动运营与流程落地";
  return "项目执行亮点";
}

function keywordsForLine(line: string, skills: string[]) {
  const matched = skills.filter((skill) => line.toLowerCase().includes(skill.toLowerCase()));
  const inferred = [
    [/KOL|推广|社媒|公众号|视频/i, "content marketing"],
    [/数据|分析|复盘|指标|报表/i, "data analysis"],
    [/产品|UX|Bug|竞品|体验/i, "product insight"],
    [/SOP|标准化|流程/i, "process design"],
    [/视觉|海报|banner|素材/i, "visual production"],
    [/调研|报告|拆解/i, "research"]
  ]
    .filter(([pattern]) => (pattern as RegExp).test(line))
    .map(([, label]) => label as string);
  return uniqueStrings([...matched, ...inferred], 4);
}

function highlightFromLine(line: string, skills: string[]): ResumeHighlight {
  const category = categoryForLine(line);
  const [, rest] = line.split(/[：:]/);
  const evidence = rest && rest.trim().length > 12
    ? shorten(rest, 135)
    : shorten(line.replace(/^[^：:]{3,18}[：:]/, ""), 135);
  return {
    title: titleForLine(line, category),
    evidence,
    category,
    keywords: keywordsForLine(line, skills)
  };
}

function uniqueStrings(values: string[], limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const item = compactSpaces(value);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function keywordGroupsForSkills(skills: string[]) {
  const operation = skills.filter((item) => /marketing|writing|research|presentation|project management|collaboration|language/i.test(item));
  const tools = skills.filter((item) => /python|figma|excel|word|frontend|canva|spss|sql/i.test(item));
  const groups = [
    { label: "核心能力", keywords: uniqueStrings(operation.length ? operation : skills.slice(0, 6), 6) },
    { label: "工具与方法", keywords: uniqueStrings(tools, 6) }
  ].filter((group) => group.keywords.length);
  return groups.length ? groups : [{ label: "关键词", keywords: uniqueStrings(skills, 8) }];
}

function summaryTitleForSkills(skills: string[]) {
  const text = skills.join(" ").toLowerCase();
  if (/marketing|运营|writing|content/.test(text)) return "内容运营与增长协作型候选人";
  if (/data|analysis|research/.test(text)) return "调研分析与项目执行型候选人";
  if (/presentation|visual|figma|design/.test(text)) return "视觉表达与项目呈现型候选人";
  return "可被快速理解的协作型候选人";
}

export function buildFallbackResumeAnalysis(parsedInput: unknown, options: ResumeAnalysisOptions = {}): ResumeAnalysis {
  const parsed = asRecord(parsedInput);
  const skills = existingSkills(parsed);
  const candidateLines = uniqueStrings([
    ...sectionItems(parsed, "experience"),
    ...sectionItems(parsed, "projects"),
    ...textList(parsed.highlights, 24)
  ], 40)
    .filter((line) => scoreLine(line) > -2)
    .sort((a, b) => scoreLine(b) - scoreLine(a));
  const highlights = candidateLines
    .map((line) => highlightFromLine(line, skills))
    .filter((item) => item.evidence.length > 8)
    .slice(0, resumeAiHighlightLimit);
  const education = sectionItems(parsed, "education")[0];
  const summaryBits = [
    education ? `背景：${shorten(education, 70)}` : "",
    skills.length ? `能力关键词集中在 ${skills.slice(0, 6).join("、")}。` : "",
    highlights[0]?.evidence ? `可见证据包括：${shorten(highlights[0].evidence, 95)}` : ""
  ].filter(Boolean);

  return {
    parserVersion: resumeAiParserVersion,
    summaryTitle: summaryTitleForSkills(skills),
    summaryBody: summaryBits.join(" ") || "已提取简历文本，但还没有足够清晰的经历证据；建议补充项目成果、量化结果和个人职责后重新整理。",
    keywordGroups: keywordGroupsForSkills(skills),
    highlights,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    provider: options.provider ?? "local-fallback",
    model: options.model ?? "rule-compression",
    status: options.status ?? "fallback",
    source: options.source,
    error: options.error
  };
}

export function normalizeResumeAnalysis(value: unknown, fallback?: ResumeAnalysis): ResumeAnalysis | null {
  const source = asRecord(value);
  const summaryTitle = shorten(source.summaryTitle, 72);
  const summaryBody = shorten(source.summaryBody, 420);
  const groups = Array.isArray(source.keywordGroups)
    ? source.keywordGroups.map((group) => {
      const record = asRecord(group);
      return {
        label: shorten(record.label, 32),
        keywords: uniqueStrings(textList(record.keywords, 12).map((item) => shorten(item, 32)), 8)
      };
    }).filter((group) => group.label && group.keywords.length)
    : [];
  const highlights = Array.isArray(source.highlights)
    ? source.highlights.map((item) => {
      const record = asRecord(item);
      return {
        title: shorten(record.title, 48),
        evidence: shorten(record.evidence, 180),
        category: shorten(record.category, 36) || "项目执行",
        keywords: uniqueStrings(textList(record.keywords, 8).map((keyword) => shorten(keyword, 32)), 5)
      };
    }).filter((item) => item.title && item.evidence).slice(0, resumeAiHighlightLimit)
    : [];

  if (!summaryTitle && !summaryBody && highlights.length === 0) return fallback ?? null;

  return {
    parserVersion: shorten(source.parserVersion, 32) || resumeAiParserVersion,
    summaryTitle: summaryTitle || fallback?.summaryTitle || "简历摘要",
    summaryBody: summaryBody || fallback?.summaryBody || "暂无可展示摘要。",
    keywordGroups: groups.length ? groups : fallback?.keywordGroups ?? [],
    highlights: highlights.length ? highlights : fallback?.highlights ?? [],
    generatedAt: shorten(source.generatedAt, 40) || fallback?.generatedAt || new Date().toISOString(),
    provider: shorten(source.provider, 40) || fallback?.provider || "unknown",
    model: shorten(source.model, 60) || fallback?.model || "unknown",
    status: source.status === "manual" || source.status === "generated" || source.status === "fallback" ? source.status : fallback?.status ?? "fallback",
    source: shorten(source.source, 80) || fallback?.source,
    error: shorten(source.error, 160) || fallback?.error
  };
}

export function resolveResumeAnalysis(parsedInput: unknown): ResolvedResumeAnalysis {
  const parsed = asRecord(parsedInput);
  const fallback = buildFallbackResumeAnalysis(parsed);
  const ai = normalizeResumeAnalysis(parsed.analysis, fallback);
  const manual = normalizeResumeAnalysis(parsed.manualAnalysis, ai ?? fallback);
  if (manual && asRecord(parsed.manualAnalysis).status === "manual") return { analysis: manual, source: "manual" };
  if (ai && asRecord(parsed.analysis).parserVersion === resumeAiParserVersion) return { analysis: ai, source: ai.status === "fallback" ? "fallback" : "ai" };
  return { analysis: fallback, source: "fallback" };
}

export function resumeNeedsAiAnalysis(parsedInput: unknown) {
  const parsed = asRecord(parsedInput);
  return asRecord(parsed.analysis).parserVersion !== resumeAiParserVersion;
}

export function withManualResumeAnalysis(parsedInput: unknown, manualInput: unknown) {
  const parsed = asRecord(parsedInput);
  const base = resolveResumeAnalysis(parsed).analysis;
  const manual = normalizeResumeAnalysis({ ...base, ...asRecord(manualInput), status: "manual", provider: "manual", model: "user-edit" }, base);
  return {
    ...parsed,
    manualAnalysis: manual
  };
}

export function withoutManualResumeAnalysis(parsedInput: unknown) {
  const parsed = { ...asRecord(parsedInput) };
  delete parsed.manualAnalysis;
  return parsed;
}
