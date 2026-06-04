import type { NextAuthConfig } from "next-auth";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";

export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 180 },
  pages: { signIn: "/join" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: seed from the user object
        token.id = user.id as string;
        token.sub = user.id as string;
        token.teamId = (user as { teamId?: string | null }).teamId ?? null;
        token.visibility = (user as { visibility?: string }).visibility ?? "public";
        token.tokenBalance = (user as { tokenBalance?: number }).tokenBalance ?? 100;
      } else if (token.id) {
        // FIX: every subsequent request — refresh mutable fields from DB
        // so tokenBalance / teamId stay in sync without requiring re-login
        try {
          const [fresh] = await db
            .select({ tokenBalance: students.tokenBalance, teamId: students.teamId, visibility: students.visibility })
            .from(students)
            .where(eq(students.id, token.id as string))
            .limit(1);
          if (fresh) {
            token.tokenBalance = fresh.tokenBalance;
            token.teamId = fresh.teamId;
            token.visibility = fresh.visibility;
          }
        } catch {
          // DB unavailable — keep stale values rather than breaking auth
        }
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
