import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { friendGroups, groupMembers, students } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const createSchema = z.object({
  name: z.string().min(2).max(50),
});

// GET /api/groups — list my groups with members
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find all groups the user is a member of
  const myMemberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.studentId, session.user.id));

  if (myMemberships.length === 0) return NextResponse.json({ groups: [] });

  const groupIds = myMemberships.map((m) => m.groupId);

  const groups = await db
    .select()
    .from(friendGroups)
    .where(inArray(friendGroups.id, groupIds));

  // For each group, fetch members with names
  const allMembers = await db
    .select({
      groupId: groupMembers.groupId,
      studentId: groupMembers.studentId,
      name: students.name,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(students, eq(students.id, groupMembers.studentId))
    .where(inArray(groupMembers.groupId, groupIds));

  const result = groups.map((g) => ({
    ...g,
    members: allMembers.filter((m) => m.groupId === g.id),
    isOwner: g.createdBy === session.user.id,
  }));

  return NextResponse.json({ groups: result });
}

// POST /api/groups — create a new group
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Generate unique invite code (retry if clash)
  let inviteCode = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db
      .select({ id: friendGroups.id })
      .from(friendGroups)
      .where(eq(friendGroups.inviteCode, inviteCode))
      .limit(1);
    if (existing.length === 0) break;
    inviteCode = generateCode();
    attempts++;
  }

  const [group] = await db
    .insert(friendGroups)
    .values({ name: parsed.data.name, inviteCode, createdBy: session.user.id })
    .returning();

  // Auto-add creator as member
  await db.insert(groupMembers).values({ groupId: group.id, studentId: session.user.id });

  return NextResponse.json({ group }, { status: 201 });
}
