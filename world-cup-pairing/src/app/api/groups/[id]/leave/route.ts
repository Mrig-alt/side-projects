import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { friendGroups, groupMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.studentId, session.user.id)));

  // If owner leaving, delete the whole group
  const [group] = await db
    .select({ createdBy: friendGroups.createdBy })
    .from(friendGroups)
    .where(eq(friendGroups.id, groupId))
    .limit(1);

  if (group?.createdBy === session.user.id) {
    await db.delete(friendGroups).where(eq(friendGroups.id, groupId));
  }

  return NextResponse.json({ ok: true });
}
