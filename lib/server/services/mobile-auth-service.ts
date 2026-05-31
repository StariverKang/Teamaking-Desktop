import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { userInclude } from "@/lib/server/services/user-service";

const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlSeconds = 30 * 24 * 60 * 60;
const accessTokenPrefix = "tma1";
const refreshTokenPrefix = "tmr1";

type AccessTokenPayload = {
  type: "access";
  sub: string;
  sid: string;
  exp: number;
};

export type MobileSessionMetadata = {
  deviceName?: string;
  devicePlatform?: string;
  userAgent?: string | null;
};

function authSecret() {
  const configured = (process.env.MOBILE_AUTH_SECRET || process.env.SESSION_SECRET || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "teamaking-mobile-dev-secret";
  throw new ApiError(500, "移动端认证密钥未配置，请设置 MOBILE_AUTH_SECRET。");
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

export function isMobileAccessAuthorization(authorization: string | null) {
  return authorization?.toLowerCase().startsWith(`bearer ${accessTokenPrefix}.`) ?? false;
}

function refreshTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function signAccessToken(payload: AccessTokenPayload) {
  const encodedPayload = base64url(JSON.stringify(payload));
  return `${accessTokenPrefix}.${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyAccessToken(token: string): AccessTokenPayload | null {
  const [prefix, encodedPayload, signature] = token.split(".");
  if (prefix !== accessTokenPrefix || !encodedPayload || !signature) return null;
  if (!safeEqual(sign(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(decodeBase64url(encodedPayload)) as Partial<AccessTokenPayload>;
    if (payload.type !== "access" || !payload.sub || !payload.sid || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

function tokenPairFor(userId: string, sessionId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + accessTokenTtlSeconds;
  return {
    accessToken: signAccessToken({ type: "access", sub: userId, sid: sessionId, exp: expiresAt }),
    accessTokenExpiresAt: new Date(expiresAt * 1000).toISOString()
  };
}

export async function createMobileSession(userId: string, metadata: MobileSessionMetadata = {}) {
  const refreshToken = `${refreshTokenPrefix}_${randomBytes(32).toString("base64url")}`;
  const session = await prisma.mobileSession.create({
    data: {
      userId,
      refreshTokenHash: refreshTokenHash(refreshToken),
      deviceName: metadata.deviceName,
      devicePlatform: metadata.devicePlatform,
      userAgent: metadata.userAgent ?? undefined,
      expiresAt: new Date(Date.now() + refreshTokenTtlSeconds * 1000)
    }
  });

  return {
    ...tokenPairFor(userId, session.id),
    refreshToken,
    refreshTokenExpiresAt: session.expiresAt.toISOString(),
    sessionId: session.id
  };
}

export async function rotateMobileSession(refreshToken: string, metadata: MobileSessionMetadata = {}) {
  const now = new Date();
  const existing = await prisma.mobileSession.findUnique({
    where: { refreshTokenHash: refreshTokenHash(refreshToken) },
    include: { user: { include: userInclude } }
  });

  if (!existing || existing.revokedAt || existing.expiresAt <= now) {
    throw new ApiError(401, "移动端登录已过期，请重新登录。", ERROR_CODES.API_UNAUTHORIZED);
  }

  const nextRefreshToken = `${refreshTokenPrefix}_${randomBytes(32).toString("base64url")}`;
  const next = await prisma.$transaction(async (tx) => {
    await tx.mobileSession.update({
      where: { id: existing.id },
      data: { revokedAt: now, lastUsedAt: now }
    });
    return tx.mobileSession.create({
      data: {
        userId: existing.userId,
        refreshTokenHash: refreshTokenHash(nextRefreshToken),
        deviceName: metadata.deviceName ?? existing.deviceName,
        devicePlatform: metadata.devicePlatform ?? existing.devicePlatform,
        userAgent: metadata.userAgent ?? existing.userAgent,
        expiresAt: new Date(Date.now() + refreshTokenTtlSeconds * 1000)
      }
    });
  });

  return {
    user: existing.user,
    tokens: {
      ...tokenPairFor(existing.userId, next.id),
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: next.expiresAt.toISOString(),
      sessionId: next.id
    }
  };
}

export async function revokeMobileSession(refreshToken: string) {
  const hash = refreshTokenHash(refreshToken);
  await prisma.mobileSession.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date(), lastUsedAt: new Date() }
  });
}

export async function userFromMobileAuthorization(authorization: string | null) {
  if (!isMobileAccessAuthorization(authorization)) return null;
  const payload = verifyAccessToken((authorization ?? "").slice("bearer ".length).trim());
  if (!payload) return null;

  const session = await prisma.mobileSession.findFirst({
    where: {
      id: payload.sid,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { user: { include: userInclude } }
  });
  if (!session) return null;

  await prisma.mobileSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() }
  });
  return session.user;
}
