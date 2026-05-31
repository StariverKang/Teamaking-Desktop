import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/http";
import { applicationRoot, relativeStorageKey, resolveStorageKey, storageKeyRoot, writableDataRoot } from "@/lib/server/runtime-paths";

export const writableStorageRoot = writableDataRoot();
export const importArtifactDir = path.join(writableStorageRoot, "course_import_artifacts");
export const crawlerOutputDir = path.join(writableStorageRoot, "crawler_outputs");
export const staticBnbuImportDir = path.join(writableStorageRoot, "course_imports", "bnbu");
export const bundledStaticBnbuImportDir = path.join(applicationRoot(), "course_imports", "bnbu");

export type StoredJsonFile = {
  name: string;
  storageKey: string;
  size: number;
  modifiedAt: string;
  downloadUrl: string;
  jobId?: string;
};

export function timestampFilePrefix(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "course-import";
}

export async function writeImportArtifact(payload: Record<string, unknown>, name: string) {
  await mkdir(importArtifactDir, { recursive: true });
  const fileName = `${timestampFilePrefix()}_${safeFilePart(name)}.teamaking.json`;
  const absolutePath = path.join(importArtifactDir, fileName);
  const storageKey = relativeStorageKey(absolutePath);
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(absolutePath, content, "utf8");
  return { fileName, storageKey, size: Buffer.byteLength(content, "utf8") };
}

export function jsonDownloadResponse(payload: unknown, filename: string) {
  return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilePart(filename).replace(/\.json$/i, "")}.json"`
    }
  });
}

export function defaultStoredJsonAllowedRoots() {
  return [importArtifactDir, crawlerOutputDir, staticBnbuImportDir, bundledStaticBnbuImportDir];
}

export function resolveStoredJsonPath(storageKey?: string | null, allowedRoots = defaultStoredJsonAllowedRoots()) {
  if (!storageKey) throw new ApiError(404, "找不到可下载文件。");
  const absolutePath = resolveStorageKey(storageKey, allowedRoots, storageKeyRoot());
  if (!absolutePath.endsWith(".json")) throw new ApiError(403, "文件路径不允许下载。");
  return absolutePath;
}

export async function readStoredJson(storageKey?: string | null, allowedRoots = defaultStoredJsonAllowedRoots()) {
  return readFile(resolveStoredJsonPath(storageKey, allowedRoots), "utf8");
}

function outputJobId(storageKey: string) {
  const relative = path.relative(path.resolve(crawlerOutputDir), path.resolve(storageKeyRoot(), storageKey));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  const [first, ...rest] = relative.split(path.sep);
  return first && rest.length ? first : undefined;
}

export async function listCrawlerOutputs(dirs = [crawlerOutputDir, staticBnbuImportDir]) {
  const files: StoredJsonFile[] = [];

  async function visit(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || (!entry.name.endsWith(".teamaking.json") && !entry.name.endsWith(".json"))) continue;
      const info = await stat(absolutePath).catch(() => null);
      if (!info?.isFile()) continue;
      const storageKey = relativeStorageKey(absolutePath);
      const jobId = outputJobId(storageKey);
      files.push({
        name: entry.name,
        storageKey,
        size: info.size,
        modifiedAt: info.mtime.toISOString(),
        downloadUrl: `/api/crawler/outputs/${encodeURIComponent(Buffer.from(storageKey).toString("base64url"))}/download`,
        ...(jobId ? { jobId } : {})
      });
    }
  }

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
    await visit(dir);
  }
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
