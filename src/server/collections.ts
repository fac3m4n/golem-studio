import { randomUUID } from "crypto";
import { db } from "./sqlite";

export type Collection = {
  id: string;
  name: string;
  createdAt: number; // epoch ms
};

export function listCollections(): Collection[] {
  const stmt = db.prepare(
    `SELECT id, name, created_at AS createdAt FROM collections ORDER BY created_at DESC`
  );
  return stmt.all() as Collection[];
}

export function createCollection(name: string): Collection {
  const id = randomUUID();
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO collections (id, name, created_at) VALUES (?, ?, ?)`
  );
  insert.run(id, name, now);
  return { id, name, createdAt: now };
}

export function deleteCollection(id: string) {
  const del = db.prepare(`DELETE FROM collections WHERE id = ?`);
  del.run(id);
  return { ok: true };
}
