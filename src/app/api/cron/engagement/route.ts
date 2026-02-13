import { NextRequest, NextResponse } from "next/server";
import { updateEngagementScores } from "@/lib/recommendation";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await updateEngagementScores();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Engagement score update error:", error.message);
    return NextResponse.json(
      { error: "Failed to update engagement scores" },
      { status: 500 }
    );
  }
}
