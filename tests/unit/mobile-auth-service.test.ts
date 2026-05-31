import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mobileSessionCreate: vi.fn(),
  mobileSessionFindFirst: vi.fn(),
  mobileSessionFindUnique: vi.fn(),
  mobileSessionUpdate: vi.fn(),
  mobileSessionUpdateMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mobileSession: {
      create: mocks.mobileSessionCreate,
      findFirst: mocks.mobileSessionFindFirst,
      findUnique: mocks.mobileSessionFindUnique,
      update: mocks.mobileSessionUpdate,
      updateMany: mocks.mobileSessionUpdateMany
    },
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      mobileSession: {
        create: mocks.mobileSessionCreate,
        update: mocks.mobileSessionUpdate
      }
    })
  }
}));

vi.mock("@/lib/server/services/user-service", () => ({
  userInclude: { profile: true, contactInfo: true }
}));

import {
  createMobileSession,
  isMobileAccessAuthorization,
  revokeMobileSession,
  rotateMobileSession,
  userFromMobileAuthorization
} from "@/lib/server/services/mobile-auth-service";

const expiresAt = new Date("2026-07-01T00:00:00Z");
const user = { id: "user-1", email: "student@mail.bnbu.edu.cn", role: "student" };

describe("mobile auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOBILE_AUTH_SECRET = "test-mobile-secret";
  });

  it("creates a mobile session with signed access token and hashed refresh token", async () => {
    mocks.mobileSessionCreate.mockResolvedValueOnce({ id: "session-1", expiresAt });

    const tokens = await createMobileSession("user-1", {
      deviceName: "Pixel 8",
      devicePlatform: "android",
      userAgent: "Expo"
    });

    expect(tokens.accessToken).toMatch(/^tma1\./);
    expect(tokens.refreshToken).toMatch(/^tmr1_/);
    expect(tokens.sessionId).toBe("session-1");
    expect(mocks.mobileSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user-1",
        deviceName: "Pixel 8",
        devicePlatform: "android",
        userAgent: "Expo"
      })
    }));
    const savedHash = mocks.mobileSessionCreate.mock.calls[0][0].data.refreshTokenHash;
    expect(savedHash).not.toBe(tokens.refreshToken);
    expect(savedHash).toHaveLength(64);
  });

  it("rotates refresh tokens and revokes the previous session", async () => {
    mocks.mobileSessionFindUnique.mockResolvedValueOnce({
      id: "old-session",
      userId: "user-1",
      deviceName: "Pixel 8",
      devicePlatform: "android",
      userAgent: "Old Expo",
      expiresAt,
      revokedAt: null,
      user
    });
    mocks.mobileSessionCreate.mockResolvedValueOnce({ id: "new-session", expiresAt });

    const result = await rotateMobileSession("tmr1_previous", { userAgent: "New Expo" });

    expect(result.user).toBe(user);
    expect(result.tokens.refreshToken).toMatch(/^tmr1_/);
    expect(result.tokens.sessionId).toBe("new-session");
    expect(mocks.mobileSessionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "old-session" },
      data: expect.objectContaining({ revokedAt: expect.any(Date), lastUsedAt: expect.any(Date) })
    }));
    expect(mocks.mobileSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user-1",
        deviceName: "Pixel 8",
        devicePlatform: "android",
        userAgent: "New Expo"
      })
    }));
  });

  it("loads the user from a valid bearer access token and active session", async () => {
    mocks.mobileSessionCreate.mockResolvedValueOnce({ id: "session-1", expiresAt });
    const tokens = await createMobileSession("user-1");
    mocks.mobileSessionFindFirst.mockResolvedValueOnce({ id: "session-1", user });

    const loadedUser = await userFromMobileAuthorization(`Bearer ${tokens.accessToken}`);

    expect(loadedUser).toBe(user);
    expect(mocks.mobileSessionFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "session-1",
        userId: "user-1",
        revokedAt: null
      })
    }));
    expect(mocks.mobileSessionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "session-1" },
      data: { lastUsedAt: expect.any(Date) }
    }));
  });

  it("only treats TEAMAKING mobile access tokens as mobile authorization", () => {
    expect(isMobileAccessAuthorization("Bearer tma1.payload.signature")).toBe(true);
    expect(isMobileAccessAuthorization("bearer tma1.payload.signature")).toBe(true);
    expect(isMobileAccessAuthorization("Bearer abc.def.ghi")).toBe(false);
    expect(isMobileAccessAuthorization("Basic abc")).toBe(false);
    expect(isMobileAccessAuthorization(null)).toBe(false);
  });

  it("revokes a refresh token without storing the raw token", async () => {
    await revokeMobileSession("tmr1_previous");

    expect(mocks.mobileSessionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        refreshTokenHash: expect.not.stringContaining("tmr1_previous"),
        revokedAt: null
      }),
      data: expect.objectContaining({ revokedAt: expect.any(Date), lastUsedAt: expect.any(Date) })
    }));
  });
});
