import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  }));
  return files.flat();
}

async function countLines(file: string): Promise<number> {
  const source = await readFile(path.join(process.cwd(), file), "utf8");
  return source.trim().split(/\r?\n/).length;
}

function gitStatus(args: string[]) {
  return spawnSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).status ?? 1;
}

describe("architecture guardrails", () => {
  it("keeps the catch-all route as a thin Next.js entrypoint", async () => {
    const route = await readFile(path.join(process.cwd(), "app/api/[...route]/route.ts"), "utf8");
    const lines = route.trim().split(/\r?\n/);
    const banned = [
      "from \"@/lib/prisma\"",
      "prisma.",
      "async function handle",
      "function handle",
      "createHash",
      "spawn(",
      "function createCourseImportBatchFromPayload",
      "function approveCourseImportBatch",
      "function createCourseImportDataset",
      "function payloadFromDataset",
      "function buildCourseImportPreview",
      "function buildBnbuDatabaseCoverage",
      "function applyBnbuCourseImport",
      "function createVersionCheckpoint",
      "function restoreCheckpointAsNewVersion",
      "function createAppVersionFromAdminRequest",
      "function versionSnapshotChunks"
    ];
    expect(lines.length).toBeLessThanOrEqual(80);
    expect(route).toContain("handleApplicationApiRoute");
    for (const name of banned) expect(route).not.toContain(name);
  });

  it("keeps the application API module as a registry dispatcher", async () => {
    const moduleSource = await readFile(path.join(process.cwd(), "lib/server/api/application-module.ts"), "utf8");
    const lines = moduleSource.trim().split(/\r?\n/);
    const banned = [
      "from \"@/lib/prisma\"",
      "prisma.",
      "spawn(",
      "function createCourseImportBatchFromPayload",
      "function approveCourseImportBatch",
      "function createVersionCheckpoint",
      "function restoreCheckpointAsNewVersion"
    ];
    expect(lines.length).toBeLessThanOrEqual(120);
    expect(moduleSource).toContain("createApiModuleRegistry");
    expect(moduleSource).toContain("apiModuleRegistry.resolve");
    for (const name of banned) expect(moduleSource).not.toContain(name);
  });

  it("keeps compatibility client page barrels empty of implementations", async () => {
    const clientPages = await readFile(path.join(process.cwd(), "components/client-pages.tsx"), "utf8");
    const implementationBarrel = await readFile(path.join(process.cwd(), "components/pages/client-page-implementations.tsx"), "utf8");
    const adminPages = await readFile(path.join(process.cwd(), "components/pages/admin-pages.tsx"), "utf8");
    const sharedPageParts = await readFile(path.join(process.cwd(), "components/pages/shared-page-parts.tsx"), "utf8");
    const profilePages = await readFile(path.join(process.cwd(), "components/pages/profile-pages.tsx"), "utf8");
    const coursesModule = await readFile(path.join(process.cwd(), "lib/server/api/courses-module.ts"), "utf8");
    const socialModule = await readFile(path.join(process.cwd(), "lib/server/api/social-module.ts"), "utf8");
    const apiSupport = await readFile(path.join(process.cwd(), "lib/server/api/support.ts"), "utf8");

    expect(clientPages.trim().split(/\r?\n/).length).toBeLessThanOrEqual(8);
    expect(clientPages).not.toMatch(/function\s+[A-Z].*Page/);
    expect(implementationBarrel.trim().split(/\r?\n/).length).toBeLessThanOrEqual(20);
    expect(implementationBarrel).not.toMatch(/function\s+[A-Z].*Page/);
    expect(adminPages.trim().split(/\r?\n/).length).toBeLessThanOrEqual(8);
    expect(adminPages).not.toMatch(/function\s+[A-Z].*Page/);
    expect(sharedPageParts.trim().split(/\r?\n/).length).toBeLessThanOrEqual(12);
    expect(profilePages.trim().split(/\r?\n/).length).toBeLessThanOrEqual(8);
    expect(coursesModule.trim().split(/\r?\n/).length).toBeLessThanOrEqual(12);
    expect(socialModule.trim().split(/\r?\n/).length).toBeLessThanOrEqual(12);
    expect(apiSupport.trim().split(/\r?\n/).length).toBeLessThanOrEqual(20);
    for (const line of apiSupport.split(/\r?\n/).filter((value) => value.trim())) {
      expect(line.trim()).toMatch(/^export \* from /);
    }
  });

  it("prevents app and page modules from importing compatibility page barrels", async () => {
    const files = [...await sourceFiles(path.join(process.cwd(), "app")), ...await sourceFiles(path.join(process.cwd(), "components/pages"))];
    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (path.basename(file) === "client-page-implementations.tsx") continue;
      if (path.basename(file) === "admin-pages.tsx") continue;
      if (path.basename(file) === "shared-page-parts.tsx") continue;
      if (path.basename(file) === "profile-pages.tsx") continue;
      if (/from\s+["'][^"']*components\/client-pages["']/.test(source)) offenders.push(path.relative(process.cwd(), file));
      if (/from\s+["'][^"']*components\/pages\/client-page-implementations["']/.test(source)) offenders.push(path.relative(process.cwd(), file));
      if (/from\s+["'][^"']*components\/pages\/admin-pages["']/.test(source)) offenders.push(path.relative(process.cwd(), file));
      if (/from\s+["'][^"']*components\/pages\/shared-page-parts["']/.test(source)) offenders.push(path.relative(process.cwd(), file));
      if (/from\s+["'][^"']*components\/pages\/profile-pages["']/.test(source)) offenders.push(path.relative(process.cwd(), file));
    }
    expect(offenders).toEqual([]);
  });

  it("keeps contact developer as a single public document page", async () => {
    const contactPage = await readFile(path.join(process.cwd(), "app/contact-developer/page.tsx"), "utf8");

    expect(contactPage).toContain("ContactDeveloperPage");
    expect(contactPage).not.toContain("ContentDocumentsPage");
  });

  it("prevents server modules from importing the legacy API support barrel", async () => {
    const files = await sourceFiles(path.join(process.cwd(), "lib/server"));
    const offenders: string[] = [];
    for (const file of files) {
      if (path.relative(process.cwd(), file) === "lib/server/api/support.ts") continue;
      const source = await readFile(file, "utf8");
      if (/from\s+["']@\/lib\/server\/api\/support["']/.test(source)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps split page, API, admin and service modules below the balanced file-size ceiling", async () => {
    const cappedFiles = [
      "lib/server/api/support.ts",
      "lib/server/course-import/workflow.ts",
      "lib/server/admin/versions-module.ts",
      ...await sourceFiles(path.join(process.cwd(), "components/pages")),
      ...await sourceFiles(path.join(process.cwd(), "lib/server/api")),
      ...await sourceFiles(path.join(process.cwd(), "components/pages/admin")),
      ...await sourceFiles(path.join(process.cwd(), "lib/server/services")),
      ...await sourceFiles(path.join(process.cwd(), "lib/server/course-import/workflows")),
      ...await sourceFiles(path.join(process.cwd(), "lib/server/admin/versions"))
    ].map((file) => path.isAbsolute(file) ? path.relative(process.cwd(), file) : file);

    const oversized: Array<{ file: string; lines: number }> = [];
    for (const file of cappedFiles) {
      const lines = await countLines(file);
      if (lines > 700) oversized.push({ file, lines });
    }
    expect(oversized).toEqual([]);
  });

  it("keeps API handlers as adapters instead of business implementations", async () => {
    const adapterFiles = [
      "lib/server/api/support.ts",
      "lib/server/api/admin-resources-module.ts",
      "lib/server/course-import/workflow.ts",
      "lib/server/admin/versions-module.ts"
    ];
    const bannedDefinitions = [
      "applyBnbuCourseImport",
      "approveCourseImportBatch",
      "buildBnbuDatabaseCoverage",
      "createAppVersionFromAdminRequest",
      "createCourseImportBatchFromPayload",
      "createCourseImportDataset",
      "createVersionCheckpoint",
      "payloadFromDataset",
      "restoreCheckpointAsNewVersion",
      "versionSnapshotChunks"
    ];
    const offenders: string[] = [];

    for (const file of adapterFiles) {
      const source = await readFile(path.join(process.cwd(), file), "utf8");
      if (source.includes("from \"@/lib/prisma\"") || source.includes("prisma.")) offenders.push(`${file}: prisma`);
      for (const name of bannedDefinitions) {
        if (new RegExp(`function\\s+${name}\\b`).test(source)) offenders.push(`${file}: ${name}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps source storage helpers tracked despite ignoring runtime storage output", async () => {
    const file = "lib/server/storage/json-files.ts";

    await readFile(path.join(process.cwd(), file), "utf8");

    expect(gitStatus(["check-ignore", "--quiet", file])).not.toBe(0);
    expect(gitStatus(["ls-files", "--error-unmatch", file])).toBe(0);
  });
});
