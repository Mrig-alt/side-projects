"use client";

import { formatKickoff, stageLabel } from "@/lib/utils";
import type { MatchStage } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ShareButton from "./ShareButton";
import WatchTogetherButton from "./WatchTogetherButton";
import PredictionForm from "./PredictionForm";
import PresenceDot from "@/components/students/PresenceDot";
import Link from "next/link";
import { MapPin } from "lucide-react";

interface Supporter {
  id: string;
  name: string;
  lastSeenAt: Date | null;
  watchInvite?: { locationName: string; locationUrl: string | null } | null;
}

interface MatchCardProps {
  match: {
    id: string;
    matchDatetime: Date;
    status: "upcoming" | "live" | "completed";
    stage: MatchStage;
    groupName: string | null;
    team1Score: number | null;
    team2Score: number | null;
    venue: string | null;
    city: string | null;
    team1: { id: string; name: string; flagEmoji: string } | null;
    team2: { id: string; name: string; flagEmoji: string } | null;
    team1Placeholder: string | null;
    team2Placeholder: string | null;
  };
  team1Supporters: Supporter[];
  team2Supporters: Supporter[];
  currentUserId?: string | null;
  currentUserTeamId?: string | null;
  prediction?: { predictedScore1: number; predictedScore2: number } | null;
  myWatchInvite?: { locationName: string; locationUrl: string | null } | null;
  opponentWatchInvite?: { locationName: string; locationUrl: string | null; inviterName: string } | null;
}

export default function MatchCard({
  match,
  team1Supporters,
  team2Supporters,
  currentUserId,
  currentUserTeamId,
  prediction,
  myWatchInvite,
  opponentWatchInvite,
}: MatchCardProps) {
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const isUpcoming = match.status === "upcoming";
  const isFriendly = match.stage === "friendly";

  const myTeamSide =
    currentUserTeamId === match.team1?.id
      ? "team1"
      : currentUserTeamId === match.team2?.id
      ? "team2"
      : null;

  const myTeam = myTeamSide === "team1" ? match.team1 : myTeamSide === "team2" ? match.team2 : null;
  const predictionStr = prediction
    ? `${prediction.predictedScore1}–${prediction.predictedScore2}`
    : undefined;

  const t1Name = match.team1?.name ?? match.team1Placeholder ?? "TBD";
  const t2Name = match.team2?.name ?? match.team2Placeholder ?? "TBD";
  const t1Flag = match.team1?.flagEmoji ?? "🏳️";
  const t2Flag = match.team2?.flagEmoji ?? "🏳️";

  return (
    <Card className={isLive ? "ring-2 ring-red-400" : ""}>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {isFriendly ? "Friendly" : stageLabel(match.stage)}
              {match.groupName && ` · Group ${match.groupName}`}
            </span>
            {isLive && <Badge variant="live">LIVE</Badge>}
            {isFriendly && <Badge variant="friendly">Practice</Badge>}
          </div>
          <span className="text-xs text-gray-400">{formatKickoff(match.matchDatetime)}</span>
        </div>

        {/* Scoreline / teams */}
        <Link href={`/matches/${match.id}`} className="block hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-between gap-3">
            <TeamSide flag={t1Flag} name={t1Name} supporters={team1Supporters} highlight={myTeamSide === "team1"} />

            <div className="flex flex-col items-center shrink-0 min-w-[56px]">
              {isCompleted || isLive ? (
                <span className="text-xl font-bold text-gray-900">
                  {match.team1Score ?? 0}–{match.team2Score ?? 0}
                </span>
              ) : (
                <span className="text-sm font-medium text-gray-400">vs</span>
              )}
              {match.city && (
                <span className="text-[10px] text-gray-400 text-center leading-tight">{match.city}</span>
              )}
            </div>

            <TeamSide flag={t2Flag} name={t2Name} supporters={team2Supporters} highlight={myTeamSide === "team2"} right />
          </div>
        </Link>

        {/* Watch together nudge from opponent */}
        {opponentWatchInvite && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">{opponentWatchInvite.inviterName}</span> is watching at{" "}
              {opponentWatchInvite.locationUrl ? (
                <a href={opponentWatchInvite.locationUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {opponentWatchInvite.locationName}
                </a>
              ) : (
                opponentWatchInvite.locationName
              )}
            </span>
          </div>
        )}

        {/* Actions */}
        {currentUserId && isUpcoming && (
          <div className="mt-3 space-y-2">
            {match.team1 && match.team2 && (
              <PredictionForm
                matchId={match.id}
                team1={match.team1}
                team2={match.team2}
                existing={prediction}
                locked={false}
              />
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {myTeamSide && (
                <WatchTogetherButton matchId={match.id} existingInvite={myWatchInvite} />
              )}
              {match.team1 && match.team2 && (
                <ShareButton
                  matchId={match.id}
                  team1={match.team1}
                  team2={match.team2}
                  myTeam={myTeam}
                  prediction={predictionStr}
                />
              )}
            </div>
          </div>
        )}

        {currentUserId && isCompleted && match.team1 && match.team2 && (
          <div className="mt-2 flex justify-end">
            <ShareButton
              matchId={match.id}
              team1={match.team1}
              team2={match.team2}
              myTeam={myTeam}
              prediction={predictionStr}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamSide({
  flag,
  name,
  supporters,
  highlight,
  right,
}: {
  flag: string;
  name: string;
  supporters: Supporter[];
  highlight?: boolean;
  right?: boolean;
}) {
  return (
    <div className={`flex flex-col ${right ? "items-end" : "items-start"} gap-1 flex-1 min-w-0`}>
      <div className={`flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <span className="text-2xl">{flag}</span>
        <span className={`text-sm font-semibold truncate ${highlight ? "text-green-700" : "text-gray-900"}`}>
          {name}
        </span>
      </div>
      {supporters.length > 0 && (
        <div className={`flex flex-wrap gap-1 ${right ? "justify-end" : ""}`}>
          {supporters.slice(0, 3).map((s) => (
            <span key={s.id} className="flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {s.name.split(" ")[0]}
              <PresenceDot lastSeenAt={s.lastSeenAt} />
            </span>
          ))}
          {supporters.length > 3 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              +{supporters.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
