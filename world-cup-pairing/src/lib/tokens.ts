import { db } from "@/db";
import { students, bets, predictions, matches } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export const STAKE_TOKENS = 10;
export const PREDICTION_CORRECT_TOKENS = 5;
export const PREDICTION_EXACT_TOKENS = 15;
export const PUBLIC_BONUS_TOKENS = 50;
export const EARLY_BIRD_BONUS_TOKENS = 75;
export const EARLY_BIRD_LIMIT = 20;

export async function settleBetsForMatch(matchId: string) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match || match.status !== "completed") return;
  if (match.team1Score === null || match.team2Score === null) return;

  const unsettledBets = await db
    .select()
    .from(bets)
    .where(and(eq(bets.matchId, matchId), eq(bets.settled, false)));

  for (const bet of unsettledBets) {
    let winnerId: string | null = null;
    if (match.team1Score > match.team2Score) {
      winnerId = bet.student1Id;
    } else if (match.team2Score > match.team1Score) {
      winnerId = bet.student2Id;
    }

    await db.update(bets).set({ settled: true, winnerId }).where(eq(bets.id, bet.id));

    if (winnerId) {
      // FIX: use parameterised sql`` expression — no raw string interpolation
      await db
        .update(students)
        .set({ tokenBalance: sql`${students.tokenBalance} + ${bet.stakeTokens * 2}` })
        .where(eq(students.id, winnerId));
    } else {
      // Draw: refund both
      await db
        .update(students)
        .set({ tokenBalance: sql`${students.tokenBalance} + ${bet.stakeTokens}` })
        .where(eq(students.id, bet.student1Id));
      await db
        .update(students)
        .set({ tokenBalance: sql`${students.tokenBalance} + ${bet.stakeTokens}` })
        .where(eq(students.id, bet.student2Id));
    }
  }
}

export async function settlePredictionsForMatch(matchId: string) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match || match.status !== "completed") return;
  if (match.team1Score === null || match.team2Score === null) return;

  const unsettled = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.matchId, matchId), isNull(predictions.tokensEarned)));

  for (const pred of unsettled) {
    let earned = 0;
    const actualWinner =
      match.team1Score > match.team2Score ? "home" : match.team2Score > match.team1Score ? "away" : "draw";
    const predWinner =
      pred.predictedScore1 > pred.predictedScore2 ? "home" : pred.predictedScore2 > pred.predictedScore1 ? "away" : "draw";

    if (actualWinner === predWinner) earned += PREDICTION_CORRECT_TOKENS;
    if (pred.predictedScore1 === match.team1Score && pred.predictedScore2 === match.team2Score)
      earned += PREDICTION_EXACT_TOKENS - PREDICTION_CORRECT_TOKENS;

    await db.update(predictions).set({ tokensEarned: earned }).where(eq(predictions.id, pred.id));

    if (earned > 0) {
      // FIX: parameterised update
      await db
        .update(students)
        .set({ tokenBalance: sql`${students.tokenBalance} + ${earned}` })
        .where(eq(students.id, pred.studentId));
    }
  }
}
