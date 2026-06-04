"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import TeamGrid from "@/components/teams/TeamGrid";
import VisibilitySelector from "@/components/profile/VisibilitySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Loader2, CheckCircle2 } from "lucide-react";

type Visibility = "public" | "friends" | "stealth";
type Mode = "checking" | "returning" | "new" | "idle";

interface Team {
  id: string;
  name: string;
  flagEmoji: string;
  countryCode: string;
  group: string | null;
  confederation: string;
  takenBy?: string | null;
}

function formatError(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const msgs = Object.entries(error)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
      .join(", ");
    return msgs || "Registration failed — please check your details";
  }
  return "Registration failed";
}

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?next= lets any page send the user back after login (e.g. /matches/abc)
  const next = searchParams.get("next") ?? "/";

  const [teams, setTeams] = useState<Team[]>([]);
  const [step, setStep] = useState<"identity" | "team" | "visibility">("identity");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<Mode>("idle");
  const [firstName, setFirstName] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [studentCount, setStudentCount] = useState<number | null>(null);

  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    fetch("/api/register")
      .then((r) => r.json())
      .then((d) => {
        setTeams(d.teams ?? []);
        setStudentCount(d.count ?? null);
        setPinRequired(!!d.pinRequired);
      });
  }, []);

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const trimmed = email.trim();
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setMode("idle");
      setFirstName(null);
      return;
    }
    setMode("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-email?email=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setMode(data.exists ? "returning" : "new");
        setFirstName(data.firstName ?? null);
      } catch {
        setMode("idle");
      }
    }, 600);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [email]);

  const selectedTeam = teams.find((t) => t.id === teamId);
  const isHonoraryFan = selectedTeam ? selectedTeam.group === null : false;
  const tokenPreview = 100 + (visibility === "public" ? 50 : 0);

  const handleSignIn = async () => {
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      pin: pin || "",
      redirect: false,
    });
    setLoading(false);
    if (result?.ok) {
      // Go back to wherever the user came from, or home
      router.push(next);
    } else {
      setError(pinRequired ? "Wrong PIN — ask whoever set up the app for the class PIN." : "Sign in failed — please try again.");
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email.trim().toLowerCase(),
          nationality: nationality.trim() || undefined,
          ...(pinRequired && pin ? { pin } : {}),
          teamId: teamId || undefined,
          isHonoraryFan,
          visibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(formatError(data.error)); return; }
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        pin: pin || "",
        redirect: false,
      });
      if (result?.ok) router.push(next);
      else setError("Registered! But auto-login failed — try signing in again.");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <Trophy className="mx-auto h-10 w-10 text-green-600" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900">IE World Cup 2026</h1>
        {studentCount !== null && (
          <p className="mt-1 text-sm text-gray-500">🌍 {studentCount} classmates already joined</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Your email</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="maria@student.ie.edu"
              className="pr-8"
              autoComplete="email"
            />
            {mode === "checking" && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-400" />
            )}
            {mode === "returning" && (
              <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-green-500" />
            )}
          </div>
        </div>

        {/* RETURNING USER */}
        {mode === "returning" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-800">
                👋 Welcome back{firstName ? `, ${firstName}` : ""}!
                {pinRequired ? " Enter the class PIN to continue." : " Click below to sign in."}
              </p>
            </div>
            {pinRequired && (
              <div className="grid gap-1.5">
                <Label htmlFor="pin-return">Class PIN</Label>
                <Input
                  id="pin-return"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter class PIN"
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                />
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button className="w-full" disabled={loading} onClick={handleSignIn}>
              {loading ? "Signing in..." : "Sign in →"}
            </Button>
          </div>
        )}

        {/* NEW USER — step 1 */}
        {mode === "new" && step === "identity" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">New here — let&apos;s get you set up 🎉</p>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Full name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="María García"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nationality">Nationality (optional)</Label>
              <Input
                id="nationality"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="Spanish"
              />
            </div>
            {pinRequired && (
              <div className="grid gap-1.5">
                <Label htmlFor="pin-new">Class PIN *</Label>
                <Input
                  id="pin-new"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter class PIN"
                />
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              className="w-full"
              disabled={!name.trim() || (pinRequired && !pin.trim())}
              onClick={() => setStep("team")}
            >
              Continue → Pick your team
            </Button>
          </div>
        )}
      </div>

      {/* NEW USER — step 2: pick team */}
      {mode === "new" && step === "team" && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Pick your team</h2>
              <p className="text-xs text-gray-400 mt-0.5">Optional — you can skip and set it later</p>
            </div>
            {selectedTeam && (
              <span className="flex items-center gap-1 text-sm font-medium text-green-700">
                {selectedTeam.flagEmoji} {selectedTeam.name}
                {isHonoraryFan && <span className="text-xs text-blue-500 ml-1">🤝 Honorary</span>}
              </span>
            )}
          </div>
          <TeamGrid teams={teams} selectedTeamId={teamId} onSelect={setTeamId} />
          <div className="flex flex-col gap-2 mt-2">
            <Button className="w-full" onClick={() => setStep("visibility")}>
              {teamId ? "Continue →" : "Continue without a team →"}
            </Button>
            {teamId && (
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600 text-center"
                onClick={() => { setTeamId(null); }}
              >
                Clear selection
              </button>
            )}
          </div>
        </div>
      )}

      {/* NEW USER — step 3: privacy */}
      {mode === "new" && step === "visibility" && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Privacy mode</h2>
          <VisibilitySelector value={visibility} onChange={setVisibility} />
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            You&apos;ll start with <span className="font-bold text-gray-900">🪙 {tokenPreview} tokens</span>
            {visibility === "public" && <span className="text-yellow-600"> (includes +50 public bonus 🎉)</span>}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" onClick={handleRegister} disabled={loading}>
            {loading ? "Joining..." : "Join the game 🏆"}
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
