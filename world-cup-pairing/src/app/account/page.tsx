"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import VisibilitySelector from "@/components/profile/VisibilitySelector";
import Link from "next/link";

type Visibility = "public" | "friends" | "stealth";

export default function AccountPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [visibility, setVisibility] = useState<Visibility>((session?.user.visibility as Visibility) ?? "public");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!session) {
    router.push("/join");
    return null;
  }

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${session.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (res.ok) {
        await update({ visibility });
        setSaved(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Account</h1>

      {/* Profile summary */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">{session.user.name}</p>
            <p className="text-sm text-gray-500">{session.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">🪙 {session.user.tokenBalance}</span>
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Privacy mode</h2>
        <VisibilitySelector
          value={visibility}
          onChange={(v) => { setVisibility(v); setSaved(false); }}
        />
        <Button onClick={handleSave} loading={loading} className="w-full">
          {saved ? "✓ Saved" : "Save changes"}
        </Button>
      </div>

      {/* Data export */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-gray-900">Your data</h2>
        <p className="text-sm text-gray-500">Download all your data as JSON (GDPR export).</p>
        <a
          href="/account/export"
          className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Download my data
        </a>
      </div>

      {/* Sign out — always lands on /join, never loops back */}
      <Button
        variant="outline"
        className="w-full text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => signOut({ callbackUrl: "/join" })}
      >
        Sign out
      </Button>
    </div>
  );
}
