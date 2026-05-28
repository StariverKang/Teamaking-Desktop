import { describe, expect, it } from "vitest";
import { contentWriteApiError } from "@/lib/server/services/content-write-errors";

describe("content write error normalization", () => {
  it("turns duplicate content slugs into a 409 admin-facing error", () => {
    const error = contentWriteApiError({ code: "P2002", meta: { target: ["appVersionId", "kind", "slug"] } });

    expect(error?.status).toBe(409);
    expect(error?.message).toContain("slug 已经存在");
  });

  it("turns parent foreign key failures into a parent folder message", () => {
    const error = contentWriteApiError({ code: "P2003" });

    expect(error?.status).toBe(400);
    expect(error?.message).toContain("父级文件夹");
  });

  it("turns missing content table or columns into a migration hint", () => {
    for (const code of ["P2021", "P2022"]) {
      const error = contentWriteApiError({ code });
      expect(error?.status).toBe(500);
      expect(error?.message).toContain("prisma:migrate:deploy");
    }
  });
});
