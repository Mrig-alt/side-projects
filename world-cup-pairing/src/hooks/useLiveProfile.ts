"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";

export interface LiveProfile {
  tokenBalance: number;
  teamId: string | null;
  visibility: string;
}

/**
 * Returns live DB values for the current user's mutable profile fields.
 * Seeds immediately from the JWT session to avoid a flash of stale/zero values,
 * then overwrites with a fresh DB fetch from /api/students/me.
 * Re-fetches whenever the 'token-refresh' CustomEvent is fired.
 */
export function useLiveProfile(): LiveProfile | null {
  const { data: session } = useSession();

  const [profile, setProfile] = useState<LiveProfile | null>(
    session?.user
      ? {
          tokenBalance: session.user.tokenBalance ?? 0,
          teamId: session.user.teamId ?? null,
          visibility: session.user.visibility ?? "public",
        }
      : null
  );

  const fetchProfile = useCallback(() => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    fetch("/api/students/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setProfile({
            tokenBalance: d.tokenBalance ?? 0,
            teamId: d.teamId ?? null,
            visibility: d.visibility ?? "public",
          });
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // Fetch on mount and when the user id changes
  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Re-fetch after any prediction / bet fires token-refresh
  useEffect(() => {
    window.addEventListener("token-refresh", fetchProfile);
    return () => window.removeEventListener("token-refresh", fetchProfile);
  }, [fetchProfile]);

  // Keep the seed in sync if the session object itself updates
  useEffect(() => {
    if (session?.user && profile === null) {
      setProfile({
        tokenBalance: session.user.tokenBalance ?? 0,
        teamId: session.user.teamId ?? null,
        visibility: session.user.visibility ?? "public",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  return profile;
}
