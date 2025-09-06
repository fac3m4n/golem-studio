import { NextResponse } from "next/server";
import { getCurrentBlockFromRpc } from "@/server/chain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentBlock = await getCurrentBlockFromRpc();
    return NextResponse.json({ currentBlock, blockSeconds: 2 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "failed" },
      { status: 500 }
    );
  }
}
