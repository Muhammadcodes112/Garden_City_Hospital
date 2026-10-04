import { RotateCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageBody } from "./message-body";
import { ClientTime } from "./client-time";
import { AttachmentCard } from "./attachment-card";
import type { ClientMessage } from "./conversation-view";

export function MessageBubble({
  message,
  isMine,
  showSeen,
  tight,
  onDelete,
  onRetry,
}: {
  message: ClientMessage;
  isMine: boolean;
  showSeen: boolean;
  tight: boolean;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const deleted = Boolean(message.deletedAt);
  const failed = message.status === "failed";
  const pending = message.status === "pending";
  const attachment = message.attachments[0];

  const actionButton = isMine && !deleted && (
    <button
      type="button"
      onClick={failed ? onRetry : onDelete}
      className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:inline-flex"
      aria-label={failed ? "Retry sending" : "Delete message"}
    >
      {failed ? <RotateCw className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
    </button>
  );

  return (
    <div className={cn("group flex", isMine ? "justify-end" : "justify-start", tight ? "mt-0.5" : "mt-3")}>
      <div className={cn("flex max-w-[78%] flex-col gap-1 sm:max-w-[65%]", isMine ? "items-end" : "items-start")}>
        {deleted ? (
          <div className="rounded-2xl bg-muted px-3.5 py-2 text-sm italic text-muted-foreground">This message was deleted</div>
        ) : (
          <>
            {message.body && (
              <div className="flex items-center gap-1.5">
                {!attachment && actionButton}
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm",
                    isMine ? "bg-brand-green text-white" : "bg-muted text-foreground",
                    pending && "opacity-60",
                    failed && "border border-destructive",
                  )}
                >
                  <MessageBody text={message.body} />
                </div>
              </div>
            )}
            {attachment && (
              <div className={cn("flex items-center gap-1.5", pending && "opacity-60", failed && "opacity-80")}>
                {actionButton}
                <AttachmentCard attachment={attachment} />
              </div>
            )}
          </>
        )}
        <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          {failed ? (
            <button type="button" onClick={onRetry} className="font-medium text-destructive underline">
              Failed — tap to retry
            </button>
          ) : (
            <>
              <span>{pending ? "Sending…" : <ClientTime iso={message.createdAt} />}</span>
              {isMine && showSeen && !pending && <span className="text-brand-green">· Seen</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
