const DEFAULT_WEB_URL = "https://teamingapp.org";

function assertHttpUrl(name, value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must be an http(s) URL: ${value}`);
  }
  return url;
}

const webUrl = assertHttpUrl("TEAMAKING_WEB_URL", process.env.TEAMAKING_WEB_URL || DEFAULT_WEB_URL);
if (process.env.TEAMAKING_DESKTOP_ALLOWED_ORIGIN) {
  assertHttpUrl("TEAMAKING_DESKTOP_ALLOWED_ORIGIN", process.env.TEAMAKING_DESKTOP_ALLOWED_ORIGIN);
}

console.info(`TEAMAKING Desktop will load ${webUrl.toString()}`);
console.info("No local Next.js, SQLite, Prisma, crawler, seed, or backup runtime is packaged.");
