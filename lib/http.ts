import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { ERROR_CODES, type ErrorCode, errorCodeForStatus } from "@/lib/error-codes";

export class ApiError extends Error {
  status: number;
  errorCode: ErrorCode;
  metadata?: unknown;

  constructor(status: number, message: string, errorCode?: ErrorCode, metadata?: unknown) {
    super(message);
    this.status = status;
    this.errorCode = errorCode ?? errorCodeForStatus(status);
    this.metadata = metadata;
  }
}

type NormalizedError = {
  requestId: string;
  errorCode: ErrorCode;
  message: string;
  status: number;
  stackDigest?: string;
  metadata?: unknown;
};

type HandleApiOptions = {
  request?: Request;
  onError?: (error: NormalizedError) => Promise<void>;
};

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function created(data: unknown) {
  return ok(data, 201);
}

export async function readBody<T extends Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function assertString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, `缺少必要字段：${field}`);
  }

  return value.trim();
}

export function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function stackDigestFor(error: unknown) {
  const stack = error instanceof Error ? error.stack : undefined;
  if (!stack) return undefined;
  return createHash("sha256").update(stack).digest("hex").slice(0, 24);
}

export async function handleApi(handler: () => Promise<NextResponse>, options: HandleApiOptions = {}) {
  try {
    return await handler();
  } catch (error) {
    const requestId = randomUUID();
    if (error instanceof ApiError) {
      const normalized = {
        requestId,
        errorCode: error.errorCode,
        message: error.message,
        status: error.status,
        stackDigest: stackDigestFor(error),
        metadata: error.metadata
      };
      await options.onError?.(normalized).catch((logError) => console.error(logError));
      return NextResponse.json({ error: error.message, errorCode: error.errorCode, requestId }, { status: error.status });
    }

    console.error(error);
    const normalized = {
      requestId,
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "服务器暂时无法完成请求，请稍后再试。",
      status: 500,
      stackDigest: stackDigestFor(error)
    };
    await options.onError?.(normalized).catch((logError) => console.error(logError));
    return NextResponse.json(
      { error: normalized.message, errorCode: normalized.errorCode, requestId },
      { status: normalized.status }
    );
  }
}
