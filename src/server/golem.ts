// Server-only Golem DB client factory (Kaolin testnet by default)
import { createClient, AccountData, Tagged } from "golem-base-sdk";
import { Buffer } from "buffer";

// ---- env (keep it dependency-free) ----
const must = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
};

const CHAIN_ID = Number(must("GB_CHAIN_ID")); // e.g. 60138453025 (Kaolin)
const RPC_URL = must("GB_RPC_URL"); // https://kaolin.holesky.golemdb.io/rpc
const WS_URL = must("GB_WS_URL"); // wss://kaolin.holesky.golemdb.io/rpc/ws
const PRIV_HEX = must("GB_PRIVATE_KEY"); // hex without 0x (server-side only)

let _client: Awaited<ReturnType<typeof createClient>> | null = null;

/**
 * Get a singleton Golem DB client (server-side).
 */
export async function getGolemClient() {
  if (_client) return _client;
  const key: AccountData = new Tagged(
    "privatekey",
    Buffer.from(PRIV_HEX, "hex")
  );
  _client = await createClient(CHAIN_ID, key, RPC_URL, WS_URL);
  return _client;
}

// Shared text encoder/decoder for payloads
export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

// Some helpful constants for Studio
export const DEFAULT_COLLECTION = "entities"; // keep consistent across queries
export const BLOCK_SECONDS = 2; // ~2s/block on Kaolin
