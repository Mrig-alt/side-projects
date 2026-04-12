import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { cafeteriaSlots, listings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createListingSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { slotId, dishName, description, cuisineType, isVeg, pricePerPortion, totalQuantity, photoUrl } = parsed.data;

  // Verify slot belongs to this seller
  const [slot] = await db
    .select()
    .from(cafeteriaSlots)
    .where(eq(cafeteriaSlots.id, slotId))
    .limit(1);

  if (!slot || slot.sellerId !== session.user.id) {
    return Response.json({ error: "Slot not found or not yours" }, { status: 403 });
  }

  const [listing] = await db
    .insert(listings)
    .values({
      slotId,
      sellerId: session.user.id,
      dishName,
      description: description || null,
      cuisineType,
      isVeg,
      pricePerPortion,
      totalQuantity,
      availableQuantity: totalQuantity,
      photoUrl: photoUrl || null,
    })
    .returning();

  return Response.json(listing, { status: 201 });
}
