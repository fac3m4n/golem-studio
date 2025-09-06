import { Annotation, GolemBaseCreate, GolemBaseUpdate } from "golem-base-sdk";
import { randomUUID } from "crypto";
import { getGolemClient, encoder, decoder, DEFAULT_COLLECTION } from "./golem";

export type EntityRow = {
  entityKey: `0x${string}`;
  value: any;
  annotations: {
    strings: Record<string, string>;
    numbers: Record<string, number>;
  };
  expiresAtBlock?: number;
};

type CreateInput = {
  type: string; // e.g. "note" | "ticket" | ...
  data: unknown; // JSON-serializable
  btl?: number; // blocks-to-live (TTL). ~2s per block
  extra?: Record<string, string | number>; // additional annotations for querying
};

type QueryInput = {
  type?: string;
  q?: string; // raw condition e.g. `version > 0 && id = "..."` (be careful)
  limit?: number; // client-side slice for now
  includeMeta?: boolean;
};

type UpdateInput = {
  entityKey: `0x${string}`;
  data: unknown;
  btl?: number;
  id: string; // keep id annotation stable
  type?: string; // (optional) update type annotation
  version?: number; // bump version (numeric)
};

function bytesToString(x: unknown) {
  if (typeof x === "string") return x;
  // Node Buffer or Uint8Array from SDK
  if (x && typeof x === "object" && "byteLength" in (x as any)) {
    return decoder.decode(x as Uint8Array);
  }
  try {
    return String(x ?? "");
  } catch {
    return "";
  }
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function mergeMeta(row: EntityRow, meta: any | null): EntityRow {
  if (!meta) return row;

  const strings = { ...row.annotations.strings };
  const numbers = { ...row.annotations.numbers };

  // bring over annotations from meta
  if (Array.isArray(meta.stringAnnotations)) {
    for (const a of meta.stringAnnotations) strings[a.key] = a.value;
  }
  if (Array.isArray(meta.numericAnnotations)) {
    for (const a of meta.numericAnnotations) numbers[a.key] = Number(a.value);
  }

  return {
    ...row,
    annotations: { strings, numbers },
    expiresAtBlock:
      typeof meta.expiresAtBlock === "number"
        ? meta.expiresAtBlock
        : row.expiresAtBlock,
  };
}

/**
 * Normalize SDK entity to Studio row.
 */
function toRow(e: any): EntityRow {
  const stringAnns = Array.isArray(e.stringAnnotations)
    ? e.stringAnnotations
    : [];
  const numericAnns = Array.isArray(e.numericAnnotations)
    ? e.numericAnnotations
    : [];

  const strings = Object.fromEntries(
    stringAnns.map((a: any) => [a.key, a.value])
  );
  const numbers = Object.fromEntries(
    numericAnns.map((a: any) => [a.key, a.value])
  );

  const raw = bytesToString(e.storageValue);
  return {
    entityKey: e.entityKey as `0x${string}`,
    value: safeJsonParse(raw),
    annotations: { strings, numbers },
  };
}

/**
 * Create a single entity.
 */
export async function createEntity(input: CreateInput) {
  const client = await getGolemClient();

  const id = randomUUID();

  const stringAnnotations = [
    new Annotation("collection", DEFAULT_COLLECTION),
    new Annotation("type", input.type),
    new Annotation("id", id),
  ];
  const numericAnnotations = [new Annotation("version", 1)];

  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) {
      if (typeof v === "number") numericAnnotations.push(new Annotation(k, v));
      else stringAnnotations.push(new Annotation(k, String(v)));
    }
  }

  const creates: GolemBaseCreate[] = [
    {
      data: encoder.encode(JSON.stringify(input.data ?? {})),
      btl: input.btl ?? 1200, // ~40 minutes
      stringAnnotations,
      numericAnnotations,
    },
  ];

  const receipt = await client.createEntities(creates);
  return { id, receipt };
}

/**
 * Query entities (annotation conditions).
 * Always enforces collection = "entities".
 * Example q: `id = "..." && version >= 2`
 */
export async function queryEntities({
  type,
  q,
  limit = 100,
  includeMeta = true,
}: QueryInput): Promise<EntityRow[]> {
  const client = await getGolemClient();

  const parts: string[] = [`collection = "${DEFAULT_COLLECTION}"`];
  if (type) parts.push(`type = "${type}"`);
  if (q) parts.push(q);

  const where = parts.join(" && ");
  const list = await client.queryEntities(where);
  const arr = Array.isArray(list) ? list : [];

  const baseRows = arr.slice(0, limit).map(toRow);

  if (!includeMeta || baseRows.length === 0) return baseRows;

  // Fetch metadata for each entityKey (in parallel, with safety)
  const metas = await Promise.all(
    baseRows.map((r) => client.getEntityMetaData(r.entityKey).catch(() => null))
  );

  return baseRows.map((row, i) => mergeMeta(row, metas[i]));
}

/**
 * Update an entity entirely (payload, annotations, BTL).
 * IMPORTANT: update replaces annotations; we re-assert base ones.
 */
export async function updateEntity(input: UpdateInput) {
  const client = await getGolemClient();

  const stringAnnotations = [
    new Annotation("collection", DEFAULT_COLLECTION),
    new Annotation("id", input.id),
  ];
  if (input.type) stringAnnotations.push(new Annotation("type", input.type));

  const numericAnnotations = [];
  if (typeof input.version === "number") {
    numericAnnotations.push(new Annotation("version", input.version));
  }

  const updates: GolemBaseUpdate[] = [
    {
      entityKey: input.entityKey,
      data: encoder.encode(JSON.stringify(input.data ?? {})),
      btl: input.btl ?? 1200,
      stringAnnotations,
      numericAnnotations,
    },
  ];

  const receipt = await client.updateEntities(updates);
  return { receipt };
}

/**
 * Delete an entity by entityKey (hex hash).
 */
export async function deleteEntity(entityKey: `0x${string}`) {
  const client = await getGolemClient();
  const receipt = await client.deleteEntities([entityKey]);
  return { receipt };
}
