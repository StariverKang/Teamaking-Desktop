import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = process.env.TEAMAKING_DATA_DIR || path.join(root, ".desktop-data");
await mkdir(dataDir, { recursive: true });

const env = {
  ...process.env,
  TEAMAKING_RUNTIME: process.env.TEAMAKING_RUNTIME || "desktop",
  AUTH_MODE: process.env.AUTH_MODE || "local",
  TEAMAKING_DATA_DIR: dataDir,
  TEAMAKING_APP_ROOT: process.env.TEAMAKING_APP_ROOT || root,
  DATABASE_URL: process.env.DATABASE_URL || `file:${path.join(dataDir, "teamaking.db").replace(/\\/g, "/")}`
};

const child = spawn("npx", ["prisma", ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("close", (code) => process.exit(code ?? 0));
