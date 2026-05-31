import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/http";

export function isDesktopRuntime() {
  return process.env.TEAMAKING_RUNTIME === "desktop" || process.env.AUTH_MODE === "local";
}

export function applicationRoot() {
  return path.resolve(process.env.TEAMAKING_APP_ROOT || /*turbopackIgnore: true*/ process.cwd());
}

export function desktopDataRoot() {
  return path.resolve(process.env.TEAMAKING_DATA_DIR || path.join(applicationRoot(), "storage"));
}

export function writableDataRoot() {
  if (process.env.VERCEL) return path.join("/tmp", "teamaking");
  return isDesktopRuntime() ? desktopDataRoot() : path.join(applicationRoot(), "storage");
}

export function uploadsRoot() {
  return isDesktopRuntime()
    ? path.join(desktopDataRoot(), "uploads")
    : path.join(applicationRoot(), "public", "uploads");
}

export function storageKeyRoot() {
  return isDesktopRuntime() ? desktopDataRoot() : applicationRoot();
}

export async function ensureRuntimeDir(dir: string) {
  await mkdir(dir, { recursive: true });
  return dir;
}

export function relativeStorageKey(absolutePath: string, root = storageKeyRoot()) {
  return path.relative(path.resolve(root), path.resolve(absolutePath));
}

export function resolveStorageKey(storageKey: string, allowedRoots: string[], root = storageKeyRoot()) {
  const absolutePath = path.resolve(root, storageKey);
  const resolvedAllowedRoots = allowedRoots.map((item) => path.resolve(item));
  const allowed = resolvedAllowedRoots.some((allowedRoot) => (
    absolutePath === allowedRoot || absolutePath.startsWith(`${allowedRoot}${path.sep}`)
  ));
  if (!allowed) throw new ApiError(403, "文件路径不允许访问。");
  return absolutePath;
}

export async function readRuntimeFile(storageKey: string, allowedRoots: string[]) {
  return readFile(resolveStorageKey(storageKey, allowedRoots));
}

export async function writeRuntimeFile(absolutePath: string, buffer: Buffer | string) {
  await ensureRuntimeDir(path.dirname(absolutePath));
  await writeFile(absolutePath, buffer);
}

export async function listRuntimeFiles(root: string) {
  const files: { absolutePath: string; storageKey: string; size: number; modifiedAt: string }[] = [];

  async function visit(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const info = await stat(absolutePath).catch(() => null);
      if (!info?.isFile()) continue;
      files.push({
        absolutePath,
        storageKey: relativeStorageKey(absolutePath),
        size: info.size,
        modifiedAt: info.mtime.toISOString()
      });
    }
  }

  await visit(root);
  return files;
}
