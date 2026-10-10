import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/authz";
import { getConversationWithUser, listPeople } from "@/lib/actions/messages";
import { MessagesShell } from "@/components/messages/messages-shell";
import { ConversationView } from "@/components/messages/conversation-view";

export const dynamic = "force-dynamic";

export default async function MessageThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await requireStaff();

  if (userId === session.user.id) notFound();

  const [people, conversation] = await Promise.all([listPeople(), getConversationWithUser(userId)]);
  if (!conversation) notFound();

  return (
    <MessagesShell initialPeople={people} activeUserId={userId}>
      <ConversationView
        meId={session.user.id}
        targetUser={conversation.targetUser}
        initialConversationId={conversation.conversationId}
        initialMessages={conversation.messages}
        initialHasMore={conversation.hasMore}
        initialOtherLastReadAt={conversation.otherLastReadAt}
        readOnly={conversation.readOnly}
      />
    </MessagesShell>
  );
}
