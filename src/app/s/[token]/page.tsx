import Image from "next/image";
import { Download, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicShareData } from "@/lib/actions/share";
import { formatDate } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function PublicSharePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const data = await getPublicShareData(token);

  if (!data.valid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
        <div className="w-full max-w-md text-center space-y-4 rounded-xl border border-border bg-card p-8 shadow-lg">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            This link is no longer available
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This shared document link has expired, been revoked, or is invalid.
          </p>
          <div className="pt-4 border-t border-border text-xs text-muted-foreground">
            Garden City Specialist Hospital · Kaduna, Nigeria
          </div>
        </div>
      </div>
    );
  }

  const pdfUrl = `/api/share/${token}/pdf`;
  const downloadUrl = `${pdfUrl}?download=1`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/logo-mark.png"
              alt="Garden City Specialist Hospital"
              width={36}
              height={36}
              className="h-9 w-9 rounded bg-white/10 p-1"
            />
            <div>
              <h1 className="text-sm font-bold tracking-wide text-white">
                GARDEN CITY SPECIALIST HOSPITAL
              </h1>
              <p className="text-[11px] text-slate-400">Official Patient Record</p>
            </div>
          </div>
          <Button asChild size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
            <a href={downloadUrl} download={data.filename || "Document.pdf"}>
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </Button>
        </div>
      </header>

      {/* EXPIRY INFO BAR */}
      {data.expiresAt ? (
        <div className="bg-slate-800/80 text-slate-300 px-4 py-1.5 text-center text-xs flex items-center justify-center gap-1.5 border-b border-slate-700">
          <Clock className="h-3.5 w-3.5 text-emerald-400" />
          <span>Secure shared link — expires on <strong>{formatDate(data.expiresAt)}</strong></span>
        </div>
      ) : null}

      {/* DOCUMENT PREVIEW CONTAINER */}
      <main className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-5xl h-[80vh] rounded-lg border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
          <iframe
            title="Public Document View"
            src={pdfUrl}
            className="w-full h-full border-0"
          />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 py-3 text-center text-xs text-slate-500">
        No. 2 Sultan Road, U/Rimi G.R.A., Kaduna · Tel: 0807 237 2888
      </footer>
    </div>
  );
}
