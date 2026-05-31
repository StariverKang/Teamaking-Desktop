import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = process.env.TEAMAKING_DATA_DIR || path.join(root, ".desktop-data");
await mkdir(dataDir, { recursive: true });

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || `file:${path.join(dataDir, "teamaking.db").replace(/\\/g, "/")}`
};

const sql = await new Promise((resolve, reject) => {
  const child = spawn("npx", [
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script"
  ], {
    cwd: root,
    env,
    shell: process.platform === "win32"
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code === 0) resolve(stdout);
    else reject(new Error(stderr || `prisma migrate diff exited with code ${code}`));
  });
});

await writeFile(path.join(__dirname, "sqlite-schema.sql"), `${sql.trim()}\n`, "utf8");
console.info("Generated desktop/sqlite-schema.sql");
