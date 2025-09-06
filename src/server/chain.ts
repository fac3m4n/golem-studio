export async function getCurrentBlockFromRpc(): Promise<number> {
  const rpcUrl = process.env.GB_RPC_URL!;
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    }),
    cache: "no-store",
  });
  const j = await r.json();
  // eth_blockNumber returns hex (e.g., "0x1234")
  const hex = j?.result ?? "0x0";
  return Number(BigInt(hex));
}
