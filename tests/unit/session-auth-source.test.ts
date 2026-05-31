import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  userFindUnique: vi.fn(),
  userFromMobileAuthorization: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
  headers: mocks.headers
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique
    }
  }
}));

vi.mock("@/lib/server/services/mobile-auth-service", () => ({
  isMobileAccessAuthorization: (authorization: string | null) => authorization?.toLowerCase().startsWith("bearer tma1.") ?? false,
  userFromMobileAuthorization: mocks.userFromMobileAuthorization
}));

import { getCurrentUser, SESSION_COOKIE } from "@/lib/session";

describe("session auth source selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to web cookies when Authorization is unrelated to TEAMAKING mobile tokens", async () => {
    const webUser = { id: "web-user" };
    mocks.headers.mockResolvedValueOnce({ get: () => "Basic unrelated" });
    mocks.cookies.mockResolvedValueOnce({ get: (name: string) => name === SESSION_COOKIE ? { value: "web-user" } : undefined });
    mocks.userFindUnique.mockResolvedValueOnce(webUser);

    await expect(getCurrentUser()).resolves.toBe(webUser);
    expect(mocks.userFromMobileAuthorization).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "web-user" } }));
  });

  it("uses mobile bearer auth when a TEAMAKING mobile access token is present", async () => {
    const mobileUser = { id: "mobile-user" };
    mocks.headers.mockResolvedValueOnce({ get: () => "Bearer tma1.payload.signature" });
    mocks.userFromMobileAuthorization.mockResolvedValueOnce(mobileUser);

    await expect(getCurrentUser()).resolves.toBe(mobileUser);
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });
});
