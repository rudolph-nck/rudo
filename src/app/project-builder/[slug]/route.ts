import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getGuide } from "@/lib/project-builder/guides";
import { PB_COOKIE, verifySessionToken } from "@/lib/project-builder/session";

// Guides are self-contained HTML documents served as-is, behind the
// Project Builder login (middleware checks too; this is the second gate).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!(await verifySessionToken(req.cookies.get(PB_COOKIE)?.value))) {
    const loginUrl = new URL("/project-builder/login", req.url);
    loginUrl.searchParams.set("next", `/project-builder/${slug}`);
    return NextResponse.redirect(loginUrl);
  }

  const guide = getGuide(slug);
  if (!guide) {
    return new NextResponse("Guide not found", { status: 404 });
  }

  const html = await readFile(
    path.join(process.cwd(), "src/content/project-builder", guide.file),
    "utf8"
  );

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
