import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { matchReactions, matchVibes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { reactionSchema, vibeSchema } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.vibe !== undefined) {
    const parsed = vibeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const [vibe] = await db
      .insert(matchVibes)
      .values({ studentId: session.user.id, ...parsed.data })
      .onConflictDoUpdate({
        target: [matchVibes.studentId, matchVibes.matchId],
        set: { vibe: parsed.data.vibe },
      })
      .returning();
    return NextResponse.json({ vibe }, { status: 201 });
  }

  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const [reaction] = await db
    .insert(matchReactions)
    .values({ studentId: session.user.id, ...parsed.data })
    .returning();

  return NextResponse.json({ reaction }, { status: 201 });
}
