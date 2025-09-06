import { listCollections } from "./collections";
import { queryEntities } from "./entities";
import { getCurrentBlockFromRpc } from "./chain"; // you already added it for expiry bars

type ByCollection = { name: string; color: string; count: number };
type RecentItem = {
  entityKey: `0x${string}`;
  collection?: string;
  version?: number;
  value: any;
  expiresAtBlock?: number;
};

export async function getDashboardSummary() {
  // collections from SQLite
  const cols = listCollections(); // [{id,name,color,createdAt}, ...]

  // head block (for expiry in "soon")
  let head = 0;
  try {
    head = await getCurrentBlockFromRpc();
  } catch {}

  // naive aggregate: query per collection (limit for perf)
  const perCol: ByCollection[] = [];
  const recent: RecentItem[] = [];

  // tweakable caps for hackathon
  const PER_COLLECTION_LIMIT = 200;
  const RECENT_LIMIT = 30;

  // fetch per-collection in parallel
  await Promise.all(
    cols.map(async (c) => {
      const items = await queryEntities({
        collection: c.name,
        q: 'app = "studio"', // scope to Studio-created
        includeMeta: true,
        limit: PER_COLLECTION_LIMIT,
      });
      perCol.push({ name: c.name, color: c.color, count: items.length });
      // grab a few "recent-ish" from the sample
      for (const it of items.slice(0, 5)) {
        recent.push({
          entityKey: it.entityKey,
          collection:
            it.annotations.strings["collection"] ?? it.value?.meta?.collection,
          version: it.annotations.numbers["version"] ?? it.value?.meta?.version,
          value: it.value,
          expiresAtBlock: it.expiresAtBlock,
        });
      }
    })
  );

  // sort per-collection by count desc
  perCol.sort((a, b) => b.count - a.count);

  // compute totals
  const totalEntities = perCol.reduce((s, c) => s + c.count, 0);
  const totalCollections = cols.length;

  // compute "expiring soon" (<= 300 blocks ~≤ 10 minutes)
  const SOON = 300;
  const expiringSoon = recent.filter(
    (x) =>
      typeof x.expiresAtBlock === "number" &&
      head &&
      x.expiresAtBlock! - head <= SOON
  ).length;

  // trim recent to RECENT_LIMIT and de-dupe by key
  const seen = new Set<string>();
  const recentUnique = recent
    .filter((r) => {
      if (seen.has(r.entityKey)) return false;
      seen.add(r.entityKey);
      return true;
    })
    .slice(0, RECENT_LIMIT);

  return {
    headBlock: head,
    totals: { totalEntities, totalCollections, expiringSoon },
    byCollection: perCol,
    recent: recentUnique,
  };
}
