const { contextBridge, ipcRenderer } = require("electron");

const DESKTOP_NOTIFICATION_CHANNEL = "teamaking:desktop-notification";
const NOTIFICATION_POLL_INTERVAL_MS = 60000;
const desktopNotificationTypes = new Set([
  "teamup_received",
  "teamup_feedback",
  "follow_received",
  "follow_accepted",
  "post_viewed",
  "profile_viewed"
]);

let pollerStarted = false;

function isWebsitePage() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function textValue(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function fallbackHrefForType(type) {
  if (type === "teamup_received" || type === "teamup_feedback") return "/connections?tab=teamup";
  if (type === "follow_received") return "/connections?tab=inbox";
  if (type === "follow_accepted") return "/connections?tab=friends";
  return "/settings";
}

function safeSameOriginHref(value, fallback) {
  try {
    const url = new URL(textValue(value, fallback), window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function normalizeNotification(notification) {
  if (!notification || typeof notification !== "object") return null;
  const type = textValue(notification.type);
  if (!desktopNotificationTypes.has(type)) return null;
  if (notification.desktopEligible === false || notification.emailPreferenceEnabled === false) return null;

  const fallbackHref = fallbackHrefForType(type);
  return {
    id: textValue(notification.id),
    type,
    title: textValue(notification.title, "TEAMAKING"),
    body: textValue(notification.body, "You have a new TEAMAKING reminder."),
    actionHref: safeSameOriginHref(notification.actionHref, fallbackHref),
    createdAt: textValue(notification.createdAt)
  };
}

async function pollNotifications() {
  if (!isWebsitePage()) return;
  try {
    const response = await fetch("/api/notifications", {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) return;

    const data = await response.json();
    const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
    for (const notification of [...notifications].reverse()) {
      const payload = normalizeNotification(notification);
      if (payload?.id) ipcRenderer.send(DESKTOP_NOTIFICATION_CHANNEL, payload);
    }
  } catch {
    // The website still owns inline reminders; native notification polling is best effort.
  }
}

function startNotificationPolling() {
  if (pollerStarted || !isWebsitePage()) return;
  pollerStarted = true;
  void pollNotifications();
  window.setInterval(() => {
    void pollNotifications();
  }, NOTIFICATION_POLL_INTERVAL_MS);
  window.addEventListener("teamaking:notifications-changed", () => {
    void pollNotifications();
  });
}

contextBridge.exposeInMainWorld("teamakingDesktop", {
  runtime: "online-shell",
  notifications: "system"
});

startNotificationPolling();
