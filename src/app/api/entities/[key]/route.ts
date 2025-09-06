import { NextRequest, NextResponse } from "next/server";
import { deleteEntity, updateEntity } from "@/server/entities";

export const dynamic = "force-dynamic";

// PATCH /api/entities/:key
// Body: { data: any, btl?: number, id: string, collection?: string, version?: number }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const key = params.key as `0x${string}`;
    const body = await req.json();

    if (!body?.id) {
      return NextResponse.json(
        { error: "Field 'id' (annotation) is required to update the entity." },
        { status: 400 }
      );
    }

    const res = await updateEntity({
      entityKey: key,
      id: body.id,
      collection: body.collection,
      version: body.version,
      btl: body.btl,
      data: body.data ?? {},
    });

    return NextResponse.json(res);
  } catch (err: any) {
    console.error(`PATCH /api/entities/${params.key} failed:`, err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/entities/:key
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const key = params.key as `0x${string}`;
    const res = await deleteEntity(key);
    return NextResponse.json(res);
  } catch (err: any) {
    console.error(`DELETE /api/entities/${params.key} failed:`, err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
