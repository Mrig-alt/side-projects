import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { students, teams } from "@/db/schema";
import { eq } from "drizzle-orm";

function isAdmin(email: string | undefined) {
  const adminEmail = process.env.ADMIN_EMAIL;
  return !!adminEmail && email === adminEmail;
}

// FIX #10: GET now uses session auth (same ADMIN_EMAIL gate as the page +
// /api/admin/moderate) instead of a Bearer token that leaks in server logs.
// The old PATCH is removed — moderation lives at /api/admin/moderate instead.
export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
