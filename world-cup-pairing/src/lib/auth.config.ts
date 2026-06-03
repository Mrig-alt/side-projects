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
        // Explicitly store id on token (token.sub is set by NextAuth but we mirror it)
        token.id = user.id as string;
        token.sub = user.id as string;
        token.teamId = (user as { teamId?: string | null }).teamId ?? null;
        token.visibility = (user as { visibility?: string }).visibility ?? "public";
        token.tokenBalance = (user as { tokenBalance?: number }).tokenBalance ?? 100;
      }
      return token;
    },
    async session({ session, token }) {
      // token.sub is the canonical NextAuth v5 user id field
      const userId = (token.id ?? token.sub) as string | undefined;
      if (session?.user && userId) {
        session.user.id = userId;
        session.user.teamId = (token.teamId as string | null) ?? null;
        session.user.visibility = (token.visibility as string) ?? "public";
        session.user.tokenBalance = (token.tokenBalance as number) ?? 100;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
