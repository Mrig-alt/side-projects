import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {
    node_env: process.env.NODE_ENV,
    database_url_set: !!process.env.DATABASE_URL,
    database_url_prefix: process.env.DATABASE_URL?.slice(0, 30) + "...",
    nextauth_secret_set: !!process.env.NEXTAUTH_SECRET,
    auth_secret_set: !!process.env.AUTH_SECRET,
    join_pin_set: !!process.env.JOIN_PIN,
    nextauth_url: process.env.NEXTAUTH_URL,
  };

  // Test 1: Can we import @/db at all?
  try {
    const { db } = await import("@/db");
    out.db_import_ok = true;

    // Test 2: Can we run a simple query?
    try {
      const { teams } = await import("@/db/schema");
      const rows = await db.select({ id: teams.id }).from(teams).limit(1);
      out.db_query_ok = true;
      out.db_has_rows = rows.length > 0;
    } catch (e) {
      out.db_query_ok = false;
      out.db_query_error = e instanceof Error ? e.message : String(e);
    }
  } catch (e) {
    out.db_import_ok = false;
    out.db_import_error = e instanceof Error ? e.message : String(e);
  }

  // Test 3: Can we import and call auth()?
  try {
    const { auth } = await import("@/lib/auth");
    out.auth_import_ok = true;
    try {
      const session = await auth();
      out.auth_call_ok = true;
      out.has_session = !!session;
    } catch (e) {
      out.auth_call_ok = false;
      out.auth_call_error = e instanceof Error ? e.message : String(e);
    }
  } catch (e) {
    out.auth_import_ok = false;
    out.auth_import_error = e instanceof Error ? e.message : String(e);
  }

  // Test 4: Run the exact leaderboard query (simpler than home page)
  try {
    const { db } = await import("@/db");
    const { students, teams } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");

    const rows = await db
      .select({ id: students.id, name: students.name, tokenBalance: students.tokenBalance })
      .from(students)
      .where(eq(students.flagged, false))
      .orderBy(desc(students.tokenBalance))
      .limit(3);

    out.leaderboard_query_ok = true;
    out.leaderboard_count = rows.length;
  } catch (e) {
    out.leaderboard_query_ok = false;
    out.leaderboard_query_error = e instanceof Error ? e.message : String(e);
  }

  // Test 5: Today's matches query (from home page)
  try {
    const { db } = await import("@/db");
    const { matches } = await import("@/db/schema");
    const { and, gte, lte, asc } = await import("drizzle-orm");

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const rows = await db
      .select({ id: matches.id, status: matches.status, matchDatetime: matches.matchDatetime })
      .from(matches)
      .where(and(gte(matches.matchDatetime, todayStart), lte(matches.matchDatetime, todayEnd)))
      .orderBy(asc(matches.matchDatetime));

    out.today_matches_ok = true;
    out.today_matches_count = rows.length;
  } catch (e) {
    out.today_matches_ok = false;
    out.today_matches_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(out, { status: 200 });
}
