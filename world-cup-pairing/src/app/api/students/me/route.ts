import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";

// Lightweight endpoint the Header client component polls to get a live
// tokenBalance — avoids relying on the stale JWT cookie value.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [student] = await db
    .select({ tokenBalance: students.tokenBalance, teamId: students.teamId })
    .from(students)
    .where(eq(students.id, session.user.id))
    .limit(1);

  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ tokenBalance: student.tokenBalance, teamId: student.teamId });
}
