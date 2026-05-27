import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("crawler build tracing", () => {
  it("keeps PDF parser assets in the Next tracing config", async () => {
    const config = await readFile(path.join(process.cwd(), "next.config.mjs"), "utf8");
    expect(config).toContain("scripts/bnbu-crawler");
    expect(config).toContain("node_modules/pdfjs-dist/package.json");
    expect(config).toContain("node_modules/pdfjs-dist/legacy/build/*.mjs");
    expect(config).toContain("node_modules/pdf-parse/package.json");
    expect(config).toContain("node_modules/pdf-parse/dist/**/*");
    expect(config).toContain("node_modules/pdf-parse/node_modules/pdfjs-dist/package.json");
  });
});
