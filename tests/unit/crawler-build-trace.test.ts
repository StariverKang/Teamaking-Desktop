import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("crawler build tracing", () => {
  it("keeps PDF parser assets in the Next tracing config", async () => {
    const config = await readFile(path.join(process.cwd(), "next.config.mjs"), "utf8");
    expect(config).toContain("scripts/bnbu-crawler");
    expect(config).toContain("node_modules/pdfjs-dist/package.json");
    expect(config).toContain("node_modules/@napi-rs/canvas");
    expect(config).toContain("node_modules/pdfjs-dist/node_modules/@napi-rs/canvas");
    expect(config).toContain("node_modules/pdfjs-dist/legacy/build/*.mjs");
    expect(config).toContain("node_modules/pdf-parse/package.json");
    expect(config).toContain("node_modules/pdf-parse/dist/**/*");
    expect(config).toContain("node_modules/pdf-parse/node_modules/pdfjs-dist/package.json");
  });

  it("loads pdfjs after installing Node DOMMatrix fallbacks", async () => {
    const globals = globalThis as Record<string, unknown>;
    const previous = {
      DOMMatrix: globals.DOMMatrix,
      ImageData: globals.ImageData,
      Path2D: globals.Path2D
    };

    try {
      delete globals.DOMMatrix;
      delete globals.ImageData;
      delete globals.Path2D;

      const runtime = await import(new URL("../../scripts/bnbu-crawler/pdfjs-runtime.mjs", import.meta.url).href);
      await expect(runtime.loadPdfjs()).resolves.toMatchObject({ getDocument: expect.any(Function) });
      expect(typeof globals.DOMMatrix).toBe("function");
      expect(typeof globals.ImageData).toBe("function");
      expect(typeof globals.Path2D).toBe("function");
    } finally {
      if (previous.DOMMatrix === undefined) delete globals.DOMMatrix;
      else globals.DOMMatrix = previous.DOMMatrix;
      if (previous.ImageData === undefined) delete globals.ImageData;
      else globals.ImageData = previous.ImageData;
      if (previous.Path2D === undefined) delete globals.Path2D;
      else globals.Path2D = previous.Path2D;
    }
  });

  it("keeps crawler runners from lingering after their final output is written", async () => {
    const runners = [
      "scripts/bnbu-crawler/run-handbook-preview.mjs",
      "scripts/bnbu-crawler/run-course-catalog.mjs"
    ];

    for (const runner of runners) {
      const source = await readFile(path.join(process.cwd(), runner), "utf8");
      expect(source).toContain("await doc.destroy()");
      expect(source).toContain("main().then(() => flushAndExit(0))");
    }
  });
});
