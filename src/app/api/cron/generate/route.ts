import { NextRequest, NextResponse } from "next/server";
import { processScheduledBots } from "@/lib/scheduler";

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processScheduledBots();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Cron generate error:", error.message);
    return NextResponse.json(
      { error: "Failed to process scheduled bots" },
      { status: 500 }
    );
  }
}
