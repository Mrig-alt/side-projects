import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test 1: auth()
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    results.auth_ok = true;
    results.has_session = !!session;
  } catch (e) {
    results.auth_ok = false;
    results.auth_error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }

  // Test 2: drizzle db + the homepage's matches query
  try {
    const { db } = await import("@/db");
    const { matches, teams } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({
        id: matches.id,
        team1: { id: teams.id, name: teams.name },
      })
      .from(matches)
      .leftJoin(teams, eq(matches.team1Id, teams.id))
      .limit(1);
    results.drizzle_matches_ok = true;
    results.matches_sample_count = rows.length;
  } catch (e) {
    results.drizzle_matches_ok = false;
    results.drizzle_error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }

  // Test 3: students query
  try {
    const { db } = await import("@/db");
    const { students } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.flagged, false));
    results.drizzle_students_ok = true;
    results.students_count = rows.length;
  } catch (e) {
    results.drizzle_students_ok = false;
    results.students_error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
