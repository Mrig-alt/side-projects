import { NextResponse } from "next/server";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";

// GET /api/venues — returns all curated venues + user's custom ones
export async function GET() {
  const rows = await db
    .select()
    .from(venues)
    .where(eq(venues.isCustom, false))
    .orderBy(venues.area, venues.name);
  return NextResponse.json({ venues: rows });
}

// POST /api/venues — add a custom venue (user-submitted, not in curated list)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, address, mapsUrl } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const [venue] = await db
    .insert(venues)
    .values({
      name: name.trim(),
      address: address?.trim() || null,
      mapsUrl: mapsUrl?.trim() || null,
      isCustom: true,
      addedBy: session.user.id,
    })
    .returning();

  return NextResponse.json({ venue });
}
