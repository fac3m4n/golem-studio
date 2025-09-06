import { NextResponse } from "next/server";
import { deleteCollection } from "@/server/collections";

export const dynamic = "force-dynamic";

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const out = deleteCollection(params.id);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "failed" },
      { status: 400 }
    );
  }
}
