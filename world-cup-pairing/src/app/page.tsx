import { auth } from "@/lib/auth";
import { db } from "@/db";
import { matches, teams, students, predictions, watchInvites, bets } from "@/db/schema";
import { eq, and, gte, lte, or, desc } from "drizzle-orm";
import TodayHero from "@/components/matches/TodayHero";
import MatchCard from "@/components/matches/MatchCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Today's matches
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

  // This is a simplified fetch — for home page we need team1 + team2 separately
  // Use a raw approach with two joins
  const todayMatchIds = todayMatches.map((m) => m.id);

  // Get all students with their teams (for pairings)
  const allStudents = await db
    .select({
      id: students.id,
      name: students.name,
      teamId: students.teamId,
      visibility: students.visibility,
      lastSeenAt: students.lastSeenAt,
    })
    .from(students)
    .where(eq(students.flagged, false));

  // Get current user's predictions for today
  const myPredictions = session
    ? await db
        .select()
        .from(predictions)
        .where(
          and(
            eq(predictions.studentId, session.user.id),
          )
        )
    : [];

  // Get watch invites for today's matches
  const todayInvites = todayMatchIds.length > 0
    ? await db
        .select({
          inviterId: watchInvites.inviterId,
          matchId: watchInvites.matchId,
          locationName: watchInvites.locationName,
          locationUrl: watchInvites.locationUrl,
        })
        .from(watchInvites)
    : [];

  const liveCount = todayMatches.filter((m) => m.status === "live").length;
  const upcomingCount = todayMatches.filter((m) => m.status === "upcoming").length;
  const nextMatch = todayMatches.find((m) => m.status === "upcoming") ?? null;

  const myTeam = session?.user.teamId
    ? allStudents.find((s) => s.id === session.user.id)
    : null;

  // Build team lookup
  const teamMap = new Map<string, { id: string; name: string; flagEmoji: string }>();

  return (
    <div className="space-y-6">
      <TodayHero
        liveCount={liveCount}
        upcomingCount={upcomingCount}
        nextMatch={nextMatch as Parameters<typeof TodayHero>[0]["nextMatch"]}
        tokenBalance={session?.user.tokenBalance}
      />

      {!session && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm text-green-700 font-medium">
            🏆 Join the class to see your pairings and bet tokens!
          </p>
          <a href="/join" className="mt-2 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Join now
          </a>
        </div>
      )}

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          {liveCount > 0 ? "🔴 Live now" : "Today's matches"}
        </h2>
        {todayMatches.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No matches today — check the schedule for upcoming games.</p>
        ) : (
          <div className="space-y-3">
            {todayMatches.map((match) => {
              const team1Supporters = allStudents.filter(
                (s) => s.teamId === match.team1?.id && s.visibility !== "stealth"
              );
              const team2Supporters = allStudents.filter(
                (s) => s.teamId === match.team2?.id && s.visibility !== "stealth"
              );
              const myPred = myPredictions.find((p) => p.matchId === match.id);
              const myInvite = todayInvites.find(
                (i) => i.matchId === match.id && i.inviterId === session?.user.id
              );

              // Find opponent's watch invite (someone on the other side)
              const myTeamId = session?.user.teamId;
              const isOnTeam1 = myTeamId === match.team1?.id;
              const isOnTeam2 = myTeamId === match.team2?.id;
              const opponentTeamSupporters = isOnTeam1
                ? team2Supporters
                : isOnTeam2
                ? team1Supporters
                : [];
              const opponentIds = opponentTeamSupporters.map((s) => s.id);
              const opponentInviteRaw = todayInvites.find(
                (i) => i.matchId === match.id && opponentIds.includes(i.inviterId)
              );
              const opponentInviter = opponentInviteRaw
                ? allStudents.find((s) => s.id === opponentInviteRaw.inviterId)
                : null;

              return (
                <MatchCard
                  key={match.id}
                  match={match as Parameters<typeof MatchCard>[0]["match"]}
                  team1Supporters={team1Supporters.map((s) => ({ id: s.id, name: s.name, lastSeenAt: s.lastSeenAt, watchInvite: null }))}
                  team2Supporters={team2Supporters.map((s) => ({ id: s.id, name: s.name, lastSeenAt: s.lastSeenAt, watchInvite: null }))}
                  currentUserId={session?.user.id}
                  currentUserTeamId={session?.user.teamId}
                  prediction={myPred ? { predictedScore1: myPred.predictedScore1, predictedScore2: myPred.predictedScore2 } : null}
                  myWatchInvite={myInvite ? { locationName: myInvite.locationName ?? "", locationUrl: myInvite.locationUrl } : null}
                  opponentWatchInvite={
                    opponentInviteRaw && opponentInviter
                      ? {
                          locationName: opponentInviteRaw.locationName ?? "",
                          locationUrl: opponentInviteRaw.locationUrl,
                          inviterName: opponentInviter.name,
                        }
                      : null
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <div className="flex justify-center">
        <a href="/schedule" className="text-sm font-medium text-green-600 hover:text-green-700">
          View full schedule →
        </a>
      </div>
    </div>
  );
}
