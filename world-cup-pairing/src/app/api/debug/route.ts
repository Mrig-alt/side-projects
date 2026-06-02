import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");

    const { db } = await import("@/db");
    const { matches, teams } = await import("@/db/schema");
    const { eq, and, gte, lte } = await import("drizzle-orm");

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const todayMatches = await db
      .select({
        id: matches.id,
        matchDatetime: matches.matchDatetime,
        status: matches.status,
        stage: matches.stage,
        groupName: matches.groupName,
        team1Score: matches.team1Score,
        team2Score: matches.team2Score,
        venue: matches.venue,
        city: matches.city,
        team1Placeholder: matches.team1Placeholder,
        team2Placeholder: matches.team2Placeholder,
        team1: { id: teams.id, name: teams.name, flagEmoji: teams.flagEmoji },
        team2: { id: teams.id, name: teams.name, flagEmoji: teams.flagEmoji },
      })
      .from(matches)
      .leftJoin(teams, eq(matches.team1Id, teams.id))
      .where(and(gte(matches.matchDatetime, todayStart), lte(matches.matchDatetime, todayEnd)))
      .orderBy(matches.matchDatetime);

    // Render TodayHero
    try {
      const TodayHero = (await import("@/components/matches/TodayHero")).default;
      renderToStaticMarkup(
        React.createElement(TodayHero, {
          liveCount: 0,
          upcomingCount: todayMatches.length,
          nextMatch: todayMatches[0] as never,
          tokenBalance: 100,
        })
      );
      results.TodayHero_ok = true;
    } catch (e) {
      results.TodayHero_ok = false;
      results.TodayHero_error = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e);
    }

    // Render MatchCard
    try {
      const MatchCard = (await import("@/components/matches/MatchCard")).default;
      const m = todayMatches[0];
      renderToStaticMarkup(
        React.createElement(MatchCard, {
          match: m as never,
          team1Supporters: [],
          team2Supporters: [],
          currentUserId: "test-id",
          currentUserTeamId: null,
          prediction: null,
          myWatchInvite: null,
          opponentWatchInvite: null,
        })
      );
      results.MatchCard_ok = true;
    } catch (e) {
      results.MatchCard_ok = false;
      results.MatchCard_error = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e);
    }
  } catch (e) {
    results.setup_error = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e);
  }

  return NextResponse.json(results);
}
