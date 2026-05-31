import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loginSchema } from "./validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        pin: { label: "Class PIN", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, pin } = parsed.data;

        if (pin !== process.env.JOIN_PIN) return null;

        const [student] = await db
          .select()
          .from(students)
          .where(eq(students.email, email.toLowerCase()))
          .limit(1);

        if (!student) return null;
        if (student.flagged) return null;

        return {
          id: student.id,
          email: student.email,
          name: student.name,
          teamId: student.teamId,
          visibility: student.visibility,
          tokenBalance: student.tokenBalance,
        };
      },
    }),
  ],
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
  pages: {
    signIn: "/join",
  },
});

declare module "next-auth" {
  interface User {
    teamId?: string | null;
    visibility?: string;
    tokenBalance?: number;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      teamId: string | null;
      visibility: string;
      tokenBalance: number;
    };
  }
}
