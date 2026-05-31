import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function sqliteUrl(filePath) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

const port = await findFreePort();
const dataDir = process.env.TEAMAKING_DATA_DIR || path.join(root, ".desktop-data");
await mkdir(dataDir, { recursive: true });

const env = {
  ...process.env,
  TEAMAKING_RUNTIME: "desktop",
  AUTH_MODE: "local",
  TEAMAKING_DATA_DIR: dataDir,
  TEAMAKING_APP_ROOT: root,
  DATABASE_URL: process.env.DATABASE_URL || sqliteUrl(path.join(dataDir, "teamaking.db")),
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
  UPLOAD_STORAGE_MODE: "desktop",
  ENABLE_DEMO_ACCESS: "true",
  SESSION_COOKIE_DOMAIN: "",
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || "local.admin@teamaking.desktop",
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || "teamaking-local-admin",
  ADMIN_BOOTSTRAP_ROLE: process.env.ADMIN_BOOTSTRAP_ROLE || "super_admin",
  ADMIN_BOOTSTRAP_DISPLAY_NAME: process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || "TEAMAKING Local Admin"
};

await run(process.execPath, ["desktop/generate-sqlite-schema.mjs"], env);
await run(process.execPath, ["desktop/init-sqlite.cjs"], env);
await run(process.execPath, ["desktop/seed-desktop.cjs"], env);

const next = spawn("npx", ["next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

const electron = spawn("npx", ["electron", "."], {
  cwd: root,
  env: {
    ...env,
    TEAMAKING_DESKTOP_DEV_URL: `http://127.0.0.1:${port}`
  },
  stdio: "inherit",
  shell: process.platform === "win32"
});

function stop() {
  next.kill();
  electron.kill();
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

electron.on("close", (code) => {
  next.kill();
  process.exit(code ?? 0);
});
