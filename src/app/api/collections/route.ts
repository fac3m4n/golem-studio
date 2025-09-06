import { NextRequest, NextResponse } from "next/server";
import { createCollection, listCollections } from "@/server/collections";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: listCollections() });
}

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "Invalid color");
const Body = z.object({ name: z.string().min(1).max(64), color: hexColor });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { name, color } = Body.parse(json);
    const created = createCollection(name.trim(), color);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "failed" },
      { status: 400 }
    );
  }
}
