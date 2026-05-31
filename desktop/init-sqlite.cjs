const fs = require("node:fs");
const path = require("node:path");

function sqlitePathFromUrl(url) {
  if (!url?.startsWith("file:")) {
    throw new Error("TEAMAKING Desktop requires a SQLite DATABASE_URL beginning with file:");
  }
  const raw = url.slice("file:".length);
  return path.resolve(raw);
}

function databasePath() {
  const dataDir = process.env.TEAMAKING_DATA_DIR || path.join(process.cwd(), ".desktop-data");
  fs.mkdirSync(dataDir, { recursive: true });
  return sqlitePathFromUrl(process.env.DATABASE_URL || `file:${path.join(dataDir, "teamaking.db")}`);
}

function schemaPath() {
  const explicit = process.env.TEAMAKING_SQLITE_SCHEMA;
  if (explicit) return explicit;
  const root = process.env.TEAMAKING_APP_ROOT || process.cwd();
  const candidates = [
    path.join(root, "desktop", "sqlite-schema.sql"),
    path.join(process.cwd(), "desktop", "sqlite-schema.sql")
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Missing desktop/sqlite-schema.sql. Run node desktop/generate-sqlite-schema.mjs first.");
  return found;
}

function initWithNodeSqlite(dbPath, sqlPath) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'AppVersion'").get();
    if (!existing) {
      db.exec(fs.readFileSync(sqlPath, "utf8"));
      console.info(`Initialized TEAMAKING Desktop SQLite database at ${dbPath}`);
    }
  } finally {
    db.close();
  }
}

const dbPath = databasePath();
const sqlPath = schemaPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
initWithNodeSqlite(dbPath, sqlPath);
