import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 180 }, // 6 months
  pages: {
    signIn: "/join",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.sub = user.id as string;
        token.teamId = (user as { teamId?: string | null }).teamId ?? null;
        token.visibility = (user as { visibility?: string }).visibility ?? "public";
        token.tokenBalance = (user as { tokenBalance?: number }).tokenBalance ?? 100;
      }
      return token;
    },
    async session({ session, token }) {
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
