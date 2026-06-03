
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, optionalString } from "@/lib/http";

import { fileExtensionOf, portfolioTypeOptions, previewKindForFile } from "@/lib/profile-assets";
import { applicationRoot } from "@/lib/server/runtime-paths";

export function jsonObject(value: unknown, fallback: Record<string, unknown> = {}): any {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  return JSON.parse(JSON.stringify(source));
}

export function portfolioPayload(body: Record<string, unknown>, existing?: any) {
  const requestedType = optionalString(body.type) ?? existing?.type ?? "portfolio";
  const type = portfolioTypeOptions().includes(requestedType) ? requestedType : "other";
  const fileName = optionalString(body.fileName) ?? existing?.fileName;
  const fileExtension = optionalString(body.fileExtension) ?? (fileName ? fileExtensionOf(fileName) : existing?.fileExtension);
  const previewKind = optionalString(body.previewKind) ?? (fileName ? previewKindForFile(fileName) : existing?.previewKind ?? "link");
  const isPinned = typeof body.isPinned === "boolean" ? body.isPinned : existing?.isPinned ?? false;
  const fieldText = (field: string, fallback?: string | null) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) return typeof body[field] === "string" ? (body[field] as string).trim() : "";
    return fallback ?? "";
  };

  return {
    title: optionalString(body.title) ?? existing?.title ?? "Untitled evidence",
    type,
    relatedCourseId: optionalString(body.relatedCourseId) ?? existing?.relatedCourseId,
    semesterText: optionalString(body.semesterText) ?? existing?.semesterText,
    myRole: optionalString(body.myRole) ?? existing?.myRole,
    contributionDescription: fieldText("contributionDescription", existing?.contributionDescription),
    isGroupWork: typeof body.isGroupWork === "boolean" ? body.isGroupWork : existing?.isGroupWork ?? false,
    fileName,
    fileMimeType: optionalString(body.fileMimeType) ?? existing?.fileMimeType,
    fileSize: typeof body.fileSize === "number" ? body.fileSize : existing?.fileSize,
    fileExtension,
    storageKey: optionalString(body.storageKey) ?? existing?.storageKey,
    storageMode: optionalString(body.storageMode) ?? existing?.storageMode,
    storageProvider: optionalString(body.storageProvider) ?? existing?.storageProvider,
    objectKey: optionalString(body.objectKey) ?? existing?.objectKey,
    scanStatus: optionalString(body.scanStatus) ?? existing?.scanStatus ?? "not_scanned",
    fileUrl: optionalString(body.fileUrl) ?? existing?.fileUrl,
    externalUrl: optionalString(body.externalUrl) ?? existing?.externalUrl,
    previewKind,
    outcome: fieldText("outcome", existing?.outcome),
    reflection: fieldText("reflection", existing?.reflection),
    parsedText: optionalString(body.parsedText) ?? existing?.parsedText,
    metadata: jsonObject(body.metadata, existing?.metadata ?? {}),
    visibility: optionalString(body.visibility) ?? existing?.visibility ?? "same_school",
    isPinned
  };
}

export async function resumeBufferFromUrl(resumeUrl: string) {
  if (resumeUrl.startsWith("data:")) {
    const base64 = resumeUrl.split(",")[1] ?? "";
    return Buffer.from(base64, "base64");
  }

  if (resumeUrl.startsWith("/uploads/") || resumeUrl.startsWith("uploads/")) {
    const normalized = resumeUrl.startsWith("/") ? resumeUrl : `/${resumeUrl}`;
    const publicRoot = path.resolve(applicationRoot(), "public", "uploads");
    const absolutePath = path.resolve(applicationRoot(), "public", `.${normalized}`);
    if (!absolutePath.startsWith(`${publicRoot}${path.sep}`)) throw new ApiError(403, "简历文件路径不允许重新解析。");
    return readFile(absolutePath);
  }

  if (/^https?:\/\//i.test(resumeUrl)) {
    const response = await fetch(resumeUrl);
    if (!response.ok) throw new ApiError(400, `无法读取简历 URL：${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 30 * 1024 * 1024) throw new ApiError(400, "简历文件超过 30MB，无法重新解析。");
    return buffer;
  }

  throw new ApiError(400, "当前简历 URL 不是可重新解析的文件地址。");
}
