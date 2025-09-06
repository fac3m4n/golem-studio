import { NextRequest, NextResponse } from "next/server";
import { createEntity, queryEntities } from "@/server/entities";

// Avoid caching API responses during dev/demo
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? undefined; // optional
    const q = url.searchParams.get("q") ?? undefined; // optional raw query
    const limit = Number(url.searchParams.get("limit") ?? 100);

    const items = await queryEntities({ type, q, limit });
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("GET /api/entities failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // { type: string, data: any, btl?: number, extra?: Record<string,string|number> }

    if (!body?.type) {
      return NextResponse.json(
        { error: "Field 'type' is required." },
        { status: 400 }
      );
    }

    const out = await createEntity({
      type: body.type,
      data: body.data ?? {},
      btl: body.btl,
      extra: body.extra,
    });

    return NextResponse.json(out);
  } catch (err: any) {
    console.error("POST /api/entities failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
