import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/server/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardSummary();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "failed" },
      { status: 500 }
    );
  }
}
