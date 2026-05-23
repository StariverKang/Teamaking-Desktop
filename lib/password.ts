import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";
const PREFIX = "pbkdf2_sha256";

export function assertStrongPassword(password: string) {
  if (password.length < 8) {
    throw new Error("密码至少需要 8 位。");
  }
}

export function hashPassword(password: string) {
  assertStrongPassword(password);
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${PREFIX}$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return false;

  const [prefix, iterationsText, salt, hash] = storedHash.split("$");
  if (prefix !== PREFIX || !iterationsText || !salt || !hash) return false;

  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const actual = Buffer.from(hash, "hex");
  const expected = pbkdf2Sync(password, salt, iterations, actual.length, DIGEST);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
