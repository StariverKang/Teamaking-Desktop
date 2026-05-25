import { describe, expect, it } from "vitest";
import {
  fileExtensionOf,
  hasAcceptableMimeForExtension,
  isAllowedProfileFile,
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
});
