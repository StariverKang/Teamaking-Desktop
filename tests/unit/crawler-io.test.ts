import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { crawlerErrorSummary } from "@/lib/server/crawler/errors";
import {
  crawlerOutputsChangedAfter,
  defaultCrawlerJobName,
  jobScopedCrawlerOutputDir,
  normalizeCrawlerJobInput,
  parseCrawlerInstruction
} from "@/lib/server/crawler/io";
import { crawlerRuntimeStatus, resolvePdfjsDistPackage } from "@/lib/server/crawler/runtime";
import { crawlerOutputDir, listCrawlerOutputs, readStoredJson } from "@/lib/server/storage/json-files";

const defaults = {
  handbookUrl: "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm",
  courseDescriptionsUrl: "https://ar.bnbu.edu.cn/info/1021/1430.htm",
  academicYear: "2026",
  term: "Spring"
};

describe("crawler input normalization", () => {
  it("extracts target, years, term, limit, and programme codes from natural language", () => {
    const instruction = "抓 2025 Fall 的 ACCT MCOM programme handbook limit 2 https://ar.bnbu.edu.cn/info/1020/2051.htm";
    expect(parseCrawlerInstruction(instruction)).toMatchObject({
      target: "programme_handbook",
      handbookUrl: "https://ar.bnbu.edu.cn/info/1020/2051.htm",
      cohorts: "",
      programmes: "ACCT,MCOM",
      limit: "2",
      academicYear: "2025",
      term: "Fall"
    });
  });

  it("keeps explicit form fields ahead of natural-language hints", () => {
    const input = normalizeCrawlerJobInput({
      instruction: "抓 2025 Fall ACCT limit 2",
      cohorts: "2024,2023",
      academicYear: "2026",
      term: "Spring",
      limit: "all",
      databaseAction: "approve_import"
    }, defaults);

    expect(input).toMatchObject({
      target: "programme_handbook",
      cohorts: ["2024", "2023"],
      academicYear: "2026",
      term: "Spring",
      limit: "all",
      databaseAction: "approve_import",
      semesterCode: "2026-Spring",
      semesterName: "2026 Spring"
    });
  });

  it("uses job-scoped download directories", () => {
    expect(jobScopedCrawlerOutputDir("/tmp/teamaking/crawler_outputs", "job_123"))
      .toBe(path.join("/tmp/teamaking/crawler_outputs", "job_123"));
  });

  it("does not mix failed or historical outputs into an isolated job result", () => {
    const before = [{ storageKey: "storage/crawler_outputs/old.json", modifiedAt: "2026-01-01T00:00:00.000Z" }];
    const after = [
      { storageKey: "storage/crawler_outputs/old.json", modifiedAt: "2026-01-01T00:00:00.000Z" },
      { storageKey: "storage/crawler_outputs/job_123/new.json", modifiedAt: "2026-01-02T00:00:00.000Z" }
    ];
    expect(crawlerOutputsChangedAfter(before, after)).toEqual([after[1]]);
  });

  it("names course catalog and programme-handbook jobs predictably", () => {
    expect(defaultCrawlerJobName({ target: "course_catalog", cohorts: [] })).toBe("BNBU course descriptions catalogue");
    expect(defaultCrawlerJobName({ target: "programme_handbook", cohorts: ["2025", "2024"] })).toBe("2025, 2024 admission programme handbook");
  });

  it("summarizes crawler stderr with the useful error line instead of the Node version", () => {
    const stderr = [
      "node:internal/modules/package_json_reader:301",
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pdfjs-dist' imported from /var/task/scripts/bnbu-crawler/run-handbook-preview.mjs",
      "",
      "Node.js v24.14.1"
    ].join("\n");
    expect(crawlerErrorSummary(stderr)).toBe("Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pdfjs-dist' imported from /var/task/scripts/bnbu-crawler/run-handbook-preview.mjs");
  });

  it("lists crawler outputs recursively and annotates job scoped files", async () => {
    const jobId = `unit-${Date.now()}`;
    const dir = path.join(crawlerOutputDir, jobId, "nested");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "bnbu-2025-admission-handbook.teamaking.json"), "{}\n", "utf8");
    try {
      const outputs = await listCrawlerOutputs([path.join(crawlerOutputDir, jobId)]);
      expect(outputs).toEqual([
        expect.objectContaining({
          name: "bnbu-2025-admission-handbook.teamaking.json",
          jobId
        })
      ]);
    } finally {
      await rm(path.join(crawlerOutputDir, jobId), { recursive: true, force: true });
    }
  });

  it("blocks stored JSON reads outside allowed roots", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "teamaking-json-root-"));
    const allowedFile = path.join(dir, "allowed.json");
    const outsideFile = path.join(os.tmpdir(), `teamaking-outside-${Date.now()}.json`);
    await writeFile(allowedFile, "{\"ok\":true}\n", "utf8");
    await writeFile(outsideFile, "{}\n", "utf8");
    try {
      expect(await readStoredJson(allowedFile, [dir])).toContain("\"ok\"");
      await expect(readStoredJson(outsideFile, [dir])).rejects.toMatchObject({ status: 403 });
    } finally {
      await rm(dir, { recursive: true, force: true });
      await rm(outsideFile, { force: true });
    }
  });

  it("can resolve pdfjs-dist for crawler runtime checks", async () => {
    expect(resolvePdfjsDistPackage()).toContain("pdfjs-dist");
    await expect(crawlerRuntimeStatus("programme_handbook")).resolves.toMatchObject({
      target: "programme_handbook",
      pdfjsDist: expect.objectContaining({ required: true, ok: true })
    });
  });
});
