import { describe, expect, it } from "vitest";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("database-backed beta hardening contracts", () => {
  it("uses an isolated TEST_DATABASE_URL for integration coverage", () => {
    expect(process.env.TEST_DATABASE_URL).toContain("postgres");
  });
});

describe.skipIf(hasTestDatabase)("database-backed beta hardening contracts", () => {
  it("documents the missing integration database instead of touching development data", () => {
    expect(process.env.TEST_DATABASE_URL).toBeUndefined();
  });
});
