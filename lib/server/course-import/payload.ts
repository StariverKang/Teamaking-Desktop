import { ERROR_CODES } from "@/lib/error-codes";
import { ApiError } from "@/lib/http";

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter(isPlainRecord) : [];
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeParsedPayload(parsed: Record<string, unknown>) {
  if (textValue(parsed.schemaVersion)) return parsed;

  const bundleFiles = records(parsed.files);
  const bundlePayloads = bundleFiles
    .map((file) => (isPlainRecord(file.payload) ? file.payload : null))
    .filter((payload): payload is Record<string, unknown> => Boolean(payload));

  if (bundlePayloads.length === 1) return bundlePayloads[0];

  if (bundlePayloads.length > 1) {
    throw new ApiError(
      400,
      `你粘贴的是爬虫输出整包，里面包含 ${bundlePayloads.length} 份 admission JSON。请在 crawler Jobs 里点击单个 “可导入 JSON” 文件下载并粘贴；或者在 crawler 表单的 After crawl 中选择 create_pending / approve_import 自动处理。`,
      ERROR_CODES.COURSE_IMPORT_INVALID_JSON,
      {
        kind: "crawler_output_bundle",
        fileCount: bundlePayloads.length,
        fileNames: bundleFiles.map((file) => textValue(file.name)).filter(Boolean)
      }
    );
  }

  if (bundleFiles.length || isPlainRecord(parsed.job)) {
    throw new ApiError(
      400,
      "你粘贴的是爬虫输出整包，但里面没有可导入的 payload。请下载单个 bnbu-YYYY-admission-handbook.teamaking.json 后再导入。",
      ERROR_CODES.COURSE_IMPORT_INVALID_JSON,
      { kind: "crawler_output_bundle" }
    );
  }

  return parsed;
}

export function courseImportPayloadFromBody(body: Record<string, unknown>) {
  const candidate = body.payload ?? body;
  if (typeof candidate === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      throw new ApiError(400, "payload 不是合法 JSON。", ERROR_CODES.COURSE_IMPORT_INVALID_JSON);
    }
    if (isPlainRecord(parsed)) return normalizeParsedPayload(parsed);
  }
  if (isPlainRecord(candidate)) return normalizeParsedPayload(candidate);
  throw new ApiError(400, "payload must be a JSON object.", ERROR_CODES.COURSE_IMPORT_INVALID_JSON);
}
