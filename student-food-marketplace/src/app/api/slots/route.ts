import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { cafeteriaSlots, listings, users } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { createSlotSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const rows = await db
    .select({
      slot: cafeteriaSlots,
      seller: {
        id: users.id,
        name: users.name,
      },
    })
    .from(cafeteriaSlots)
    .innerJoin(users, eq(cafeteriaSlots.sellerId, users.id))
    .where(
      and(
        eq(cafeteriaSlots.date, date),
        gte(cafeteriaSlots.date, new Date().toISOString().split("T")[0])
      )
    )
    .orderBy(cafeteriaSlots.startTime);

  // For each slot, fetch active listings
  const slotsWithListings = await Promise.all(
    rows.map(async (row) => {
      const dishes = await db
        .select()
        .from(listings)
        .where(
          and(
            eq(listings.slotId, row.slot.id),
            eq(listings.status, "active")
          )
        );
      return { ...row.slot, seller: row.seller, listings: dishes };
    })
  );

  return Response.json(slotsWithListings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.isSellerProfileComplete) {
    return Response.json({ error: "Complete seller profile first" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSlotSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { date, startTime, endTime } = parsed.data;

  // Enforce one slot per seller per day (DB unique constraint will also catch this)
  try {
    const [slot] = await db
      .insert(cafeteriaSlots)
      .values({
        sellerId: session.user.id,
        date,
        startTime: startTime + ":00",
        endTime: endTime + ":00",
      })
      .returning();
    return Response.json(slot, { status: 201 });
  } catch {
    return Response.json(
      { error: { date: ["You already have a slot on this date"] } },
      { status: 409 }
    );
  }
}
