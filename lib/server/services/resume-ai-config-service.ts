import { prisma } from "@/lib/prisma";

export const resumeAiConfigKey = "resume_ai";
export const defaultResumeAiModel = "gpt-4.1-mini";
export const defaultResumeAiInputLimit = 14000;

export type ResumeAiRuntimeConfig = {
  enabled: boolean;
  provider: "openai";
  model: string;
  apiKey: string;
  apiKeySource: "site_config" | "env" | "missing";
  inputLimit: number;
};

export type PublicResumeAiConfig = Omit<ResumeAiRuntimeConfig, "apiKey"> & {
  apiKeySet: boolean;
  apiKeyPreview: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampInputLimit(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return defaultResumeAiInputLimit;
  return Math.min(Math.max(Math.round(numeric), 2000), 24000);
}

function maskApiKey(apiKey: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 10) return "configured";
  return `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}`;
}

export function normalizeStoredResumeAiConfig(value: unknown) {
  const source = asRecord(value);
  return {
    enabled: source.enabled === false ? false : true,
    provider: "openai" as const,
    model: optionalString(source.model) ?? process.env.OPENAI_RESUME_MODEL ?? defaultResumeAiModel,
    apiKey: optionalString(source.apiKey) ?? "",
    inputLimit: clampInputLimit(source.inputLimit)
  };
}

export function publicResumeAiConfig(config: ResumeAiRuntimeConfig): PublicResumeAiConfig {
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    apiKeySource: config.apiKeySource,
    inputLimit: config.inputLimit,
    apiKeySet: Boolean(config.apiKey),
    apiKeyPreview: maskApiKey(config.apiKey)
  };
}

export function maskStoredResumeAiConfig(value: unknown) {
  const normalized = normalizeStoredResumeAiConfig(value);
  return {
    enabled: normalized.enabled,
    provider: normalized.provider,
    model: normalized.model,
    inputLimit: normalized.inputLimit,
    apiKeySet: Boolean(normalized.apiKey),
    apiKeyPreview: maskApiKey(normalized.apiKey)
  };
}

async function readStoredConfigValue() {
  const row = await prisma.siteConfig.findUnique({ where: { key: resumeAiConfigKey } });
  return row?.value ?? {};
}

export async function getResumeAiRuntimeConfig(): Promise<ResumeAiRuntimeConfig> {
  let storedValue: unknown = {};
  try {
    storedValue = await readStoredConfigValue();
  } catch {
    storedValue = {};
  }
  const stored = normalizeStoredResumeAiConfig(storedValue);
  const envApiKey = optionalString(process.env.OPENAI_API_KEY) ?? "";
  const apiKey = stored.apiKey || envApiKey;
  return {
    enabled: stored.enabled,
    provider: "openai",
    model: stored.model,
    apiKey,
    apiKeySource: stored.apiKey ? "site_config" : envApiKey ? "env" : "missing",
    inputLimit: stored.inputLimit
  };
}

export async function getPublicResumeAiConfig() {
  return publicResumeAiConfig(await getResumeAiRuntimeConfig());
}

export async function buildStoredResumeAiConfigPatch(body: Record<string, unknown>) {
  const existing = normalizeStoredResumeAiConfig(await readStoredConfigValue());
  const next = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
    provider: "openai" as const,
    model: optionalString(body.model) ?? existing.model,
    inputLimit: Object.prototype.hasOwnProperty.call(body, "inputLimit") ? clampInputLimit(body.inputLimit) : existing.inputLimit,
    apiKey: existing.apiKey
  };

  if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    next.apiKey = body.apiKey.trim();
  }
  if (body.clearApiKey === true) {
    next.apiKey = "";
  }

  return {
    before: existing,
    value: next
  };
}
