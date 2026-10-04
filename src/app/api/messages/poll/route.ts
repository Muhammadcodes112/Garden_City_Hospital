import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/session";
import { getMessageUpdatesSince, listMessagePeople, serializeMessages } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meId = session.user.id;
  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(0);
  const serverTime = new Date();

  try {
    const [people, updates] = await Promise.all([
      listMessagePeople(meId),
      Number.isNaN(since.getTime()) ? Promise.resolve([]) : getMessageUpdatesSince(meId, since),
    ]);

    const unreadTotal = people.reduce((sum, p) => sum + p.unreadCount, 0);

    return NextResponse.json({
      serverTime: serverTime.toISOString(),
      people,
      unreadTotal,
      messages: await serializeMessages(updates),
    });
  } catch (err) {
    console.error("Failed to poll messages:", err);
    return NextResponse.json({ error: "Failed to poll messages" }, { status: 500 });
  }
}
