import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { zipSync, unzipSync } from "fflate";
import { ApiError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  applicationRoot,
  desktopDataRoot,
  ensureRuntimeDir,
  isDesktopRuntime,
  listRuntimeFiles,
  readRuntimeFile,
  resolveStorageKey,
  storageKeyRoot,
  uploadsRoot,
  writeRuntimeFile
} from "@/lib/server/runtime-paths";

function requireDesktopRuntime() {
  if (!isDesktopRuntime()) {
    throw new ApiError(404, "这个桌面端接口只在 TEAMAKING Desktop 中可用。");
  }
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".txt" || ext === ".md") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function safeZipEntryName(storageKey: string) {
  const normalized = storageKey.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("../") || normalized === "..") {
    throw new ApiError(400, "备份包包含不允许的文件路径。");
  }
  return normalized;
}

export async function handleDesktop(method: string, pathParts: string[], request: NextRequest) {
  requireDesktopRuntime();

  if (method === "GET" && pathParts[1] === "health") {
    let database = "ok";
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
    } catch (error) {
      database = error instanceof Error ? error.message : "failed";
    }
    return ok({
      runtime: "desktop",
      ok: database === "ok",
      database,
      appRoot: applicationRoot(),
      dataDir: desktopDataRoot(),
      uploadsDir: uploadsRoot()
    });
  }

  if (method === "GET" && pathParts[1] === "settings") {
    return ok({
      runtime: "desktop",
      appRoot: applicationRoot(),
      dataDir: desktopDataRoot(),
      authMode: process.env.AUTH_MODE || "local",
      uploadStorageMode: process.env.UPLOAD_STORAGE_MODE || "desktop"
    });
  }

  if (method === "GET" && pathParts[1] === "files" && pathParts[2]) {
    const storageKey = Buffer.from(pathParts[2], "base64url").toString("utf8");
    const absolutePath = resolveStorageKey(storageKey, [uploadsRoot()], storageKeyRoot());
    const buffer = await readRuntimeFile(storageKey, [uploadsRoot()]);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypeFor(absolutePath),
        "Cache-Control": "private, max-age=3600"
      }
    });
  }

  if (method === "GET" && pathParts[1] === "backup" && pathParts[2] === "export") {
    await ensureRuntimeDir(desktopDataRoot());
    const files = await listRuntimeFiles(desktopDataRoot());
    const entries: Record<string, Uint8Array> = {};
    for (const file of files) {
      entries[safeZipEntryName(file.storageKey)] = new Uint8Array(await readFile(file.absolutePath));
    }
    entries["teamaking-desktop-backup-manifest.json"] = new TextEncoder().encode(JSON.stringify({
      product: "TEAMAKING Desktop",
      exportedAt: new Date().toISOString(),
      fileCount: files.length
    }, null, 2));
    const zip = zipSync(entries, { level: 6 });
    const filename = `teamaking-desktop-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  }

  if (method === "POST" && pathParts[1] === "backup" && pathParts[2] === "import") {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "请上传 TEAMAKING Desktop 备份 zip。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(bytes);
    let restoredCount = 0;
    for (const [name, value] of Object.entries(entries)) {
      if (name.endsWith("/") || name === "teamaking-desktop-backup-manifest.json") continue;
      const storageKey = safeZipEntryName(name);
      const absolutePath = resolveStorageKey(storageKey, [desktopDataRoot()], storageKeyRoot());
      await writeRuntimeFile(absolutePath, Buffer.from(value));
      restoredCount += 1;
    }
    return ok({
      restoredCount,
      message: "备份已导入。若备份包含数据库文件，请重启 TEAMAKING Desktop 后继续使用。"
    });
  }

  throw new ApiError(404, "找不到桌面端接口。");
}
