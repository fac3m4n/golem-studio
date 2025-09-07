import { NextRequest, NextResponse } from "next/server";
import { createEntitiesBatch } from "@/server/entities";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // { collection, items, btl?, extra?, chunkSize? }
    if (!body?.collection) {
      return NextResponse.json(
        { error: "Field 'collection' is required." },
        { status: 400 }
      );
    }
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Provide non-empty 'items' array." },
        { status: 400 }
      );
    }
    // guard large imports a bit
    if (body.items.length > 1000) {
      return NextResponse.json(
        { error: "Max 1000 items per batch for demo." },
        { status: 400 }
      );
    }

    const out = await createEntitiesBatch({
      collection: body.collection,
      items: body.items,
      btl: body.btl,
      extra: body.extra,
      chunkSize: body.chunkSize,
    });

    return NextResponse.json(out);
  } catch (e: any) {
    console.error("POST /api/entities/batch failed:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
