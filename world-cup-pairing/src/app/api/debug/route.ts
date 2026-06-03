import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    // Step 1: DB connection
    const { db } = await import("@/db");
    const { matches, teams, students, predictions, watchInvites } = await import("@/db/schema");
    const { eq, and, gte, lte, asc } = await import("drizzle-orm");

    const [{ count: teamCount }] = await db.execute<{ count: string }>(
      db.select({ count: teams.id }).from(teams).limit(1) as never
    ).catch(async () => {
      const rows = await db.select({ id: teams.id }).from(teams).limit(1);
      return [{ count: String(rows.length) }];
    });
    results.db_ok = true;

    // Step 2: auth
    try {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      results.auth_ok = true;
      results.has_session = !!session;
    } catch (e) {
      results.auth_ok = false;
      results.auth_error = e instanceof Error ? e.message : String(e);
    }

    // Step 3: todayMatches query (the problematic double-join one from page.tsx)
    try {
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

      results.todayMatches_ok = true;
      results.todayMatches_count = todayMatches.length;
      if (todayMatches[0]) {
        results.todayMatches_sample = {
          id: todayMatches[0].id,
          status: todayMatches[0].status,
          team1: todayMatches[0].team1,
          team2: todayMatches[0].team2,
        };
      }
    } catch (e) {
      results.todayMatches_ok = false;
      results.todayMatches_error = e instanceof Error ? e.message : String(e);
    }

    // Step 4: allStudents query
    try {
      const allStudents = await db
        .select({ id: students.id, name: students.name, teamId: students.teamId, visibility: students.visibility, lastSeenAt: students.lastSeenAt })
        .from(students)
        .where(eq(students.flagged, false));
      results.allStudents_ok = true;
      results.allStudents_count = allStudents.length;
    } catch (e) {
      results.allStudents_ok = false;
      results.allStudents_error = e instanceof Error ? e.message : String(e);
    }

    // Step 5: predictions query (needs a fake student id)
    try {
      const myPredictions = await db
        .select()
        .from(predictions)
        .where(and(eq(predictions.studentId, "00000000-0000-0000-0000-000000000000")));
      results.predictions_ok = true;
      results.predictions_count = myPredictions.length;
    } catch (e) {
      results.predictions_ok = false;
      results.predictions_error = e instanceof Error ? e.message : String(e);
    }

    // Step 6: watch invites query
    try {
      const invites = await db.select({
        inviterId: watchInvites.inviterId,
        matchId: watchInvites.matchId,
        locationName: watchInvites.locationName,
        locationUrl: watchInvites.locationUrl,
      }).from(watchInvites);
      results.watchInvites_ok = true;
      results.watchInvites_count = invites.length;
    } catch (e) {
      results.watchInvites_ok = false;
      results.watchInvites_error = e instanceof Error ? e.message : String(e);
    }

    // Step 7: Try the complete schedule query pattern (simpler, works for both pages)
    try {
      const allMatches = await db
        .select({ id: matches.id, matchDatetime: matches.matchDatetime, status: matches.status, team1Id: matches.team1Id, team2Id: matches.team2Id })
        .from(matches)
        .orderBy(asc(matches.matchDatetime))
        .limit(3);
      results.schedule_query_ok = true;
      results.schedule_count = allMatches.length;
    } catch (e) {
      results.schedule_query_ok = false;
      results.schedule_error = e instanceof Error ? e.message : String(e);
    }

  } catch (e) {
    results.setup_error = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack?.slice(0, 500)}` : String(e);
  }

  return NextResponse.json(results);
}
