import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { listings, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { patchOrderSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) return Response.json({ error: "Not found" }, { status: 404 });

  // Determine caller role
  const [listing] = await db
    .select({ sellerId: listings.sellerId })
    .from(listings)
    .where(eq(listings.id, order.listingId))
    .limit(1);

  const isSeller = listing?.sellerId === session.user.id;
  const isBuyer = order.buyerId === session.user.id;

  if (!isSeller && !isBuyer) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { status: newStatus } = parsed.data;

  // Enforce allowed transitions per role
  const sellerTransitions: Record<string, string[]> = {
    pending: ["accepted", "rejected"],
    accepted: ["ready"],
    ready: ["picked_up"],
  };
  const buyerTransitions: Record<string, string[]> = {
    pending: ["cancelled"],
  };

  const allowed = isSeller
    ? sellerTransitions[order.status] ?? []
    : buyerTransitions[order.status] ?? [];

  if (!allowed.includes(newStatus)) {
    return Response.json(
      { error: `Cannot transition from "${order.status}" to "${newStatus}"` },
      { status: 400 }
    );
  }

  // Build update payload
  const now = new Date();
  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "accepted") update.acceptedAt = now;
  if (newStatus === "ready") update.readyAt = now;
  if (newStatus === "picked_up") update.pickedUpAt = now;
  if (newStatus === "rejected") update.rejectedAt = now;
  if (newStatus === "cancelled") update.cancelledAt = now;

  // Restore stock on rejection or buyer cancellation
  if (newStatus === "rejected" || newStatus === "cancelled") {
    await db.transaction(async (tx) => {
      await tx
        .update(listings)
        .set({
          availableQuantity: listing
            ? (await tx.select({ q: listings.availableQuantity }).from(listings).where(eq(listings.id, order.listingId)))[0]?.q + order.quantity
            : 0,
          status: "active",
          updatedAt: now,
        })
        .where(eq(listings.id, order.listingId));
      await tx.update(orders).set(update).where(eq(orders.id, id));
    });
  } else {
    await db.update(orders).set(update).where(eq(orders.id, id));
  }

  const [updated] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

  // Redact contact info for buyer unless status warrants reveal
  if (isBuyer && !["accepted", "ready", "picked_up"].includes(updated.status)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sellerWhatsapp, sellerUpiId, ...safe } = updated;
    return Response.json(safe);
  }

  return Response.json(updated);
}
