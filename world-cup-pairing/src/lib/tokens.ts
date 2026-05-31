import { db } from "@/db";
import { students, bets, predictions, matches } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export const STAKE_TOKENS = 10;
export const PREDICTION_CORRECT_TOKENS = 5;
export const PREDICTION_EXACT_TOKENS = 15;
export const PUBLIC_BONUS_TOKENS = 50;
export const EARLY_BIRD_BONUS_TOKENS = 75; // first 20 registrations = 175 total
export const EARLY_BIRD_LIMIT = 20;

export async function settleBetsForMatch(matchId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match || match.status !== "completed") return;
  if (match.team1Score === null || match.team2Score === null) return;

  const unsettledBets = await db
    .select()
    .from(bets)
    .where(and(eq(bets.matchId, matchId), eq(bets.settled, false)));

  for (const bet of unsettledBets) {
    const s1SupportsTeam1 = true; // by construction: student1 always supports team1
    let winnerId: string | null = null;

    if (match.team1Score > match.team2Score) {
      winnerId = bet.student1Id; // team1 won
    } else if (match.team2Score > match.team1Score) {
      winnerId = bet.student2Id; // team2 won
    }
    // draw: winnerId = null, both get stake back

    await db
      .update(bets)
      .set({ settled: true, winnerId })
      .where(eq(bets.id, bet.id));

    if (winnerId) {
      await db
        .update(students)
        .set({
          tokenBalance: db
            .select({ v: students.tokenBalance })
            .from(students)
            .where(eq(students.id, winnerId))
            .$dynamic() as unknown as number,
        })
        .where(eq(students.id, winnerId));

      // Winner gets stake × 2
      await db.execute(
        `UPDATE students SET token_balance = token_balance + ${bet.stakeTokens * 2} WHERE id = '${winnerId}'`
      );
      // Loser has already had their stake deducted at bet creation time
    } else {
      // Draw: refund both
      await db.execute(
        `UPDATE students SET token_balance = token_balance + ${bet.stakeTokens} WHERE id = '${bet.student1Id}'`
      );
      await db.execute(
        `UPDATE students SET token_balance = token_balance + ${bet.stakeTokens} WHERE id = '${bet.student2Id}'`
      );
    }
  }
}

export async function settlePredictionsForMatch(matchId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match || match.status !== "completed") return;
  if (match.team1Score === null || match.team2Score === null) return;

  const unsettled = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.matchId, matchId), isNull(predictions.tokensEarned)));

  for (const pred of unsettled) {
    let earned = 0;

    const actualHome = match.team1Score;
    const actualAway = match.team2Score;
    const predHome = pred.predictedScore1;
    const predAway = pred.predictedScore2;

    const actualWinner =
      actualHome > actualAway ? "home" : actualAway > actualHome ? "away" : "draw";
    const predWinner =
      predHome > predAway ? "home" : predAway > predHome ? "away" : "draw";

    if (actualWinner === predWinner) earned += PREDICTION_CORRECT_TOKENS;
    if (predHome === actualHome && predAway === actualAway)
      earned += PREDICTION_EXACT_TOKENS - PREDICTION_CORRECT_TOKENS; // top-up to 15

    await db
      .update(predictions)
      .set({ tokensEarned: earned })
      .where(eq(predictions.id, pred.id));

    if (earned > 0) {
      await db.execute(
        `UPDATE students SET token_balance = token_balance + ${earned} WHERE id = '${pred.studentId}'`
      );
    }
  }
}
