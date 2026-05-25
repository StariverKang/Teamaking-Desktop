import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorCodeForStatus } from "@/lib/error-codes";
import { ApiError } from "@/lib/http";

describe("stable API error codes", () => {
  it("maps common HTTP statuses to stable codes", () => {
    expect(errorCodeForStatus(400)).toBe(ERROR_CODES.API_BAD_REQUEST);
    expect(errorCodeForStatus(401)).toBe(ERROR_CODES.API_UNAUTHORIZED);
    expect(errorCodeForStatus(403)).toBe(ERROR_CODES.API_FORBIDDEN);
    expect(errorCodeForStatus(404)).toBe(ERROR_CODES.API_NOT_FOUND);
    expect(errorCodeForStatus(429)).toBe(ERROR_CODES.API_RATE_LIMITED);
    expect(errorCodeForStatus(500)).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
  });

  it("allows routes to pin specific operational codes", () => {
    const error = new ApiError(429, "cooldown", ERROR_CODES.AUTH_VERIFICATION_COOLDOWN);
    expect(error.status).toBe(429);
    expect(error.errorCode).toBe(ERROR_CODES.AUTH_VERIFICATION_COOLDOWN);
  });
});
