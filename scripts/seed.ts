#!/usr/bin/env bun
/**
 * Seed script for Golem Studio (Collections + Entities)
 * Run:
 *   bun run scripts/seed.ts
 * Optional flags:
 *   --collections-only     only (up)sert collections in SQLite
 *   --entities-only        only create entities, do not touch collections
 *   --wipe-collections     delete all collections first (SQLite only)
 *   --count 120            total entities to create (default 80)
 */

import "dotenv/config";
import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { randomUUID, randomInt } from "crypto";
import { Buffer } from "buffer";
import {
  createClient,
  AccountData,
  Tagged,
  Annotation,
  GolemBaseCreate,
} from "golem-base-sdk";

// ---------- ENV ----------
function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
const CHAIN_ID = Number(must("GB_CHAIN_ID"));
const RPC_URL = must("GB_RPC_URL");
const WS_URL = must("GB_WS_URL");
const PRIV = must("GB_PRIVATE_KEY");

// ---------- SQLite ----------
const DATA_DIR = join(process.cwd(), "data");
const DB_FILE = join(DATA_DIR, "app.db");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_FILE);

db.exec(`
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at INTEGER NOT NULL
);
`);

type Collection = {
  id: string;
  name: string;
  color: string;
  created_at: number;
};

// ---------- Configurable presets ----------
const PRESET_COLLECTIONS: Array<{ name: string; color: string }> = [
  { name: "notes", color: "#3b82f6" }, // blue-500
  { name: "tickets", color: "#22c55e" }, // green-500
  { name: "posts", color: "#a855f7" }, // purple-500
  { name: "events", color: "#f97316" }, // orange-500
  { name: "alerts", color: "#ef4444" }, // red-500
];

// ---------- Flags ----------
const argv = new Map<string, string | boolean>();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const [k, v] = arg.split("=");
    argv.set(k, v ?? true);
  }
}
const ONLY_COLLECTIONS = argv.has("--collections-only");
const ONLY_ENTITIES = argv.has("--entities-only");
const WIPE_COLLECTIONS = argv.has("--wipe-collections");
const TOTAL_COUNT = Number(argv.get("--count") || 80);

// ---------- Golem client ----------
const key: AccountData = new Tagged("privatekey", Buffer.from(PRIV, "hex"));
const encoder = new TextEncoder();

async function getClient() {
  return await createClient(CHAIN_ID, key, RPC_URL, WS_URL);
}

// ---------- Upsert collections ----------
function upsertCollections(presets = PRESET_COLLECTIONS): Collection[] {
  if (WIPE_COLLECTIONS) db.exec(`DELETE FROM collections;`);

  const now = Date.now();
  const sel = db.prepare(
    `SELECT id, name, color, created_at FROM collections WHERE name = ? LIMIT 1`
  );
  const ins = db.prepare(
    `INSERT INTO collections (id, name, color, created_at) VALUES (?, ?, ?, ?)`
  );
  const upd = db.prepare(`UPDATE collections SET color = ? WHERE id = ?`);

  const out: Collection[] = [];

  for (const p of presets) {
    const row = sel.get(p.name) as Collection | undefined;
    if (row) {
      // keep id and created_at, refresh color if changed
      if (row.color !== p.color) upd.run(p.color, row.id);
      out.push({ ...row, color: p.color });
    } else {
      const id = randomUUID();
      ins.run(id, p.name, p.color, now);
      out.push({ id, name: p.name, color: p.color, created_at: now });
    }
  }

  return out;
}

// ---------- Seed entities ----------
type SeedPlan = Array<{ collection: string; count: number }>;

function makePlan(total: number, names: string[]): SeedPlan {
  // distribute total roughly evenly with some randomness
  const base = Math.floor(total / names.length);
  let rem = total - base * names.length;
  const plan: SeedPlan = names.map((n) => ({ collection: n, count: base }));
  while (rem-- > 0) plan[randomInt(0, plan.length)].count += 1;
  // shuffle for fun
  return plan.sort(() => Math.random() - 0.5);
}

function randomPayload(collection: string) {
  // a small variety per collection
  const t = Date.now();
  switch (collection) {
    case "notes":
      return {
        title: fakeSentence(),
        body: fakeParagraph(),
        tags: ["studio", "demo"],
        t,
      };
    case "tickets":
      return {
        subject: fakeSentence(),
        priority: pick([1, 2, 3, 4, 5]),
        open: pick([true, false]),
        t,
      };
    case "posts":
      return {
        author: pick(["Ada", "Linus", "Grace", "Alan"]),
        likes: randomInt(0, 500),
        t,
      };
    case "events":
      return {
        name: fakeSentence(),
        city: pick(["Warsaw", "Berlin", "NYC", "SF"]),
        attendees: randomInt(10, 300),
        t,
      };
    case "alerts":
      return {
        level: pick(["low", "medium", "high", "critical"]),
        message: fakeSentence(),
        t,
      };
    default:
      return { msg: "Hello Golem DB!", t };
  }
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length)];
}
function fakeSentence() {
  const nouns = [
    "network",
    "database",
    "query",
    "entity",
    "index",
    "block",
    "studio",
    "faucet",
    "wallet",
    "client",
  ];
  const verbs = [
    "boosts",
    "updates",
    "creates",
    "deletes",
    "extends",
    "queries",
    "indexes",
    "streams",
    "mirrors",
    "verifies",
  ];
  return `${pick(nouns)} ${pick(verbs)} ${pick(nouns)}`;
}
function fakeParagraph() {
  return `${fakeSentence()}. ${fakeSentence()}. ${fakeSentence()}.`;
}

async function createEntity(
  client: Awaited<ReturnType<typeof getClient>>,
  collection: string,
  btl: number
) {
  const id = randomUUID();
  const version = 1;
  const payload = {
    meta: { id, collection, version, app: "studio" },
    data: randomPayload(collection),
  };

  const creates: GolemBaseCreate[] = [
    {
      data: encoder.encode(JSON.stringify(payload)),
      btl,
      stringAnnotations: [
        new Annotation("collection", collection),
        new Annotation("app", "studio"),
        new Annotation("id", id),
      ],
      numericAnnotations: [new Annotation("version", version)],
    },
  ];

  const receipt = await client.createEntities(creates);
  const entityKey = receipt?.[0]?.entityKey;
  return { id, entityKey, receipt };
}

// ---------- Main ----------
(async () => {
  console.log("Seeding…");

  // collections
  const cols = ONLY_ENTITIES
    ? (db
        .prepare(`SELECT id, name, color, created_at FROM collections`)
        .all() as Collection[])
    : upsertCollections();
  console.log(`✔ Collections in SQLite: ${cols.length}`);
  cols.forEach((c) => console.log(`  - ${c.name} (${c.color})`));

  if (ONLY_COLLECTIONS) {
    console.log("Done (collections only).");
    process.exit(0);
  }

  // golem client
  const client = await getClient();

  // plan entities
  const plan = makePlan(
    TOTAL_COUNT,
    cols.map((c) => c.name)
  );

  // create: majority long-lived + some soon expiring
  // long-lived BTL ~ 2400 (~80 min), soon-expiring BTL ~ 220–320 (≈7–10 min)
  let created = 0;
  for (const p of plan) {
    const soonCount = Math.floor(p.count * 0.25); // 25% soon
    const longCount = p.count - soonCount;

    // long-lived
    for (let i = 0; i < longCount; i++) {
      const btl = randomInt(2000, 2600);
      const { entityKey } = await createEntity(client, p.collection, btl);
      created++;
      if (created % 10 === 0) console.log(`… ${created}/${TOTAL_COUNT}`);
    }
    // soon-expiring
    for (let i = 0; i < soonCount; i++) {
      const btl = randomInt(220, 320);
      const { entityKey } = await createEntity(client, p.collection, btl);
      created++;
      if (created % 10 === 0) console.log(`… ${created}/${TOTAL_COUNT}`);
    }
  }

  console.log(`✔ Seed complete. Entities created: ${created}`);
  console.log(
    "Tip: open the Dashboard — KPIs, bars, and 'expiring soon' should be populated."
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
