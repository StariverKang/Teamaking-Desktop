import { prisma } from "@/lib/prisma";

export const crawlerAiConfigKey = "crawler_ai";
export const defaultCrawlerAiModel = "gpt-4.1-mini";
export const defaultCrawlerAiTimeoutMs = 25000;

export type CrawlerAiRuntimeConfig = {
  enabled: boolean;
  provider: "openai";
  model: string;
  apiKey: string;
  apiKeySource: "site_config" | "env" | "missing";
  timeoutMs: number;
  strictMode: boolean;
};

export type PublicCrawlerAiConfig = Omit<CrawlerAiRuntimeConfig, "apiKey"> & {
  apiKeySet: boolean;
  apiKeyPreview: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampTimeoutMs(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return defaultCrawlerAiTimeoutMs;
  return Math.min(Math.max(Math.round(numeric), 3000), 120000);
}

function clampBoolean(value: unknown, fallback: boolean) {
  return value === true ? true : value === false ? false : fallback;
}

function maskApiKey(apiKey: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 10) return "configured";
  return `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}`;
}

export function normalizeStoredCrawlerAiConfig(value: unknown) {
  const source = asRecord(value);
  return {
    enabled: source.enabled === true,
    provider: "openai" as const,
    model: optionalString(source.model) ?? process.env.CRAWLER_AI_MODEL ?? process.env.OPENAI_MODEL ?? defaultCrawlerAiModel,
    apiKey: optionalString(source.apiKey) ?? "",
    timeoutMs: clampTimeoutMs(source.timeoutMs),
    strictMode: clampBoolean(source.strictMode, false)
  };
}

export function publicCrawlerAiConfig(config: CrawlerAiRuntimeConfig): PublicCrawlerAiConfig {
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    apiKeySource: config.apiKeySource,
    timeoutMs: config.timeoutMs,
    strictMode: config.strictMode,
    apiKeySet: Boolean(config.apiKey),
    apiKeyPreview: maskApiKey(config.apiKey)
  };
}

export function maskStoredCrawlerAiConfig(value: unknown) {
  const normalized = normalizeStoredCrawlerAiConfig(value);
  return {
    enabled: normalized.enabled,
    provider: normalized.provider,
    model: normalized.model,
    timeoutMs: normalized.timeoutMs,
    strictMode: normalized.strictMode,
    apiKeySet: Boolean(normalized.apiKey),
    apiKeyPreview: maskApiKey(normalized.apiKey)
  };
}

async function readStoredConfigValue() {
  const row = await prisma.siteConfig.findUnique({ where: { key: crawlerAiConfigKey } });
  return row?.value ?? {};
}

export async function getCrawlerAiRuntimeConfig(): Promise<CrawlerAiRuntimeConfig> {
  let storedValue: unknown = {};
  try {
    storedValue = await readStoredConfigValue();
  } catch {
    storedValue = {};
  }
  const stored = normalizeStoredCrawlerAiConfig(storedValue);
  const envApiKey = optionalString(process.env.OPENAI_API_KEY) ?? "";
  const apiKey = stored.apiKey || envApiKey;
  return {
    enabled: stored.enabled,
    provider: "openai",
    model: stored.model,
    apiKey,
    apiKeySource: stored.apiKey ? "site_config" : envApiKey ? "env" : "missing",
    timeoutMs: stored.timeoutMs,
    strictMode: stored.strictMode
  };
}

export async function getPublicCrawlerAiConfig() {
  return publicCrawlerAiConfig(await getCrawlerAiRuntimeConfig());
}

export async function buildStoredCrawlerAiConfigPatch(body: Record<string, unknown>) {
  const existing = normalizeStoredCrawlerAiConfig(await readStoredConfigValue());
  const next = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
    provider: "openai" as const,
    model: optionalString(body.model) ?? existing.model,
    timeoutMs: Object.prototype.hasOwnProperty.call(body, "timeoutMs") ? clampTimeoutMs(body.timeoutMs) : existing.timeoutMs,
    strictMode: Object.prototype.hasOwnProperty.call(body, "strictMode") ? clampBoolean(body.strictMode, false) : existing.strictMode,
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
