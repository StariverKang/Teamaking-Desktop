import { createRequire } from "node:module";
import { stat } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/http";

const require = createRequire(import.meta.url);

export const crawlerScriptCandidatesByTarget: Record<string, string[]> = {
  programme_handbook: [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "scripts", "bnbu-crawler", "run-handbook-preview.mjs"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "local_bnbu_course_pipeline", "run_handbook_preview.mjs")
  ],
  course_catalog: [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "scripts", "bnbu-crawler", "run-course-catalog.mjs")
  ]
};

export type CrawlerRuntimeStatus = {
  ok: boolean;
  target: string;
  runnerPath?: string;
  pdfjsDist?: {
    required: boolean;
    ok: boolean;
    packagePath?: string;
    error?: string;
  };
  error?: string;
};

export async function crawlerScriptPath(target: string) {
  const crawlerScriptCandidates = crawlerScriptCandidatesByTarget[target] ?? [];
  for (const candidate of crawlerScriptCandidates) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) return candidate;
  }
  throw new ApiError(500, `没有找到 BNBU crawler runner：${target}。请确认 scripts/bnbu-crawler 已部署。`);
}

export function resolvePdfjsDistPackage() {
  return require.resolve("pdfjs-dist/package.json");
}

export async function crawlerRuntimeStatus(target: string): Promise<CrawlerRuntimeStatus> {
  try {
    const runnerPath = await crawlerScriptPath(target);
    const pdfjsRequired = target === "programme_handbook";
    const pdfjsDist: CrawlerRuntimeStatus["pdfjsDist"] = { required: pdfjsRequired, ok: true };
    if (pdfjsRequired) {
      try {
        pdfjsDist.packagePath = resolvePdfjsDistPackage();
      } catch (error) {
        pdfjsDist.ok = false;
        pdfjsDist.error = error instanceof Error ? error.message : String(error);
      }
    }
    return {
      ok: Boolean(runnerPath && pdfjsDist.ok),
      target,
      runnerPath,
      pdfjsDist
    };
  } catch (error) {
    return {
      ok: false,
      target,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function assertCrawlerRuntimeReady(target: string) {
  const status = await crawlerRuntimeStatus(target);
  if (!status.ok) {
    const pdfjsError = status.pdfjsDist?.error ? ` pdfjs-dist: ${status.pdfjsDist.error}` : "";
    throw new ApiError(500, `Crawler runtime 未就绪：${status.error ?? "依赖缺失。"}${pdfjsError}`, undefined, status);
  }
  return status;
}
