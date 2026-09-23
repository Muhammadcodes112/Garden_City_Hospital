"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import {
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Image as ImageIcon,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileText,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date";

type DocumentViewerProps = {
  token?: string;
  recordId?: string;
  formType?: string;
  filename?: string;
  expiresAt?: string;
  formDate?: string;
  initialPageCount?: number;
  isPublic?: boolean;
};

function ZoomControls({ scale }: { scale: number }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/90 p-1 text-white shadow-xl backdrop-blur">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
        onClick={() => zoomOut()}
        title="Zoom Out (−)"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="min-w-[42px] text-center font-mono text-xs font-semibold text-slate-200">
        {Math.round(scale * 100)}%
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
        onClick={() => zoomIn()}
        title="Zoom In (+)"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <div className="h-4 w-px bg-slate-700 mx-0.5" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
        onClick={() => resetTransform()}
        title="Fit Page"
      >
        <Maximize2 className="mr-1 h-3.5 w-3.5" /> Fit
      </Button>
    </div>
  );
}

function PageImageItem({
  imageUrlLow,
  imageUrlHigh,
  pageIndex,
  altText,
}: {
  imageUrlLow: string;
  imageUrlHigh: string;
  pageIndex: number;
  altText: string;
}) {
  const [highLoaded, setHighLoaded] = useState(false);

  return (
    <div className="relative w-full aspect-[210/297] rounded-sm bg-white shadow-2xl overflow-hidden">
      {/* Low-res preview (shows immediately while high-res loads) */}
      <img
        src={imageUrlLow}
        alt={`${altText} - Page ${pageIndex + 1}`}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
          highLoaded ? "opacity-0" : "opacity-100 filter blur-[1px]"
        }`}
      />
      {/* High-res image (deviceScaleFactor 3) */}
      <img
        src={imageUrlHigh}
        alt={`${altText} - Page ${pageIndex + 1}`}
        onLoad={() => setHighLoaded(true)}
        className={`relative h-full w-full object-contain transition-opacity duration-300 ${
          highLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

export function DocumentViewer({
  token,
  recordId,
  formType = "Form Document",
  filename = "Document.pdf",
  expiresAt,
  formDate,
  initialPageCount = 1,
  isPublic = true,
}: DocumentViewerProps) {
  const [pageCount, setPageCount] = useState(initialPageCount);
  const [loading, setLoading] = useState(true);

  const getFormTitle = (type?: string) => {
    if (type === "lab") return "Laboratory Request Form";
    if (type === "prescription") return "Prescription Form";
    if (type === "medical_report") return "Medical Report";
    return "Hospital Document";
  };

  const pdfUrl = isPublic && token ? `/api/share/${token}/pdf` : `/api/forms/${recordId}/pdf`;
  const getImageApi = (pIdx: number, res: "low" | "high") =>
    isPublic && token
      ? `/api/share/${token}/image?page=${pIdx}&res=${res}`
      : `/api/forms/${recordId}/pdf?html=1`; // Fallback for in-app

  useEffect(() => {
    // Fetch headers to determine real page count
    if (isPublic && token) {
      fetch(`/api/share/${token}/image?page=0&res=low`)
        .then((res) => {
          const countStr = res.headers.get("X-Page-Count");
          if (countStr) {
            const cnt = parseInt(countStr, 10);
            if (cnt > 0) setPageCount(cnt);
          }
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, isPublic]);

  const handleSaveImage = (pIdx: number) => {
    const imgUrl = isPublic && token
      ? `/api/share/${token}/image?page=${pIdx}&res=high`
      : `/api/forms/${recordId}/pdf?html=1`;
    const link = document.createElement("a");
    link.href = imgUrl;
    link.download = filename.replace(/\.pdf$/, `_Page${pIdx + 1}.png`);
    link.click();
  };

  const handlePrint = () => {
    window.open(`${pdfUrl}?download=0`, "_blank");
  };

  return (
    <div className="flex h-full min-h-screen w-full flex-col bg-slate-900 text-slate-100">
      {/* SLIM STICKY HEADER */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/brand/logo-mark-dark.svg"
            alt="Garden City Specialist Hospital"
            width={32}
            height={32}
            className="h-8 w-8 rounded bg-white/10 p-1 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate text-white">
              Garden City Specialist Hospital
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
              <span className="font-semibold text-emerald-400">{getFormTitle(formType)}</span>
              {formDate ? <span>· {formatDate(formDate)}</span> : null}
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex gap-1.5 border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5 text-slate-400" /> Print
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="hidden md:inline-flex gap-1.5 border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={() => handleSaveImage(0)}
          >
            <ImageIcon className="h-3.5 w-3.5 text-blue-400" /> Save Image
          </Button>
          <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
            <a href={`${pdfUrl}?download=1`} download={filename}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </a>
          </Button>
        </div>
      </header>

      {/* EXPIRY INFO BAR */}
      {expiresAt ? (
        <div className="bg-slate-800/80 text-slate-300 px-4 py-1.5 text-center text-xs flex items-center justify-center gap-1.5 border-b border-slate-700">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Verified Secure Link — Expires on <strong>{formatDate(expiresAt)}</strong></span>
        </div>
      ) : null}

      {/* DOCUMENT VIEWER MAIN CANVAS WITH ZOOM PAN PINCH */}
      <main className="relative flex-1 bg-slate-950 overflow-hidden flex flex-col items-center justify-center">
        <TransformWrapper
          initialScale={1}
          minScale={1}
          maxScale={5}
          centerOnInit={true}
          wheel={{ step: 0.1 }}
          doubleClick={{ mode: "toggle" }}
        >
          {({ state }) => (
            <>
              {/* Floating Zoom Bar */}
              <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                <ZoomControls scale={state.scale} />
              </div>

              {/* Floating Multi-page Indicator */}
              {pageCount > 1 ? (
                <div className="absolute top-4 right-4 z-20 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 text-xs font-semibold text-slate-300 backdrop-blur shadow-lg">
                  {pageCount} Pages
                </div>
              ) : null}

              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full flex items-center justify-center p-4 md:p-8"
              >
                <div className="w-full max-w-[850px] flex flex-col items-center gap-6 my-auto">
                  {loading ? (
                    <div className="w-full aspect-[210/297] rounded-sm bg-slate-900 animate-pulse border border-slate-800 flex items-center justify-center text-slate-600">
                      <FileText className="h-12 w-12 opacity-50" />
                    </div>
                  ) : (
                    Array.from({ length: pageCount }).map((_, pIdx) => (
                      <PageImageItem
                        key={pIdx}
                        imageUrlLow={getImageApi(pIdx, "low")}
                        imageUrlHigh={getImageApi(pIdx, "high")}
                        pageIndex={pIdx}
                        altText={getFormTitle(formType)}
                      />
                    ))
                  )}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 py-2.5 text-center text-[11px] text-slate-500 bg-slate-950">
        Garden City Specialist Hospital · No. 2 Sultan Road, U/Rimi G.R.A., Kaduna
      </footer>
    </div>
  );
}

export function ExpiredLinkCard() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md text-center space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          Link Expired or Unavailable
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          This shared document link has expired, been revoked, or is no longer valid.
        </p>
        <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
          Garden City Specialist Hospital · Kaduna, Nigeria
        </div>
      </div>
    </div>
  );
}
