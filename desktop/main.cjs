const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

let mainWindow = null;
let serverProcess = null;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unpackedAppPath() {
  const appPath = app.getAppPath();
  return app.isPackaged ? appPath.replace(/app\.asar$/, "app.asar.unpacked") : appPath;
}

function normalizeSqliteUrl(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return `file:${normalized}`;
}

function desktopDataDir() {
  return process.env.TEAMAKING_DATA_DIR || path.join(app.getPath("userData"), "Teamaking");
}

function baseEnv(port) {
  const dataDir = desktopDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const appRoot = app.isPackaged
    ? path.join(unpackedAppPath(), "desktop-dist", "server")
    : app.getAppPath();
  const databasePath = path.join(dataDir, "teamaking.db");
  return {
    ...process.env,
    NODE_ENV: "production",
    TEAMAKING_RUNTIME: "desktop",
    AUTH_MODE: "local",
    TEAMAKING_DATA_DIR: dataDir,
    TEAMAKING_APP_ROOT: appRoot,
    DATABASE_URL: process.env.DATABASE_URL || normalizeSqliteUrl(databasePath),
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    UPLOAD_STORAGE_MODE: "desktop",
    ENABLE_DEMO_ACCESS: "true",
    SESSION_COOKIE_DOMAIN: "",
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || "local.admin@teamaking.desktop",
    ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || "teamaking-local-admin",
    ADMIN_BOOTSTRAP_ROLE: process.env.ADMIN_BOOTSTRAP_ROLE || "super_admin",
    ADMIN_BOOTSTRAP_DISPLAY_NAME: process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || "TEAMAKING Local Admin"
  };
}

function electronAsNodeEnv(env) {
  return {
    ...env,
    ELECTRON_RUN_AS_NODE: "1"
  };
}

function spawnNodeScript(scriptPath, args, env, options = {}) {
  return spawn(process.execPath, [scriptPath, ...args], {
    cwd: env.TEAMAKING_APP_ROOT,
    env: electronAsNodeEnv(env),
    stdio: options.stdio || "pipe"
  });
}

function runNodeScript(scriptPath, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawnNodeScript(scriptPath, args, env);
    let stderr = "";
    child.stdout.on("data", (chunk) => console.info(chunk.toString().trimEnd()));
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      console.error(chunk.toString().trimEnd());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${scriptPath} exited with code ${code}`));
    });
  });
}

async function ensureDatabase(env) {
  const root = app.isPackaged ? unpackedAppPath() : app.getAppPath();
  const initScript = path.join(root, "desktop", "init-sqlite.cjs");
  if (!fs.existsSync(initScript)) {
    console.warn("SQLite init script is missing; skipping desktop database initialization.");
    return;
  }
  await runNodeScript(initScript, [], {
    ...env,
    TEAMAKING_APP_ROOT: root
  });
  const seedScript = path.join(root, "desktop", "seed-desktop.cjs");
  if (fs.existsSync(seedScript)) {
    await runNodeScript(seedScript, [], {
      ...env,
      TEAMAKING_APP_ROOT: root
    });
  }
}

async function waitForServer(url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Keep waiting while the local Next server boots.
    }
    await sleep(450);
  }
  throw new Error(`TEAMAKING local server did not become ready: ${url}`);
}

async function startServer(env) {
  if (process.env.TEAMAKING_DESKTOP_DEV_URL) {
    await waitForServer(`${process.env.TEAMAKING_DESKTOP_DEV_URL}/api/desktop/health`);
    return process.env.TEAMAKING_DESKTOP_DEV_URL;
  }

  const serverPath = path.join(env.TEAMAKING_APP_ROOT, "server.js");
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Missing Next standalone server: ${serverPath}`);
  }
  serverProcess = spawnNodeScript(serverPath, [], env, { stdio: "pipe" });
  serverProcess.stdout.on("data", (chunk) => console.info(`[next] ${chunk.toString().trimEnd()}`));
  serverProcess.stderr.on("data", (chunk) => console.error(`[next] ${chunk.toString().trimEnd()}`));
  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) console.error(`TEAMAKING server exited with code ${code}`);
  });
  const url = `http://127.0.0.1:${env.PORT}`;
  await waitForServer(`${url}/api/desktop/health`);
  return url;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "TEAMAKING Desktop",
    backgroundColor: "#f2ecdf",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    shell.openExternal(nextUrl);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, nextUrl) => {
    const currentOrigin = new URL(url).origin;
    const nextOrigin = new URL(nextUrl).origin;
    if (nextOrigin !== currentOrigin) {
      event.preventDefault();
      shell.openExternal(nextUrl);
    }
  });
  mainWindow.loadURL(url);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});

app.whenReady().then(async () => {
  const port = await findFreePort();
  const env = baseEnv(port);
  process.env.TEAMAKING_RUNTIME = env.TEAMAKING_RUNTIME;
  process.env.AUTH_MODE = env.AUTH_MODE;
  process.env.TEAMAKING_DATA_DIR = env.TEAMAKING_DATA_DIR;
  process.env.DATABASE_URL = env.DATABASE_URL;

  await ensureDatabase(env);
  const url = await startServer(env);
  createWindow(url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
}).catch((error) => {
  console.error(error);
  app.quit();
});
