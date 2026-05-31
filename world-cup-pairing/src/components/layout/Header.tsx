import Link from "next/link";
import { auth } from "@/lib/auth";
import { Trophy, Coins } from "lucide-react";

export default async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
          <Trophy className="h-5 w-5 text-green-600" />
          <span className="hidden sm:inline">IE World Cup 2026</span>
          <span className="sm:hidden">WC 2026</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <Link href="/schedule" className="hover:text-gray-900 transition-colors">Schedule</Link>
          <Link href="/students" className="hover:text-gray-900 transition-colors">Classmates</Link>
          <Link href="/leaderboard" className="hover:text-gray-900 transition-colors">Leaderboard</Link>
          <Link href="/feed" className="hover:text-gray-900 transition-colors">Feed</Link>
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <Link href="/account" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900">
                <Coins className="h-4 w-4 text-yellow-500" />
                <span>{session.user.tokenBalance ?? 0}</span>
              </Link>
              <Link href="/account" className="text-sm font-medium text-gray-600 hover:text-gray-900 truncate max-w-[100px]">
                {session.user.name?.split(" ")[0]}
              </Link>
            </>
          ) : (
            <Link href="/join" className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors">
              Join
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
