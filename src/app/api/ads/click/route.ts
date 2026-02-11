import { NextRequest, NextResponse } from "next/server";
import { recordAdClick } from "@/lib/ads";

// POST /api/ads/click — Record an ad click
export async function POST(req: NextRequest) {
  try {
    const { adId } = await req.json();
    if (!adId) {
      return NextResponse.json({ error: "adId required" }, { status: 400 });
    }
    await recordAdClick(adId);
    return NextResponse.json({ recorded: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
