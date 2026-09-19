import { NextResponse } from "next/server";
import { getPublicShareData } from "@/lib/actions/share";
import { renderPdf } from "@/lib/pdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const wantsHtml = url.searchParams.get("html") === "1";

  const shareData = await getPublicShareData(token);
  if (!shareData.valid || !shareData.html) {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 404 });
  }

  if (wantsHtml) {
    return new NextResponse(shareData.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  try {
    const pdf = await renderPdf(shareData.html);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${shareData.filename || "HospitalDocument.pdf"}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Failed to render PDF for share link:", err);
    const printHtml = shareData.html + `<script>window.addEventListener('load', () => window.print());</script>`;
    return new NextResponse(printHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${(shareData.filename || "HospitalDocument.pdf").replace(/\.pdf$/, ".html")}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
}
