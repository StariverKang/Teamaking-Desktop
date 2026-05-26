import { describe, expect, it } from "vitest";
import {
  extractReadableText,
  fileExtensionOf,
  hasAcceptableMimeForExtension,
  isAllowedProfileFile,
  parseResumeText,
  isRiskyProfileFile,
  safeUploadName
} from "@/lib/profile-assets";

describe("profile upload safety checks", () => {
  it("keeps allowed educational/profile files and rejects risky executables", () => {
    expect(isAllowedProfileFile("portfolio.pdf")).toBe(true);
    expect(isAllowedProfileFile("archive.zip")).toBe(true);
    expect(isRiskyProfileFile("install.exe")).toBe(true);
  });

  it("checks obvious MIME/extension mismatches", () => {
    expect(hasAcceptableMimeForExtension("proof.pdf", "application/pdf")).toBe(true);
    expect(hasAcceptableMimeForExtension("proof.pdf", "image/png")).toBe(false);
    expect(hasAcceptableMimeForExtension("notes.txt", "text/plain")).toBe(true);
  });

  it("normalizes upload names", () => {
    const safe = safeUploadName("My Proof File.PDF");
    expect(fileExtensionOf(safe)).toBe("pdf");
    expect(safe).toMatch(/^my-proof-file-\d+\.pdf$/);
  });

  it("extracts spreadsheet text for xlsx and csv uploads", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const xlsxBuffer = Buffer.from(zipSync({
      "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
          <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        </Types>`),
      "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
        </Relationships>`),
      "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets><sheet name="Proof" sheetId="1" r:id="rId1"/></sheets>
        </workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        </Relationships>`),
      "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1"><c r="A1" t="inlineStr"><is><t>Skill</t></is></c><c r="B1" t="inlineStr"><is><t>Evidence</t></is></c></row>
            <row r="2"><c r="A2" t="inlineStr"><is><t>SQL</t></is></c><c r="B2" t="inlineStr"><is><t>course project</t></is></c></row>
          </sheetData>
        </worksheet>`)
    }));

    await expect(extractReadableText("proof.xlsx", xlsxBuffer)).resolves.toContain("SQL | course project");
    await expect(extractReadableText("proof.csv", Buffer.from("Skill,Evidence\nPython,demo\n"))).resolves.toContain("Python | demo");
  });

  it("extracts pptx text and keeps a legacy ppt fallback", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const pptxBuffer = Buffer.from(zipSync({
      "ppt/slides/slide1.xml": strToU8("<p:sld><a:t>Campaign pitch</a:t><a:t>user insight</a:t></p:sld>")
    }));

    await expect(extractReadableText("deck.pptx", pptxBuffer)).resolves.toContain("Campaign pitch");
    await expect(extractReadableText("legacy.ppt", Buffer.from("Legacy PowerPoint text block for presentation evidence"))).resolves.toContain("Legacy PowerPoint");
  });

  it("keeps complete internship lines before generic highlight matches", () => {
    const parsed = parseResumeText(`
      实习经历
      新腾（珠海）体育文化发展有限公司 格盛一号项目 新媒体运营 2025.09-2025.10
      项目背景：“格盛一号”作为新腾体育旗下的旗舰级体育文化综合体，旨在打造区域性的体育+商业地标。
      本项目（新媒体项目）的核心目标是通过数字化阵地建设，构建从线上内容触达（流量层）到线下场馆转化（交易层）的 O2O 闭环。
      用户增长：根据旅行项目内容，设计宣发海报，用于美团、携程等平台上的产品主页信息。
      达人合作：建联 10+ KOL 合作产出推广视频，并跟进内容发布效果。
      数据复盘：整理平台曝光、收藏、咨询和转化数据，形成运营复盘。
      内容协作：协助公众号长文、选图、排版和封面制作。
      项目经历
      校园活动策划 demo
    `, "resume.txt");

    expect(parsed.sections.experience.items).toEqual(expect.arrayContaining([
      expect.stringContaining("O2O 闭环"),
      expect.stringContaining("达人合作"),
      expect.stringContaining("数据复盘"),
      expect.stringContaining("内容协作")
    ]));
    expect(parsed.highlights).toEqual(expect.arrayContaining([
      expect.stringContaining("新媒体运营"),
      expect.stringContaining("O2O 闭环"),
      expect.stringContaining("数据复盘")
    ]));
  });
});
