import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";
import { ApiContext } from "@/lib/server/api-context";
import { isPlainRecord, textValue, toJson } from "@/lib/server/json-utils";
import {
  crawlerOutputDir,
  jsonDownloadResponse,
  listCrawlerOutputs,
  readStoredJson,
  safeFilePart,
  staticBnbuImportDir
} from "@/lib/server/storage/json-files";
import { ApiError, created, ok } from "@/lib/http";
import {
  crawlerOutputsChangedAfter,
  defaultCrawlerJobName,
  jobScopedCrawlerOutputDir,
  normalizeCrawlerJobInput
} from "@/lib/server/crawler/io";
import { assertCrawlerRuntimeReady, crawlerRuntimeStatus } from "@/lib/server/crawler/runtime";
import { crawlerErrorSummary } from "@/lib/server/crawler/errors";
import { CourseImportWorkflow } from "@/lib/server/course-import/workflow";

type OperationLogInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  method?: string | null;
  path?: string | null;
  status?: string;
  summary?: unknown;
  metadata?: unknown;
  appVersionId?: string;
};

export type CrawlerModuleDeps = {
  prisma: any;
  defaults: {
    handbookUrl: string;
    courseDescriptionsUrl: string;
    academicYear: string;
    term: string;
  };
  getActiveAppVersionId: () => Promise<string>;
  operationLog: (input: OperationLogInput) => Promise<void>;
  courseImportWorkflow: CourseImportWorkflow;
};

const crawlerJobs = new Map<string, any>();
const crawlerStaleMs = 30 * 60 * 1000;

function serializeCrawlerJob(job: any) {
  const input = isPlainRecord(job.input) ? job.input : {};
  const logs = Array.isArray(job.logs) ? job.logs.map(textValue) : [];
  const outputs = Array.isArray(job.outputs) ? job.outputs : [];
  const imports = Array.isArray(job.imports) ? job.imports : outputs.map((output: any) => output.importResult).filter(Boolean);
  return {
    id: job.id,
    name: job.name,
    target: job.target,
    status: job.status,
    input,
    command: job.command,
    logs,
    outputs,
    imports,
    errorMessage: job.errorMessage,
    exitCode: job.exitCode,
    startedAt: job.startedAt?.toISOString?.() ?? job.startedAt,
    finishedAt: job.finishedAt?.toISOString?.() ?? job.finishedAt,
    createdAt: job.createdAt?.toISOString?.() ?? job.createdAt,
    updatedAt: job.updatedAt?.toISOString?.() ?? job.updatedAt
  };
}

function crawlerJobBundleFilename(job: any) {
  return `${safeFilePart(job.name || job.id || "crawler-job")}-outputs-backup-not-direct-import.bundle.json`;
}

async function crawlerJobBundle(job: any) {
  const outputs = Array.isArray(job.outputs) ? job.outputs : [];
  const files = [];
  for (const output of outputs) {
    if (!output?.storageKey) continue;
    const content = await readStoredJson(output.storageKey);
    files.push({
      name: output.name,
      storageKey: output.storageKey,
      size: output.size,
      modifiedAt: output.modifiedAt,
      payload: JSON.parse(content)
    });
  }
  return {
    job: serializeCrawlerJob(job),
    files
  };
}

async function payloadFromStoredCrawlerOutput(output: any) {
  const content = await readStoredJson(output.storageKey);
  const parsed = JSON.parse(content);
  if (!isPlainRecord(parsed)) throw new ApiError(400, `爬虫输出不是有效 JSON object：${output.name}`);
  return parsed;
}

async function persistCrawlerJob(prisma: any, job: any) {
  await prisma.crawlerJob.update({
    where: { id: job.id },
    data: {
      status: job.status,
      input: toJson(job.input),
      command: job.command,
      logs: toJson(job.logs ?? []),
      outputs: toJson(job.outputs ?? []),
      errorMessage: job.errorMessage ?? null,
      exitCode: job.exitCode ?? null,
      finishedAt: job.finishedAt ? new Date(job.finishedAt) : null
    }
  }).catch(() => null);
}

async function markStaleCrawlerJobs(deps: CrawlerModuleDeps, appVersionId: string) {
  const staleDate = new Date(Date.now() - crawlerStaleMs);
  await deps.prisma.crawlerJob.updateMany({
    where: {
      appVersionId,
      status: "running",
      updatedAt: { lt: staleDate }
    },
    data: {
      status: "failed",
      errorMessage: "任务长时间没有更新，可能是开发服务器重启、进程被终止，或网络/PDF 下载中断。请重新启动任务。",
      finishedAt: new Date()
    }
  }).catch(() => null);
}

async function listCrawlerJobs(deps: CrawlerModuleDeps, appVersionId: string) {
  await markStaleCrawlerJobs(deps, appVersionId);
  const jobs = await deps.prisma.crawlerJob.findMany({
    where: { appVersionId },
    orderBy: { startedAt: "desc" },
    take: 50
  });
  return jobs.map(serializeCrawlerJob);
}

async function importCrawlerOutputsForJob(deps: CrawlerModuleDeps, job: any, outputs: any[], admin: any) {
  const action = job.input?.databaseAction ?? "download_only";
  if (!["create_pending", "approve_import"].includes(action)) return [];
  const imports = [];
  for (const output of outputs) {
    try {
      const payload = await payloadFromStoredCrawlerOutput(output);
      const name = `${job.name} · ${output.name}`;
      const created = await deps.courseImportWorkflow.createBatchFromPayload({
        payload,
        name,
        admin,
        duplicateMode: action === "approve_import" ? "reject_pending" : "block"
      });
      let approved = null;
      if (action === "approve_import") {
        approved = await deps.courseImportWorkflow.approveBatch(created.batch.id, admin);
      }
      imports.push({
        outputName: output.name,
        batchId: created.batch.id,
        datasetId: created.dataset.id,
        status: approved ? "approved" : "pending",
        summary: created.summary,
        approvalResult: approved?.result ?? null
      });
    } catch (error) {
      imports.push({
        outputName: output.name,
        status: "failed",
        error: error instanceof Error ? error.message : "导入失败"
      });
    }
  }
  return imports;
}

async function startCrawlerJob(deps: CrawlerModuleDeps, body: Record<string, unknown>, admin: any) {
  const input = normalizeCrawlerJobInput(body, deps.defaults);
  if (!["programme_handbook", "course_catalog"].includes(input.target)) {
    throw new ApiError(400, "当前 BNBU crawler 只支持 programme_handbook 和 course_catalog；class schedule 不是课程存在依据。");
  }
  const runtime = await assertCrawlerRuntimeReady(input.target);
  const script = runtime.runnerPath;
  if (!script) throw new ApiError(500, `没有找到 BNBU crawler runner：${input.target}。请确认 scripts/bnbu-crawler 已部署。`, undefined, runtime);

  await mkdir(crawlerOutputDir, { recursive: true });
  const appVersionId = await deps.getActiveAppVersionId();
  const jobName = input.name || defaultCrawlerJobName(input);
  const startedAt = new Date().toISOString();
  const createdJob = await deps.prisma.crawlerJob.create({
    data: {
      appVersionId,
      name: jobName,
      target: input.target,
      status: "running",
      input: toJson(input),
      command: null,
      logs: toJson([`Starting ${input.target} crawl at ${startedAt}\n`]),
      outputs: toJson([]),
      createdByUserId: admin.id
    }
  });
  const jobOutDir = input.outputMode === "git_import_json"
    ? staticBnbuImportDir
    : jobScopedCrawlerOutputDir(crawlerOutputDir, createdJob.id);
  await mkdir(jobOutDir, { recursive: true });
  const beforeOutputs = input.outputMode === "git_import_json" ? await listCrawlerOutputs([jobOutDir]) : [];
  const args = [script];
  if (input.target === "course_catalog") {
    args.push(
      `--courseDescriptionsUrl=${input.courseDescriptionsUrl}`,
      `--limit=${input.limit}`,
      `--semesterCode=${input.semesterCode}`,
      `--semesterName=${input.semesterName}`,
      `--academicYear=${input.academicYear}`,
      `--term=${input.term}`,
      `--outDir=${jobOutDir}`
    );
  } else {
    args.push(
      `--handbookUrl=${input.handbookUrl}`,
      `--cohorts=${input.cohorts.join(",")}`,
      `--limit=${input.limit}`,
      `--semesterCode=${input.semesterCode}`,
      `--semesterName=${input.semesterName}`,
      `--academicYear=${input.academicYear}`,
      `--term=${input.term}`,
      `--outDir=${jobOutDir}`
    );
    if (input.programmes) args.push(`--programmes=${input.programmes}`);
    if (input.facultyCodes) args.push(`--facultyCodes=${input.facultyCodes}`);
    if (input.programmeName) args.push(`--programmeName=${input.programmeName}`);
    if (input.facultyName) args.push(`--facultyName=${input.facultyName}`);
  }
  const command = ["node", ...args].map((item) => (item.includes(" ") ? JSON.stringify(item) : item)).join(" ");
  await deps.prisma.crawlerJob.update({ where: { id: createdJob.id }, data: { command } });
  const job: any = {
    id: createdJob.id,
    name: jobName,
    input,
    status: "running",
    target: input.target,
    command,
    logs: [`Starting ${input.target} crawl at ${startedAt}\n`],
    startedAt: createdJob.startedAt.toISOString(),
    finishedAt: null,
    exitCode: null,
    errorMessage: null,
    outputs: [],
    imports: []
  };
  crawlerJobs.set(createdJob.id, job);
  const child = spawn(process.execPath, args, { cwd: /*turbopackIgnore: true*/ process.cwd(), env: process.env });
  child.stdout.on("data", (chunk) => {
    job.logs.push(chunk.toString());
    void persistCrawlerJob(deps.prisma, job);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    job.logs.push(text);
    job.errorMessage = crawlerErrorSummary(text, job.errorMessage) || job.errorMessage;
    void persistCrawlerJob(deps.prisma, job);
  });
  child.on("error", (error) => {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.errorMessage = error.message;
    job.logs.push(`\n${error.stack || error.message}\n`);
    void persistCrawlerJob(deps.prisma, job);
  });
  child.on("close", async (code) => {
    job.exitCode = code;
    job.status = code === 0 ? "completed" : "failed";
    job.finishedAt = new Date().toISOString();
    const allOutputs = await listCrawlerOutputs([jobOutDir]);
    job.outputs = input.outputMode === "git_import_json" ? crawlerOutputsChangedAfter(beforeOutputs, allOutputs) : allOutputs;
    if (code === 0 && input.outputMode === "git_import_json" && !job.outputs.length) {
      job.outputs = allOutputs.filter((file) => input.target === "course_catalog"
        ? file.name.includes("course-catalog") || file.name.includes("course-descriptions-catalog")
        : input.cohorts.length
          ? input.cohorts.some((cohort: string) => file.name.includes(`-${cohort}-`))
          : /^bnbu-\d{4}-admission-handbook\.teamaking\.json$/.test(file.name));
    }
    job.outputs = job.outputs.map((output: any) => ({ ...output, jobId: input.outputMode === "git_import_json" ? output.jobId : job.id }));
    if (code !== 0 && !job.errorMessage) {
      job.errorMessage = crawlerErrorSummary((job.logs ?? []).join(""), `Crawler exited with code ${code}`);
    }
    if (code === 0) {
      job.imports = await importCrawlerOutputsForJob(deps, job, job.outputs, admin);
      job.outputs = job.outputs.map((output: any) => ({
        ...output,
        importResult: job.imports.find((item: any) => item.outputName === output.name) ?? null
      }));
      const failedImport = job.imports.find((item: any) => item.status === "failed");
      if (failedImport) {
        job.status = "failed";
        job.errorMessage = failedImport.error;
      }
    }
    job.logs.push(`\nFinished with exit code ${code} at ${job.finishedAt}\n`);
    if (job.imports?.length) {
      job.logs.push(`Crawler import actions: ${JSON.stringify(job.imports.map((item: any) => ({ outputName: item.outputName, status: item.status, batchId: item.batchId, error: item.error })), null, 2)}\n`);
    }
    await persistCrawlerJob(deps.prisma, job);
    await deps.operationLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "crawler.jobs.finish",
      targetType: "CrawlerJob",
      targetId: job.id,
      status: job.status === "completed" ? "success" : "failed",
      summary: { name: job.name, input, exitCode: code, errorMessage: job.errorMessage }
    });
  });
  await deps.operationLog({
    actorUserId: admin.id,
    actorRole: admin.role,
    action: "crawler.jobs.start",
    targetType: "CrawlerJob",
    targetId: job.id,
    summary: { name: job.name, input }
  });
  return serializeCrawlerJob({ ...createdJob, input, logs: job.logs, outputs: [], command, errorMessage: null, status: "running" });
}

export function createCrawlerModule(deps: CrawlerModuleDeps) {
  return async function handleCrawler(context: ApiContext) {
    const admin = await context.requireAdmin();
    const resource = context.path[1];
    const id = context.path[2];
    const action = context.path[3];

    if (context.method === "GET" && (!resource || resource === "options")) {
      const target = "programme_handbook";
      return ok({
        defaults: {
          name: "",
          target,
          handbookUrl: deps.defaults.handbookUrl,
          courseDescriptionsUrl: deps.defaults.courseDescriptionsUrl,
          cohorts: "",
          academicYear: deps.defaults.academicYear,
          term: deps.defaults.term,
          limit: "all"
        },
        targets: [
          {
            value: "programme_handbook",
            label: "Programme handbook",
            supported: true,
            description: "抓取某一年 admission handbook 页面，或从总入口按 admission year 找页面，输出 Course + admission-year Curriculum Rules。"
          },
          {
            value: "course_catalog",
            label: "Course catalog",
            supported: true,
            description: "抓取 Course Descriptions、University Core 和 General Education，合并成学校课程总表；不生成 admission-year Curriculum Rules。"
          }
        ],
        runtime: await crawlerRuntimeStatus(target),
        outputs: await listCrawlerOutputs()
      });
    }

    if (context.method === "GET" && resource === "jobs" && !id) {
      const appVersionId = await context.activeAppVersionId();
      return ok({
        jobs: await listCrawlerJobs(deps, appVersionId),
        outputs: await listCrawlerOutputs()
      });
    }

    if (context.method === "POST" && resource === "jobs") {
      const job = await startCrawlerJob(deps, await context.body(), admin);
      return created({ job, message: `已启动爬虫任务：${job.name}` });
    }

    if (context.method === "GET" && resource === "jobs" && id) {
      const appVersionId = await context.activeAppVersionId();
      await markStaleCrawlerJobs(deps, appVersionId);
      const job = await deps.prisma.crawlerJob.findUnique({ where: { id } });
      if (!job) throw new ApiError(404, "找不到这个爬虫任务。");
      if (action === "download") {
        const bundle = await crawlerJobBundle(job);
        return jsonDownloadResponse(bundle, crawlerJobBundleFilename(job));
      }
      return ok({ job: serializeCrawlerJob(job), outputs: await listCrawlerOutputs() });
    }

    if (context.method === "GET" && resource === "outputs") {
      if (id && action === "download") {
        const storageKey = Buffer.from(id, "base64url").toString("utf8");
        const content = await readStoredJson(storageKey);
        return new NextResponse(content, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="${storageKey.split(/[\\/]/).pop() ?? "crawler-output.json"}"`
          }
        });
      }
      return ok({ outputs: await listCrawlerOutputs() });
    }

    throw new ApiError(404, "找不到爬虫接口。");
  };
}
