"use client";

import { useSession } from "next-auth/react";
import MatchCard from "./MatchCard";

type MatchCardProps = Parameters<typeof MatchCard>[0];

/**
 * Thin client wrapper around MatchCard.
 * Injects currentUserId + currentUserTeamId from useSession() so that
 * predictions and personalised actions work even when the server-side
 * auth() call returns null (AUTH_SECRET / NEXTAUTH_URL mismatch).
 * All other props come from the server component as usual.
 */
export default function MatchCardClient(props: Omit<MatchCardProps, "currentUserId" | "currentUserTeamId">) {
  const { data: session } = useSession();
  return (
    <MatchCard
      {...props}
      currentUserId={session?.user?.id ?? null}
      currentUserTeamId={session?.user?.teamId ?? null}
    />
  );
}
