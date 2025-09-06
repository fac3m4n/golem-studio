import { NextRequest, NextResponse } from "next/server";
import { createCollection, listCollections } from "@/server/collections";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ items: listCollections() });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "failed" },
      { status: 500 }
    );
  }
}

const Body = z.object({ name: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { name } = Body.parse(json);
    const created = createCollection(name.trim());
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "failed" },
      { status: 400 }
    );
  }
}
