"use server";

import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { serviceCategories, servicePriceHistory, services, user } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/authz";
import { logEvent, type ActorRole } from "@/lib/activity";
import { MAX_PRICE_KOBO, formatKobo, parseNairaToKobo } from "@/lib/money";

export type PriceListService = {
  id: string;
  name: string;
  code: string | null;
  priceKobo: number;
  folderColour: string | null;
  allowCustomAmount: boolean;
  active: boolean;
  notes: string | null;
};

export type PriceListCategory = {
  id: string;
  name: string;
  services: PriceListService[];
};

export type PriceHistoryEntry = {
  id: string;
  oldPriceKobo: number;
  newPriceKobo: number;
  changedByName: string | null;
  changedAt: string;
  reason: string;
};

type Result = { success: true } | { success: false; error: string };

function actorOf(session: Awaited<ReturnType<typeof requireSuperAdmin>>) {
  return {
    actorId: session.user.id,
    actorLabel: session.user.name,
    actorRoleAtTime: (session.user as { role?: ActorRole }).role ?? null,
  };
}

export async function getPriceList(): Promise<PriceListCategory[]> {
  await requireSuperAdmin();
  const [cats, rows] = await Promise.all([
    db.select().from(serviceCategories).orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name)),
    db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name)),
  ]);
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    services: rows
      .filter((s) => s.categoryId === c.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        priceKobo: s.priceKobo,
        folderColour: s.folderColour,
        allowCustomAmount: s.allowCustomAmount,
        active: s.active,
        notes: s.notes,
      })),
  }));
}

export async function updateServicePrice(input: { serviceId: string; price: string; reason: string }): Promise<Result> {
  const session = await requireSuperAdmin();
  const newPriceKobo = parseNairaToKobo(input.price);
  if (newPriceKobo === null) return { success: false, error: "Enter a valid amount, e.g. 12000 or 12,000.50" };
  if (newPriceKobo > MAX_PRICE_KOBO) return { success: false, error: `Price can't exceed ${formatKobo(MAX_PRICE_KOBO)}` };
  const reason = input.reason.trim();
  if (reason.length < 3) return { success: false, error: "Give a reason for the price change" };

  const [service] = await db
    .select({ name: services.name, priceKobo: services.priceKobo })
    .from(services)
    .where(eq(services.id, input.serviceId));
  if (!service) return { success: false, error: "Service not found" };
  if (service.priceKobo === newPriceKobo) return { success: false, error: "That's already the current price" };

  const actor = actorOf(session);
  await db.transaction(async (tx) => {
    await tx.update(services).set({ priceKobo: newPriceKobo, updatedAt: new Date() }).where(eq(services.id, input.serviceId));
    await tx.insert(servicePriceHistory).values({
      serviceId: input.serviceId,
      oldPriceKobo: service.priceKobo,
      newPriceKobo,
      changedBy: session.user.id,
      reason,
    });
    await logEvent({
      tx,
      category: "billing",
      action: "price.changed",
      summary: `${actor.actorLabel} changed the price of ${service.name} from ${formatKobo(service.priceKobo)} to ${formatKobo(newPriceKobo)}: ${reason}`,
      ...actor,
      targetType: "service",
      targetId: input.serviceId,
      metadata: { oldPriceKobo: service.priceKobo, newPriceKobo, reason },
    });
  });

  revalidatePath("/price-list");
  return { success: true };
}

export async function setServiceActive(serviceId: string, active: boolean): Promise<Result> {
  const session = await requireSuperAdmin();
  const [service] = await db.select({ name: services.name }).from(services).where(eq(services.id, serviceId));
  if (!service) return { success: false, error: "Service not found" };

  const actor = actorOf(session);
  await db.transaction(async (tx) => {
    await tx.update(services).set({ active, updatedAt: new Date() }).where(eq(services.id, serviceId));
    await logEvent({
      tx,
      category: "billing",
      action: active ? "service.activated" : "service.deactivated",
      summary: `${actor.actorLabel} ${active ? "activated" : "deactivated"} ${service.name}`,
      ...actor,
      targetType: "service",
      targetId: serviceId,
    });
  });

  revalidatePath("/price-list");
  return { success: true };
}

/** Moves a service one place up/down within its category (renumbering the category so orders stay contiguous). */
export async function moveService(serviceId: string, direction: "up" | "down"): Promise<Result> {
  await requireSuperAdmin();
  const [target] = await db.select({ categoryId: services.categoryId }).from(services).where(eq(services.id, serviceId));
  if (!target) return { success: false, error: "Service not found" };

  await db.transaction(async (tx) => {
    const siblings = await tx
      .select({ id: services.id })
      .from(services)
      .where(eq(services.categoryId, target.categoryId))
      .orderBy(asc(services.sortOrder), asc(services.name));
    const ids = siblings.map((s) => s.id);
    const from = ids.indexOf(serviceId);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    for (const [index, id] of ids.entries()) {
      await tx.update(services).set({ sortOrder: index }).where(eq(services.id, id));
    }
  });

  revalidatePath("/price-list");
  return { success: true };
}

export async function getPriceHistory(serviceId: string): Promise<PriceHistoryEntry[]> {
  await requireSuperAdmin();
  const rows = await db
    .select({
      id: servicePriceHistory.id,
      oldPriceKobo: servicePriceHistory.oldPriceKobo,
      newPriceKobo: servicePriceHistory.newPriceKobo,
      changedByName: user.name,
      changedAt: servicePriceHistory.changedAt,
      reason: servicePriceHistory.reason,
    })
    .from(servicePriceHistory)
    .leftJoin(user, eq(servicePriceHistory.changedBy, user.id))
    .where(eq(servicePriceHistory.serviceId, serviceId))
    .orderBy(desc(servicePriceHistory.changedAt));
  return rows.map((r) => ({ ...r, changedAt: r.changedAt.toISOString() }));
}
