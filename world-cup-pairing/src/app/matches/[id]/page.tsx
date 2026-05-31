import { auth } from "@/lib/auth";
import { db } from "@/db";
import { matches, teams, students, matchReactions } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatMatchDate, formatKickoff, stageLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import ReactionTimeline from "@/components/matches/ReactionTimeline";
import Link from "next/link";

export const revalidate = 60;

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);

  if (!match) notFound();

  const team1 = match.team1Id
    ? (await db.select().from(teams).where(eq(teams.id, match.team1Id)).limit(1))[0]
    : null;
  const team2 = match.team2Id
    ? (await db.select().from(teams).where(eq(teams.id, match.team2Id)).limit(1))[0]
    : null;

  const team1Supporters = match.team1Id
    ? await db
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(and(eq(students.teamId, match.team1Id), eq(students.flagged, false)))
    : [];
  const team2Supporters = match.team2Id
    ? await db
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(and(eq(students.teamId, match.team2Id), eq(students.flagged, false)))
    : [];

  const reactions = await db
    .select({
      id: matchReactions.id,
      emoji: matchReactions.emoji,
      matchMinute: matchReactions.matchMinute,
      createdAt: matchReactions.createdAt,
      studentId: matchReactions.studentId,
    })
    .from(matchReactions)
    .where(eq(matchReactions.matchId, id))
    .orderBy(asc(matchReactions.createdAt));

  // Enrich reactions with student names
  const studentIds = [...new Set(reactions.map((r) => r.studentId))];
  const reactionStudents =
    studentIds.length > 0
      ? await db
          .select({ id: students.id, name: students.name })
          .from(students)
          .where(eq(students.flagged, false))
      : [];
  const studentNameMap = new Map(reactionStudents.map((s) => [s.id, s.name]));

  const enrichedReactions = reactions.map((r) => ({
    ...r,
    studentName:
      r.studentId === session?.user.id ? "You" : (studentNameMap.get(r.studentId) ?? "Classmate"),
  }));

  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";

  const t1Name = team1?.name ?? match.team1Placeholder ?? "TBD";
  const t2Name = team2?.name ?? match.team2Placeholder ?? "TBD";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-400">
            {stageLabel(match.stage)}
            {match.groupName && ` · Group ${match.groupName}`}
          </span>
          <div className="flex items-center gap-2">
            {isLive && <Badge variant="live">LIVE</Badge>}
            <span className="text-xs text-gray-400">{formatKickoff(match.matchDatetime)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-5xl">{team1?.flagEmoji ?? "🏳️"}</span>
            <span className="text-sm font-semibold text-center">{t1Name}</span>
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {team1Supporters.map((s) => (
                <span key={s.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {s.name.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center shrink-0">
            {isCompleted || isLive ? (
              <span className="text-3xl font-bold">
                {match.team1Score ?? 0}–{match.team2Score ?? 0}
              </span>
            ) : (
              <span className="text-xl text-gray-400">vs</span>
            )}
            {match.city && <span className="text-xs text-gray-400 mt-1">{match.city}</span>}
          </div>

          <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-5xl">{team2?.flagEmoji ?? "🏳️"}</span>
            <span className="text-sm font-semibold text-center">{t2Name}</span>
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {team2Supporters.map((s) => (
                <span key={s.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {s.name.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          {isLive ? "🔴 Live reactions" : "Reactions"}
        </h2>
        {session ? (
          <ReactionTimeline
            matchId={id}
            reactions={enrichedReactions}
            isLive={isLive}
          />
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
            <Link href="/join" className="text-green-600 font-medium hover:underline">Join the class</Link> to drop reactions
          </div>
        )}
      </section>
    </div>
  );
}
