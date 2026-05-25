import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { getActiveAppVersionId } from "../lib/app-version";

const adminRoles = new Set(["course_moderator", "school_admin", "super_admin"]);

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function requireArg(name: string) {
  const value = arg(name).trim();
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function recordLocalCredential(email: string, role: string, password?: string) {
  if (!hasFlag("record-local")) return;
  const docsDir = path.join(process.cwd(), "docs");
  await mkdir(docsDir, { recursive: true });
  const lines = [
    `\n## ${email}`,
    `- role: ${role}`,
    `- updatedAt: ${new Date().toISOString()}`,
    password ? `- password: ${password}` : "- password: reset externally"
  ];
  await appendFile(path.join(docsDir, "admin-credentials.local.md"), `${lines.join("\n")}\n`, "utf8");
}

async function listAdmins() {
  const appVersionId = await getActiveAppVersionId();
  const users = await prisma.user.findMany({
    where: { appVersionId, role: { in: [...adminRoles] } },
    include: { profile: true },
    orderBy: { createdAt: "desc" }
  });
  console.table(users.map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    displayName: user.profile?.displayName ?? ""
  })));
}

async function createAdmin() {
  const appVersionId = await getActiveAppVersionId();
  const email = requireArg("email").toLowerCase();
  const password = requireArg("password");
  const role = arg("role") || "school_admin";
  const displayName = arg("display-name") || email.split("@")[0];
  if (!adminRoles.has(role)) throw new Error(`Invalid admin role: ${role}`);

  const user = await prisma.user.upsert({
    where: { appVersionId_email: { appVersionId, email } },
    update: {
      passwordHash: hashPassword(password),
      role,
      status: "active",
      suspendedUntil: null,
      isEmailVerified: true,
      onboardingCompleted: true
    },
    create: {
      appVersionId,
      email,
      passwordHash: hashPassword(password),
      role,
      status: "active",
      isEmailVerified: true,
      onboardingCompleted: true
    }
  });
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: { displayName },
    create: { userId: user.id, displayName }
  });
  await recordLocalCredential(email, role, password);
  console.log(`Admin ready: ${email} (${role})`);
}

async function resetPassword() {
  const appVersionId = await getActiveAppVersionId();
  const email = requireArg("email").toLowerCase();
  const password = requireArg("password");
  const role = arg("role");
  if (role && !adminRoles.has(role)) throw new Error(`Invalid admin role: ${role}`);
  const user = await prisma.user.update({
    where: { appVersionId_email: { appVersionId, email } },
    data: {
      passwordHash: hashPassword(password),
      ...(role ? { role } : {}),
      status: "active",
      suspendedUntil: null,
      isEmailVerified: true,
      onboardingCompleted: true
    }
  });
  await recordLocalCredential(email, role || user.role, password);
  console.log(`Admin password reset: ${email}`);
}

async function main() {
  const command = process.argv[2] ?? "list";
  if (command === "list") return listAdmins();
  if (command === "create") return createAdmin();
  if (command === "reset") return resetPassword();
  throw new Error(`Unknown command: ${command}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
