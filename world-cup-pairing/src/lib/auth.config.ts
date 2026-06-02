import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no database imports.
 * Used by the proxy/middleware (Edge runtime) and spread into the full
 * config in auth.ts (Node runtime, where the Credentials provider lives).
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/join",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.teamId = (user as { teamId?: string | null }).teamId ?? null;
        token.visibility = (user as { visibility?: string }).visibility ?? "public";
        token.tokenBalance = (user as { tokenBalance?: number }).tokenBalance ?? 100;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.teamId = token.teamId as string | null;
        session.user.visibility = token.visibility as string;
        session.user.tokenBalance = token.tokenBalance as number;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
