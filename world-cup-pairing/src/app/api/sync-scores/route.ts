import { NextResponse } from "next/server";
import { db } from "@/db";
import { matches, teams, bets, students } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { fetchWCMatches, mapApiStatus } from "@/lib/football-api";
import { settleBetsForMatch, settlePredictionsForMatch } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // CRON_SECRET is REQUIRED — if not set, the endpoint is locked down entirely.
  // This prevents unauthenticated score syncing and bet/prediction settlement.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET env var not configured" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  const apiMatches = await fetchWCMatches();
  if (!apiMatches.length) {
    return NextResponse.json({ synced: 0 });
  }

  const allTeams = await db.select({ id: teams.id, countryCode: teams.countryCode }).from(teams);
  const teamByCode: Record<string, string> = {};
  for (const t of allTeams) teamByCode[t.countryCode] = t.id;

  // Reconcile bets for all upcoming matches with both teams known.
  // Runs every sync so newly-registered students get bets retroactively.
  {
    const studentsWithTeams = await db
      .select({ id: students.id, teamId: students.teamId })
      .from(students)
      .where(and(eq(students.flagged, false), isNotNull(students.teamId)));

    const studentsByTeam = new Map<string, string[]>();
    for (const s of studentsWithTeams) {
      if (!s.teamId) continue;
      if (!studentsByTeam.has(s.teamId)) studentsByTeam.set(s.teamId, []);
      studentsByTeam.get(s.teamId)!.push(s.id);
    }

    const upcomingWithTeams = await db
      .select({ id: matches.id, team1Id: matches.team1Id, team2Id: matches.team2Id })
      .from(matches)
      .where(and(eq(matches.status, "upcoming"), isNotNull(matches.team1Id), isNotNull(matches.team2Id)));

    const betValues: { matchId: string; student1Id: string; student2Id: string }[] = [];
    for (const m of upcomingWithTeams) {
      if (!m.team1Id || !m.team2Id) continue;
      const s1List = studentsByTeam.get(m.team1Id) ?? [];
      const s2List = studentsByTeam.get(m.team2Id) ?? [];
      for (const s1 of s1List) {
        for (const s2 of s2List) {
          betValues.push({ matchId: m.id, student1Id: s1, student2Id: s2 });
        }
      }
    }
    if (betValues.length > 0) {
      await db.insert(bets).values(betValues).onConflictDoNothing();
    }
  }

  let synced = 0;
  let settled = 0;

  for (const am of apiMatches) {
    const newStatus = mapApiStatus(am.status);
    const score1 = am.score.fullTime.home;
    const score2 = am.score.fullTime.away;

    const resolvedStatus =
      newStatus === "completed" && (score1 === null || score2 === null) ? "live" : newStatus;

    const [existingByExtId] = await db
      .select()
      .from(matches)
      .where(eq(matches.externalId, am.id))
      .limit(1);

    if (existingByExtId) {
      const wasCompleted = existingByExtId.status === "completed";
      const scoresNowAvailable =
        wasCompleted &&
        (existingByExtId.team1Score === null || existingByExtId.team2Score === null) &&
        score1 !== null && score2 !== null;

      await db
        .update(matches)
        .set({ status: resolvedStatus, team1Score: score1, team2Score: score2 })
        .where(eq(matches.id, existingByExtId.id));

      if ((!wasCompleted && resolvedStatus === "completed") || scoresNowAvailable) {
        await settleBetsForMatch(existingByExtId.id);
        await settlePredictionsForMatch(existingByExtId.id);
        settled++;

        const stage = existingByExtId.stage;
        if (stage !== "group" && stage !== "friendly" && score1 !== null && score2 !== null) {
          const winner = am.score.winner ??
            (score1 > score2 ? "HOME_TEAM" : score2 > score1 ? "AWAY_TEAM" : null);
          const eliminatedId = winner === "HOME_TEAM" ? existingByExtId.team2Id
            : winner === "AWAY_TEAM" ? existingByExtId.team1Id : null;
          if (eliminatedId) {
            await db.update(teams).set({ isEliminated: true }).where(eq(teams.id, eliminatedId));
          }
        }
      }
      synced++;
      continue;
    }

    const tla1 = am.homeTeam.tla?.toUpperCase();
    const tla2 = am.awayTeam.tla?.toUpperCase();
    if (!tla1 || !tla2) continue;
    const team1Id = teamByCode[tla1];
    const team2Id = teamByCode[tla2];
    if (!team1Id || !team2Id) continue;

    const [existingByTeams] = await db
      .select()
      .from(matches)
      .where(and(eq(matches.team1Id, team1Id), eq(matches.team2Id, team2Id)))
      .limit(1);

    if (existingByTeams) {
      const wasCompleted = existingByTeams.status === "completed";
      const scoresNowAvailable =
        wasCompleted &&
        (existingByTeams.team1Score === null || existingByTeams.team2Score === null) &&
        score1 !== null && score2 !== null;

      await db
        .update(matches)
        .set({ externalId: am.id, status: resolvedStatus, team1Score: score1, team2Score: score2 })
        .where(eq(matches.id, existingByTeams.id));

      if ((!wasCompleted && resolvedStatus === "completed") || scoresNowAvailable) {
        await settleBetsForMatch(existingByTeams.id);
        await settlePredictionsForMatch(existingByTeams.id);
        settled++;

        const stage = existingByTeams.stage;
        if (stage !== "group" && stage !== "friendly" && score1 !== null && score2 !== null) {
          const winner = am.score.winner ??
            (score1 > score2 ? "HOME_TEAM" : score2 > score1 ? "AWAY_TEAM" : null);
          const eliminatedId = winner === "HOME_TEAM" ? existingByTeams.team2Id
            : winner === "AWAY_TEAM" ? existingByTeams.team1Id : null;
          if (eliminatedId) {
            await db.update(teams).set({ isEliminated: true }).where(eq(teams.id, eliminatedId));
          }
        }
      }
      synced++;
    }
  }

  return NextResponse.json({ synced, settled });
}
