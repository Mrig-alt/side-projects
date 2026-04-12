import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { cafeteriaSlots, listings, orders, users } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { reserveSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { listingId, quantity } = parsed.data;

  try {
    const order = await db.transaction(async (tx) => {
      // Lock the listing row to prevent race conditions
      const [listing] = await tx
        .select()
        .from(listings)
        .where(eq(listings.id, listingId))
        .for("update");

      if (!listing) throw new Error("Listing not found");
      if (listing.status !== "active") throw new Error("Listing is not available");
      if (listing.availableQuantity < quantity) throw new Error("Not enough portions available");
      if (listing.sellerId === session.user.id) throw new Error("Cannot order your own food");

      // Fetch slot for pickup info
      const [slot] = await tx
        .select()
        .from(cafeteriaSlots)
        .where(eq(cafeteriaSlots.id, listing.slotId));

      // Fetch seller contact info (snapshotted onto order)
      const [seller] = await tx
        .select({ whatsappNumber: users.whatsappNumber, upiId: users.upiId, name: users.name })
        .from(users)
        .where(eq(users.id, listing.sellerId));

      const newQty = listing.availableQuantity - quantity;

      await tx
        .update(listings)
        .set({
          availableQuantity: newQty,
          status: newQty === 0 ? "sold_out" : listing.status,
          updatedAt: new Date(),
        })
        .where(eq(listings.id, listingId));

      const [newOrder] = await tx
        .insert(orders)
        .values({
          listingId,
          slotId: listing.slotId,
          buyerId: session.user.id,
          quantity,
          totalAmount: listing.pricePerPortion * quantity,
          dishName: listing.dishName,
          pickupDate: slot.date,
          pickupStartTime: slot.startTime,
          pickupEndTime: slot.endTime,
          // Snapshot seller contact for post-acceptance reveal
          sellerWhatsapp: seller.whatsappNumber,
          sellerUpiId: seller.upiId,
          sellerName: seller.name,
        })
        .returning();

      return newOrder;
    });

    // Strip contact info from response (not revealed until accepted)
    const { sellerWhatsapp, sellerUpiId, ...safeOrder } = order;
    void sellerWhatsapp; void sellerUpiId;
    return Response.json(safeOrder, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Reservation failed";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = req.nextUrl.searchParams.get("role") ?? "buyer";

  if (role === "seller") {
    // Get all orders for listings owned by this seller
    const sellerOrders = await db
      .select({
        order: orders,
        listing: { dishName: listings.dishName, pricePerPortion: listings.pricePerPortion },
        buyer: { name: users.name, email: users.email },
      })
      .from(orders)
      .innerJoin(listings, eq(orders.listingId, listings.id))
      .innerJoin(users, eq(orders.buyerId, users.id))
      .where(eq(listings.sellerId, session.user.id))
      .orderBy(orders.createdAt);

    return Response.json(sellerOrders);
  }

  // Buyer view
  const buyerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.buyerId, session.user.id))
    .orderBy(orders.createdAt);

  // Redact contact info unless order is accepted/ready/picked_up
  const safe = buyerOrders.map((o) => sanitizeOrderForBuyer(o));
  return Response.json(safe);
}

function sanitizeOrderForBuyer(order: typeof orders.$inferSelect) {
  const revealStatuses = ["accepted", "ready", "picked_up"];
  if (!revealStatuses.includes(order.status)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sellerWhatsapp, sellerUpiId, ...rest } = order;
    return rest;
  }
  return order;
}
