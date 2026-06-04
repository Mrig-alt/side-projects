"use client";

import { useSession } from "next-auth/react";
import { useLiveProfile } from "@/hooks/useLiveProfile";
import MatchCard from "./MatchCard";

type MatchCardProps = Parameters<typeof MatchCard>[0];

/**
 * Thin client wrapper around MatchCard.
 * Injects currentUserId + currentUserTeamId from live DB profile
 * so predictions and personalised actions are never stale.
 */
export default function MatchCardClient(props: Omit<MatchCardProps, "currentUserId" | "currentUserTeamId">) {
  const { data: session } = useSession();
  const profile = useLiveProfile();

  return (
    <MatchCard
      {...props}
      currentUserId={session?.user?.id ?? null}
      currentUserTeamId={profile?.teamId ?? null}
    />
  );
}
