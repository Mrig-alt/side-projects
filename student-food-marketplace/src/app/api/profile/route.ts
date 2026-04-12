import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { onboardingSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      whatsappNumber: users.whatsappNumber,
      upiId: users.upiId,
      isSellerProfileComplete: users.isSellerProfileComplete,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });
  return Response.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { whatsappNumber, upiId } = parsed.data;

  await db
    .update(users)
    .set({
      whatsappNumber,
      upiId: upiId || null,
      isSellerProfileComplete: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return Response.json({ success: true });
}
