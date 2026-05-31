import { NextResponse } from "next/server";
import { db } from "@/db";
import { students, teams } from "@/db/schema";
import { eq } from "drizzle-orm";

function checkAdmin(req: Request) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      email: students.email,
      nationality: students.nationality,
      visibility: students.visibility,
      tokenBalance: students.tokenBalance,
      isHonoraryFan: students.isHonoraryFan,
      flagged: students.flagged,
      createdAt: students.createdAt,
      teamName: teams.name,
      teamFlag: teams.flagEmoji,
    })
    .from(students)
    .leftJoin(teams, eq(students.teamId, teams.id))
    .orderBy(students.createdAt);

  const { searchParams } = new URL(req.url);
  if (searchParams.get("format") === "csv") {
    const header = "id,name,email,nationality,team,visibility,tokens,honorary,flagged,joined\n";
    const csv =
      header +
      rows
        .map(
          (r) =>
            `"${r.id}","${r.name}","${r.email}","${r.nationality ?? ""}","${r.teamName ?? ""}","${r.visibility}",${r.tokenBalance},${r.isHonoraryFan},${r.flagged},"${r.createdAt.toISOString()}"`
        )
        .join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="students-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ students: rows });
}

export async function PATCH(req: Request) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, teamId, visibility, flagged } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Partial<typeof students.$inferInsert> = {};
  if (teamId !== undefined) update.teamId = teamId;
  if (visibility !== undefined) update.visibility = visibility;
  if (flagged !== undefined) update.flagged = flagged;

  const [updated] = await db.update(students).set(update).where(eq(students.id, id)).returning();
  return NextResponse.json({ student: updated });
}
