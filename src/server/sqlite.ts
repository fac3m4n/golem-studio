import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const DB_FILE = join(DATA_DIR, "app.db");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_FILE);

// bootstrap
db.exec(`
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',  -- default blue-500
  created_at INTEGER NOT NULL
);
`);

// one-time migration if upgrading an old DB (safe to run; will error only once)
try {
  db.exec(
    `ALTER TABLE collections ADD COLUMN color TEXT NOT NULL DEFAULT '#3b82f6';`
  );
} catch {}
