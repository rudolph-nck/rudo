import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createUploadUrl, validateUpload } from "@/lib/media";
import { z } from "zod";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().positive(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = uploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid upload params" },
        { status: 400 }
      );
    }

    const validation = validateUpload(parsed.data.contentType, parsed.data.size);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const result = await createUploadUrl({
      fileName: parsed.data.fileName,
      contentType: parsed.data.contentType,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Upload URL error:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to create upload URL" },
      { status: 500 }
    );
  }
}
