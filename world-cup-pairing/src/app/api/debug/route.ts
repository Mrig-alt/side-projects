import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test the EXACT query from page.tsx — team1 and team2 from the same join
  try {
    const { db } = await import("@/db");
    const { matches, teams } = await import("@/db/schema");
    const { eq, and, gte, lte } = await import("drizzle-orm");

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const rows = await db
      .select({
        id: matches.id,
        matchDatetime: matches.matchDatetime,
        status: matches.status,
        stage: matches.stage,
        team1: { id: teams.id, name: teams.name, flagEmoji: teams.flagEmoji },
        team2: { id: teams.id, name: teams.name, flagEmoji: teams.flagEmoji },
      })
      .from(matches)
      .leftJoin(teams, eq(matches.team1Id, teams.id))
      .where(and(gte(matches.matchDatetime, todayStart), lte(matches.matchDatetime, todayEnd)))
      .limit(5);

    results.exact_page_query_ok = true;
    results.today_matches_count = rows.length;
    results.sample = rows[0] ?? null;
  } catch (e) {
    results.exact_page_query_ok = false;
    results.exact_page_query_error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  // Test formatKickoff from utils
  try {
    const { formatKickoff } = await import("@/lib/utils");
    const testDate = new Date("2026-06-11T18:00:00Z");
    results.formatKickoff_ok = true;
    results.formatKickoff_result = formatKickoff(testDate);
  } catch (e) {
    results.formatKickoff_ok = false;
    results.formatKickoff_error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  return NextResponse.json(results);
}
