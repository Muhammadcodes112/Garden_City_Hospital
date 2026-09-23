import { NextResponse } from "next/server";
import { getPublicShareData } from "@/lib/actions/share";
import { renderFormPageImage } from "@/lib/pdf-page-renderer";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "0";
  const resParam = url.searchParams.get("res") === "low" ? "low" : "high";
  const pageIndex = Math.max(0, parseInt(pageStr, 10) || 0);

  const shareData = await getPublicShareData(token);
  if (!shareData.valid || !shareData.html || !shareData.recordId) {
    return NextResponse.json({ error: "Link expired, revoked, or invalid" }, { status: 404 });
  }

  try {
    const { buffer, pageCount } = await renderFormPageImage({
      html: shareData.html,
      recordId: shareData.recordId,
      updatedAt: shareData.updatedAt || new Date().toISOString(),
      pageIndex,
      resolution: resParam,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Page-Count": `${pageCount}`,
      },
    });
  } catch (err) {
    console.error("Failed to render page image:", err);
    return NextResponse.json({ error: "Failed to render image" }, { status: 500 });
  }
}
