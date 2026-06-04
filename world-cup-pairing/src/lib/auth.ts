import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loginSchema } from "./validations";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Required for Render: server runs on localhost:10000 internally but
  // receives requests forwarded from the public hostname.
  // trustHost tells NextAuth v5 to trust the Host header from the proxy.
  trustHost: true,
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

        if (!student || student.flagged) return null;

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
    // Extend the base jwt callback from authConfig with the DB-refresh logic.
    // This runs in the Node.js runtime only (auth.ts is never imported by middleware).
    async jwt(params) {
      // Run the base callback first (seeds token on sign-in, populates email)
      const token = await (authConfig.callbacks!.jwt as NonNullable<typeof authConfig.callbacks>["jwt"])!(params);

      // On every request AFTER initial sign-in, refresh mutable fields from DB
      // so tokenBalance / teamId stay live without requiring re-login.
      if (!params.user && token?.id) {
        try {
          const [fresh] = await db
            .select({
              tokenBalance: students.tokenBalance,
              teamId: students.teamId,
              visibility: students.visibility,
            })
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
    // session callback is inherited from authConfig via spread above;
    // NextAuth merges callbacks so we only need to override jwt here.
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
      email: string;   // FIX: was missing — needed for admin email check
      name: string;
      teamId: string | null;
      visibility: string;
      tokenBalance: number;
    };
  }
}
