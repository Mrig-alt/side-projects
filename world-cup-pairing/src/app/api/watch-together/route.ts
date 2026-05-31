import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { watchInvites } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { watchTogetherSchema } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = watchTogetherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { matchId, locationName, locationUrl } = parsed.data;

  // Upsert: one invite per inviter per match
  const existing = await db
    .select({ id: watchInvites.id })
    .from(watchInvites)
    .where(and(eq(watchInvites.inviterId, session.user.id), eq(watchInvites.matchId, matchId)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(watchInvites)
      .set({ locationName, locationUrl: locationUrl || null })
      .where(eq(watchInvites.id, existing[0].id))
      .returning();
    return NextResponse.json({ invite: updated });
  }

  const [invite] = await db
    .insert(watchInvites)
    .values({
      inviterId: session.user.id,
      matchId,
      locationName,
      locationUrl: locationUrl || null,
    })
    .returning();

  return NextResponse.json({ invite }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  await db
    .delete(watchInvites)
    .where(
      and(eq(watchInvites.inviterId, session.user.id), eq(watchInvites.matchId, matchId))
    );

  return NextResponse.json({ ok: true });
}
