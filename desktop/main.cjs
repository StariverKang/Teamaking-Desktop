const { app, BrowserWindow, Notification, ipcMain, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_WEB_URL = "https://teamingapp.org";
const APP_USER_MODEL_ID = "org.teamingapp.teamaking.desktop";
const DESKTOP_NOTIFICATION_CHANNEL = "teamaking:desktop-notification";
const blockedUserShellPaths = ["/admin", "/admin-login", "/crawler"];

let mainWindow = null;
let notificationBridgeRegistered = false;
const seenNotificationIds = new Set();

if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

function configuredWebUrl() {
  const raw = process.env.TEAMAKING_WEB_URL || DEFAULT_WEB_URL;
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`TEAMAKING_WEB_URL must be an http(s) URL: ${raw}`);
  }
  url.hash = "";
  return url;
}

function configuredAllowedOrigin(webUrl) {
  const raw = process.env.TEAMAKING_DESKTOP_ALLOWED_ORIGIN;
  if (!raw) return webUrl.origin;
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`TEAMAKING_DESKTOP_ALLOWED_ORIGIN must be an http(s) URL: ${raw}`);
  }
  return url.origin;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isSameOrigin(value, allowedOrigin) {
  try {
    return new URL(value).origin === allowedOrigin;
  } catch {
    return false;
  }
}

function isBlockedUserShellPath(value, allowedOrigin) {
  try {
    const url = new URL(value);
    if (url.origin !== allowedOrigin) return false;
    return blockedUserShellPaths.some((blockedPath) => {
      return url.pathname === blockedPath || url.pathname.startsWith(`${blockedPath}/`);
    });
  } catch {
    return false;
  }
}

function textValue(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function limitedText(value, fallback, maxLength) {
  const text = textValue(value, fallback);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function senderUrl(event) {
  return event.senderFrame?.url || event.sender.getURL();
}

function notificationTargetUrl(actionHref, allowedOrigin) {
  try {
    const url = new URL(textValue(actionHref, "/"), allowedOrigin);
    if (url.origin !== allowedOrigin) return null;
    if (isBlockedUserShellPath(url.toString(), allowedOrigin)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function focusAndLoad(targetUrl) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  void mainWindow.loadURL(targetUrl).catch((error) => {
    loadOfflinePage(targetUrl, error instanceof Error ? error.message : "The website could not be loaded.");
  });
}

function showDesktopNotification(payload, allowedOrigin) {
  if (!payload || typeof payload !== "object") return;
  const id = textValue(payload.id);
  if (!id || seenNotificationIds.has(id)) return;

  const targetUrl = notificationTargetUrl(payload.actionHref, allowedOrigin) || `${allowedOrigin}/`;
  seenNotificationIds.add(id);

  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: limitedText(payload.title, "TEAMAKING", 120),
    body: limitedText(payload.body, "You have a new TEAMAKING reminder.", 240),
    silent: false
  });

  notification.on("click", () => {
    focusAndLoad(targetUrl);
  });
  notification.show();
}

function registerDesktopNotificationBridge(allowedOrigin) {
  if (notificationBridgeRegistered) return;
  notificationBridgeRegistered = true;
  ipcMain.on(DESKTOP_NOTIFICATION_CHANNEL, (event, payload) => {
    if (!isSameOrigin(senderUrl(event), allowedOrigin)) return;
    showDesktopNotification(payload, allowedOrigin);
  });
}

function desktopMessageUrl({ mode, target, title, description }) {
  const url = pathToFileURL(path.join(__dirname, "offline.html"));
  url.searchParams.set("mode", mode);
  url.searchParams.set("target", target);
  url.searchParams.set("title", title);
  url.searchParams.set("description", description);
  return url.toString();
}

function loadOfflinePage(target, description = "TEAMAKING Desktop needs an internet connection to load the website.") {
  if (!mainWindow) return;
  void mainWindow.loadURL(desktopMessageUrl({
    mode: "offline",
    target,
    title: "TEAMAKING is offline",
    description
  }));
}

function loadBlockedPage(target) {
  if (!mainWindow) return;
  void mainWindow.loadURL(desktopMessageUrl({
    mode: "blocked",
    target,
    title: "This desktop app opens the user site only",
    description: "Admin and crawler workspaces are not available inside the TEAMAKING Desktop user app."
  }));
}

function createWindow() {
  const webUrl = configuredWebUrl();
  const allowedOrigin = configuredAllowedOrigin(webUrl);
  const initialUrl = isBlockedUserShellPath(webUrl.toString(), allowedOrigin)
    ? `${allowedOrigin}/`
    : webUrl.toString();

  registerDesktopNotificationBridge(allowedOrigin);

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isBlockedUserShellPath(url, allowedOrigin)) {
      loadBlockedPage(url);
      return { action: "deny" };
    }
    if (isSameOrigin(url, allowedOrigin)) {
      void mainWindow.loadURL(url);
      return { action: "deny" };
    }
    if (isHttpUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, nextUrl) => {
    if (!isHttpUrl(nextUrl)) return;
    if (isBlockedUserShellPath(nextUrl, allowedOrigin)) {
      event.preventDefault();
      loadBlockedPage(nextUrl);
      return;
    }
    if (!isSameOrigin(nextUrl, allowedOrigin)) {
      event.preventDefault();
      void shell.openExternal(nextUrl);
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    if (validatedUrl && !isHttpUrl(validatedUrl)) return;
    loadOfflinePage(validatedUrl || initialUrl, errorDescription);
  });

  void mainWindow.loadURL(initialUrl).catch((error) => {
    loadOfflinePage(initialUrl, error instanceof Error ? error.message : "The website could not be loaded.");
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  console.error(error);
  app.quit();
});
