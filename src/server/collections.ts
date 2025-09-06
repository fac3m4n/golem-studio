import { randomUUID } from "crypto";
import { db } from "./sqlite";

export type Collection = {
  id: string;
  name: string;
  color: string; // hex string
  createdAt: number; // epoch ms
};

export function listCollections(): Collection[] {
  const stmt = db.prepare(`
    SELECT id, name, color, created_at AS createdAt
    FROM collections
    ORDER BY created_at DESC
  `);
  return stmt.all() as Collection[];
}

export function createCollection(name: string, color: string): Collection {
  const id = randomUUID();
  const now = Date.now();
  const insert = db.prepare(`
    INSERT INTO collections (id, name, color, created_at)
    VALUES (?, ?, ?, ?)
  `);
  insert.run(id, name, color, now);
  return { id, name, color, createdAt: now };
}

export function deleteCollection(id: string) {
  db.prepare(`DELETE FROM collections WHERE id = ?`).run(id);
  return { ok: true };
}
