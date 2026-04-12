import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { registerSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const lowerEmail = email.toLowerCase();

  // Check existing user
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, lowerEmail))
    .limit(1);

  if (existing) {
    return Response.json(
      { error: { email: ["An account with this email already exists"] } },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.insert(users).values({
    name,
    email: lowerEmail,
    passwordHash,
  });

  return Response.json({ success: true }, { status: 201 });
}
