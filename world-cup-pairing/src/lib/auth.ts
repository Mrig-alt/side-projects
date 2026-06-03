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
  // receives requests forwarded from wc-syeo.onrender.com.
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
