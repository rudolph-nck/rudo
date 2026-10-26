import { NextRequest, NextResponse } from "next/server";
import { getGuide } from "@/lib/project-builder/guides";
import { renderGuide } from "@/lib/project-builder/render";
import { PB_COOKIE, verifySessionToken } from "@/lib/project-builder/session";

// Guides are served as complete HTML documents (hand-built or engine-rendered),
// behind the Project Builder login (middleware checks too; this is the second gate).
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

  const html = await renderGuide(guide);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
