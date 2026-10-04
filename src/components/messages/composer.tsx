"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { MessageAttachmentInput } from "@/lib/validators/message";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

type UploadResult = { fileUrl: string; fileName: string; fileSize: number; mimeType: string };

export function Composer({
  disabled,
  disabledReason,
  onSend,
  autoFocus,
}: {
  disabled?: boolean;
  disabledReason?: string;
  onSend: (body: string, attachment?: MessageAttachmentInput) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [upload, setUpload] = useState<{ fileName: string; progress: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || !isOnline || upload) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(autoGrow);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || isMobile) return;
    e.preventDefault();
    submit();
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only PDF, PNG, JPG, and WEBP files are allowed");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File is larger than 10MB");
      return;
    }

    setUpload({ fileName: file.name, progress: 0 });

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setUpload((u) => (u ? { ...u, progress: Math.round((ev.loaded / ev.total) * 100) } : u));
    };
    xhr.onload = () => {
      xhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText) as UploadResult;
        const body = value.trim();
        onSend(body, { kind: "file", fileUrl: result.fileUrl, fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType });
        setValue("");
        requestAnimationFrame(autoGrow);
      } else {
        const message = (() => {
          try {
            return (JSON.parse(xhr.responseText) as { error?: string }).error;
          } catch {
            return undefined;
          }
        })();
        toast.error(message || "Upload failed");
      }
      setUpload(null);
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      toast.error("Upload failed");
      setUpload(null);
    };
    xhr.onabort = () => {
      xhrRef.current = null;
      setUpload(null);
    };
    xhr.open("POST", "/api/messages/attachments/upload");
    xhr.send(formData);
  }

  function cancelUpload() {
    xhrRef.current?.abort();
  }

  if (disabled) {
    return (
      <div className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
        {disabledReason ?? "This conversation is read-only."}
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card p-3">
      {!isOnline && (
        <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          You&apos;re offline — messages can&apos;t be sent right now.
        </p>
      )}
      {upload && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs text-foreground">{upload.fileName}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-brand-green transition-all" style={{ width: `${upload.progress}%` }} />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{upload.progress}%</span>
          <button type="button" onClick={cancelUpload} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Cancel upload">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleFilePick} />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={!isOnline || Boolean(upload)}
          aria-label="Attach a file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          onKeyDown={handleKeyDown}
          disabled={!isOnline}
          placeholder="Type a message..."
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={!value.trim() || !isOnline || Boolean(upload)}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
