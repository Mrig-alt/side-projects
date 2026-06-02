import { db } from "@/db";
import { teams, students } from "@/db/schema";
import { eq } from "drizzle-orm";
import EliminationCard from "@/components/feed/EliminationCard";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const eliminatedTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      flagEmoji: teams.flagEmoji,
      countryCode: teams.countryCode,
    })
    .from(teams)
    .where(eq(teams.isEliminated, true));

  const allStudents = await db
    .select({ id: students.id, name: students.name, teamId: students.teamId })
    .from(students)
    .where(eq(students.flagged, false));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Elimination Feed</h1>
        <p className="text-sm text-gray-500 mt-1">Teams knocked out — and the classmates rooting for them</p>
      </div>

      {eliminatedTeams.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-medium">No eliminations yet</p>
          <p className="text-sm mt-1">Check back once the tournament starts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eliminatedTeams.map((team) => {
            const supporters = allStudents.filter((s) => s.teamId === team.id);
            return (
              <EliminationCard
                key={team.id}
                team={team}
                students={supporters}
                eliminatedInStage="group"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
