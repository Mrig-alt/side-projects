import { NextResponse } from "next/server";

// FIX: debug route removed — was leaking DATABASE_URL prefix, env var names,
// and live query results to unauthenticated callers in production.
// If you need a health check, add a proper /api/health endpoint with no sensitive data.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
