import OpenAI from "openai";
import { parseResumeText } from "@/lib/profile-assets";
import { operationLog } from "@/lib/server/services/system-service";
import {
  buildFallbackResumeAnalysis,
  normalizeResumeAnalysis,
  resumeAiHighlightLimit,
  resumeAiParserVersion,
  type ResumeAnalysis
} from "@/lib/resume-analysis";
import { defaultResumeAiModel, getResumeAiRuntimeConfig, type ResumeAiRuntimeConfig } from "@/lib/server/services/resume-ai-config-service";

const resumeAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summaryTitle", "summaryBody", "keywordGroups", "highlights"],
  properties: {
    summaryTitle: { type: "string" },
    summaryBody: { type: "string" },
    keywordGroups: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "keywords"],
        properties: {
          label: { type: "string" },
          keywords: { type: "array", maxItems: 8, items: { type: "string" } }
        }
      }
    },
    highlights: {
      type: "array",
      minItems: 3,
      maxItems: resumeAiHighlightLimit,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "evidence", "category", "keywords", "position", "company", "action", "result"],
        properties: {
          title: { type: "string" },
          evidence: { type: "string" },
          category: { type: "string" },
          position: { type: "string" },
          company: { type: "string" },
          action: { type: "string" },
          result: { type: "string" },
          keywords: { type: "array", maxItems: 5, items: { type: "string" } }
        }
      }
    }
  }
};

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160);
}

function fallback(parsed: any, reason: string, model = process.env.OPENAI_RESUME_MODEL || defaultResumeAiModel) {
  return buildFallbackResumeAnalysis(parsed, {
    provider: "local-fallback",
    model,
    status: "fallback",
    source: reason,
    error: reason
  });
}

export type ResumeAiLogContext = {
  actorUserId?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  method?: string | null;
  path?: string | null;
  trigger?: string;
  fileName?: string;
};

function analysisResultForLog(analysis: ResumeAnalysis) {
  return {
    parserVersion: analysis.parserVersion,
    summaryTitle: analysis.summaryTitle,
    summaryBody: analysis.summaryBody,
    keywordGroups: analysis.keywordGroups,
    highlights: analysis.highlights,
    generatedAt: analysis.generatedAt,
    provider: analysis.provider,
    model: analysis.model,
    status: analysis.status,
    source: analysis.source,
    error: analysis.error
  };
}

async function logResumeAiAnalysis(input: {
  context?: ResumeAiLogContext;
  parsed: any;
  analysis: ResumeAnalysis;
  runtimeConfig?: ResumeAiRuntimeConfig;
  durationMs: number;
  inputChars: number;
}) {
  if (!input.context) return;
  const { context, parsed, analysis, runtimeConfig } = input;
  try {
    await operationLog({
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      action: "profile.resume.ai_analysis",
      targetType: context.targetType ?? "UserProfile",
      targetId: context.targetId,
      method: context.method,
      path: context.path,
      status: analysis.status === "generated" ? "success" : "fallback",
      summary: {
        trigger: context.trigger ?? "unknown",
        fileName: context.fileName ?? parsed?.fileName,
        parser: parsed?.parser,
        provider: analysis.provider,
        model: analysis.model,
        status: analysis.status,
        summaryTitle: analysis.summaryTitle,
        highlightCount: analysis.highlights.length,
        keywordGroupCount: analysis.keywordGroups.length,
        inputChars: input.inputChars,
        durationMs: input.durationMs,
        apiKeySource: runtimeConfig?.apiKeySource ?? "missing"
      },
      metadata: {
        analysisResult: analysisResultForLog(analysis)
      }
    });
  } catch {
    // Resume analysis should never fail because audit logging failed.
  }
}

export async function analyzeResumeParsedData(parsed: any, context?: ResumeAiLogContext): Promise<ResumeAnalysis> {
  const startedAt = Date.now();
  const runtimeConfig = await getResumeAiRuntimeConfig();
  const model = runtimeConfig.model;

  const rawText = String(parsed?.rawText ?? "").slice(0, runtimeConfig.inputLimit);
  const finish = async (analysis: ResumeAnalysis) => {
    await logResumeAiAnalysis({
      context,
      parsed,
      analysis,
      runtimeConfig,
      durationMs: Date.now() - startedAt,
      inputChars: rawText.length
    });
    return analysis;
  };

  if (!runtimeConfig.enabled) return finish(fallback(parsed, "resume AI is disabled in admin config", model));
  if (!runtimeConfig.apiKey) return finish(fallback(parsed, "OPENAI_API_KEY is not configured", model));
  if (!rawText.trim()) return finish(fallback(parsed, "resume text is empty", model));

  try {
    const client = new OpenAI({ apiKey: runtimeConfig.apiKey });
    const response = await client.responses.create({
      model,
      store: false,
      max_output_tokens: 1400,
      instructions: [
        "You analyze student resumes for TEAMAKING profiles.",
        "Return concise, useful structured JSON only.",
        "Do not copy whole resume lines. Compress and synthesize.",
        "Do not invent tools, skills, schools, companies, dates, or metrics that are not present in the text.",
        "Prefer Chinese output while preserving English proper nouns and product/platform names.",
        "Highlights must be real personal strengths or outcomes, not a full experience dump.",
        "Each highlight evidence must include role/company/action/result phrased clearly and keep one line concise.",
      ].join(" "),
      input: [
        "请根据下面简历文本生成结构化 Profile 摘要：",
        "- summaryTitle: 12-24 个中文字符，用有个性但不夸张的关键词归纳简历所属人的特质+定位，不要写学校+公司流水账。",
        "- summaryBody: 1 段，80-160 个中文字，归纳能力、方向、行业和可见证据。",
        "- keywordGroups: 2-4 组关键词，关键词必须能从原文找到证据。",
        "- highlights: 3-8 条按需生成，不要强制凑齐上限。每条 title 短、evidence 一句话；优先覆盖最有代表性的经历。",
        "- 每条 evidence 按“职位/公司/动作/结果”四要素写一条完整句，不要虚构。",
        "- 缺失要素可留空或写“待补充”，不要新增未给出的信息。",
        "",
        rawText
      ].join("\n"),
      text: {
        format: {
          type: "json_schema",
          name: "teamaking_resume_analysis",
          strict: true,
          schema: resumeAnalysisSchema
        }
      }
    });

    const parsedOutput = JSON.parse(response.output_text || "{}");
    const normalized = normalizeResumeAnalysis({
      ...parsedOutput,
      parserVersion: resumeAiParserVersion,
      generatedAt: new Date().toISOString(),
      provider: "openai",
      model,
      status: "generated"
    }, fallback(parsed, "openai normalization fallback", model));
    return finish(normalized ?? fallback(parsed, "openai returned empty analysis", model));
  } catch (error) {
    return finish(fallback(parsed, safeErrorMessage(error), model));
  }
}

export async function parseResumeTextWithAi(text: string, fileName: string, context?: ResumeAiLogContext) {
  const parsed = parseResumeText(text, fileName);
  const analysis = await analyzeResumeParsedData(parsed, { ...context, fileName });
  return {
    ...parsed,
    analysis
  };
}
