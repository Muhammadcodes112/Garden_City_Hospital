import { NextResponse } from "next/server";
import { getPublicShareData } from "@/lib/actions/share";
import { renderPdf } from "@/lib/pdf";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";

  const shareData = await getPublicShareData(token);
  if (!shareData.valid || !shareData.html) {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 404 });
  }

  const pdf = await renderPdf(shareData.html);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${shareData.filename || "HospitalDocument.pdf"}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
