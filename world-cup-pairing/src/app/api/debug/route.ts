import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  results.DATABASE_URL_set = !!process.env.DATABASE_URL;
  results.NEXTAUTH_SECRET_set = !!process.env.NEXTAUTH_SECRET;
  results.AUTH_SECRET_set = !!process.env.AUTH_SECRET;
  results.JOIN_PIN_set = !!process.env.JOIN_PIN;
  results.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "(not set)";

  if (process.env.DATABASE_URL) {
    try {
      const sql = postgres(process.env.DATABASE_URL, {
        prepare: false,
        max: 1,
        ssl: "require",
        connect_timeout: 10,
      });
      const rows = await sql`SELECT COUNT(*) as count FROM teams`;
      results.db_teams_count = rows[0]?.count;
      results.db_connected = true;
      await sql.end();
    } catch (e) {
      results.db_connected = false;
      results.db_error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(results);
}
