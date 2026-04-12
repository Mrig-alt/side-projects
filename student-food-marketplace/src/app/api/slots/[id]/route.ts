import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { cafeteriaSlots, listings } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [slot] = await db
    .select()
    .from(cafeteriaSlots)
    .where(eq(cafeteriaSlots.id, id))
    .limit(1);

  if (!slot) return Response.json({ error: "Not found" }, { status: 404 });

  const dishes = await db
    .select()
    .from(listings)
    .where(eq(listings.slotId, id));

  return Response.json({ ...slot, listings: dishes });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [slot] = await db
    .select()
    .from(cafeteriaSlots)
    .where(and(eq(cafeteriaSlots.id, id), eq(cafeteriaSlots.sellerId, session.user.id)))
    .limit(1);

  if (!slot) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const allowed = ["startTime", "endTime", "status"] as const;
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const [updated] = await db
    .update(cafeteriaSlots)
    .set(updates)
    .where(eq(cafeteriaSlots.id, id))
    .returning();

  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [slot] = await db
    .select()
    .from(cafeteriaSlots)
    .where(and(eq(cafeteriaSlots.id, id), eq(cafeteriaSlots.sellerId, session.user.id)))
    .limit(1);

  if (!slot) return Response.json({ error: "Not found" }, { status: 404 });

  await db.delete(cafeteriaSlots).where(eq(cafeteriaSlots.id, id));
  return Response.json({ success: true });
}
