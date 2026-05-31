"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import TeamGrid from "@/components/teams/TeamGrid";
import VisibilitySelector from "@/components/profile/VisibilitySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy } from "lucide-react";
import { useEffect } from "react";

type Visibility = "public" | "friends" | "stealth";

interface Team {
  id: string;
  name: string;
  flagEmoji: string;
  countryCode: string;
  group: string | null;
  confederation: string;
  takenBy?: string | null;
}

export default function JoinPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [step, setStep] = useState<"identity" | "team" | "visibility">("identity");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("");
  const [pin, setPin] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentCount, setStudentCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/register")
      .then((r) => r.json())
      .then((d) => {
        setTeams(d.teams ?? []);
        setStudentCount(d.count ?? null);
      });
  }, []);

  const selectedTeam = teams.find((t) => t.id === teamId);
  const isHonoraryFan = selectedTeam ? selectedTeam.group === null : false;
  const tokenPreview = 100 + (visibility === "public" ? 50 : 0);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, nationality, pin, teamId, visibility }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Registration failed");
        return;
      }
      // Sign in after registration
      const result = await signIn("credentials", {
        email,
        pin,
        redirect: false,
      });
      if (result?.ok) {
        router.push("/");
      } else {
        setError("Registered but login failed — please try signing in");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <Trophy className="mx-auto h-10 w-10 text-green-600" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Join IE World Cup 2026</h1>
        {studentCount !== null && (
          <p className="mt-1 text-sm text-gray-500">
            🌍 {studentCount} classmates already joined
          </p>
        )}
      </div>

      {step === "identity" && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Your details</h2>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="María García" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@student.ie.edu" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nationality">Nationality (optional)</Label>
            <Input id="nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Spanish" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pin">Class PIN *</Label>
            <Input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter class PIN" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            className="w-full"
            disabled={!name.trim() || !email.trim() || !pin.trim()}
            onClick={() => setStep("team")}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "team" && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pick your team</h2>
            {selectedTeam && (
              <span className="flex items-center gap-1 text-sm font-medium text-green-700">
                {selectedTeam.flagEmoji} {selectedTeam.name}
                {isHonoraryFan && <span className="text-xs text-blue-500 ml-1">🤝 Honorary</span>}
              </span>
            )}
          </div>
          <TeamGrid
            teams={teams}
            selectedTeamId={teamId}
            onSelect={setTeamId}
          />
          <Button
            className="w-full mt-2"
            disabled={!teamId}
            onClick={() => setStep("visibility")}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "visibility" && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Privacy mode</h2>
          <VisibilitySelector value={visibility} onChange={setVisibility} />
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            You&apos;ll start with <span className="font-bold text-gray-900">🪙 {tokenPreview} tokens</span>
            {visibility === "public" && <span className="text-yellow-600"> (includes +50 public bonus 🎉)</span>}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" onClick={handleSubmit} loading={loading}>
            Join the game 🏆
          </Button>
          <button
            type="button"
            className="w-full text-sm text-gray-400 hover:text-gray-600"
            onClick={() => setStep("team")}
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
