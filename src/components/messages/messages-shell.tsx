import { cn } from "@/lib/utils";
import { PeopleList } from "./people-list";
import type { PersonSummary } from "@/lib/messages";

export function MessagesShell({
  initialPeople,
  activeUserId,
  children,
}: {
  initialPeople: PersonSummary[];
  activeUserId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-7.5rem)] overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100vh-8.5rem)]">
      <div className={cn("w-full shrink-0 lg:w-80 lg:border-r lg:border-border", activeUserId && "hidden lg:block")}>
        <PeopleList initialPeople={initialPeople} activeUserId={activeUserId} />
      </div>
      <div className={cn("min-w-0 flex-1", !activeUserId && "hidden lg:flex")}>
        {children ?? <EmptyConversationState />}
      </div>
    </div>
  );
}

function EmptyConversationState() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
      <p className="text-sm font-medium text-foreground">Select a conversation</p>
      <p className="text-xs">Pick an admin from the list to start messaging.</p>
    </div>
  );
}
