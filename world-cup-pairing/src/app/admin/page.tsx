import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { students, teams } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // FIX: auth via session cookie instead of URL query param.
  // The old ?key= approach leaked the secret to server logs, browser history,
  // and Referer headers on every outbound link click.
  const session = await auth();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!session?.user?.id || !adminEmail || session.user.email !== adminEmail) {
    redirect("/");
  }

  const rows = await db
    .select({
      id: students.id, name: students.name, email: students.email,
      nationality: students.nationality, visibility: students.visibility,
      tokenBalance: students.tokenBalance, isHonoraryFan: students.isHonoraryFan,
      flagged: students.flagged, createdAt: students.createdAt,
      teamName: teams.name, teamFlag: teams.flagEmoji,
    })
    .from(students)
    .leftJoin(teams, eq(students.teamId, teams.id))
    .orderBy(desc(students.createdAt));

  const countryCount = rows.reduce<Record<string, number>>((acc, s) => {
    const k = s.teamName ?? "No team";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(countryCount).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        {/* FIX: export link now goes to session-authenticated endpoint */}
        <Link
          href="/api/admin/export"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          download
        >
          Export CSV
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
          <p className="text-3xl font-bold text-green-600">{rows.length}</p>
          <p className="text-sm text-gray-500">Total students</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
          <p className="text-3xl font-bold text-blue-600">{sorted.length}</p>
          <p className="text-sm text-gray-500">Countries</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-center">
          <p className="text-3xl font-bold text-yellow-600">{rows.filter((r) => r.flagged).length}</p>
          <p className="text-sm text-gray-500">Flagged</p>
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Teams / Countries</h2>
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-2 text-left">Team</th><th className="px-4 py-2 text-right">Count</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map(([name, count]) => (
                <tr key={name}><td className="px-4 py-2 text-gray-700">{name}</td><td className="px-4 py-2 text-right font-medium">{count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">All Students</h2>
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-left">Mode</th>
                <th className="px-3 py-2 text-right">Tokens</th>
                <th className="px-3 py-2 text-left">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((s) => (
                <tr key={s.id} className={s.flagged ? "bg-red-50" : ""}>
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{s.name}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{s.email}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{s.teamFlag} {s.teamName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.visibility === "public" ? "bg-green-100 text-green-700" :
                      s.visibility === "friends" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{s.visibility}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{s.tokenBalance}</td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
