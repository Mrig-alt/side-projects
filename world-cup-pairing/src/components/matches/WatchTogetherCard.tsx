"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "next-auth/react";

type Location = {
  locationName: string;
  locationUrl: string | null;
  people: string[];
};

export default function WatchTogetherCard({ matchId }: { matchId: string }) {
  const { data: session } = useSession();
  const [locations, setLocations] = useState<Location[]>([]);
  const [showing, setShowing] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [myLocation, setMyLocation] = useState<string | null>(null);

  const fetchLocations = async () => {
    const res = await fetch(`/api/watch-together?matchId=${matchId}`);
    const data = await res.json();
    setLocations(data.locations ?? []);
    // Check if I already posted
    if (session) {
      const mine = (data.locations ?? []).find((l: Location) =>
        l.people.includes(session.user.name)
      );
      setMyLocation(mine?.locationName ?? null);
    }
  };

  useEffect(() => { fetchLocations(); }, [matchId]);

  const handlePost = async () => {
    setLoading(true);
    await fetch("/api/watch-together", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, locationName, locationUrl }),
    });
    setLocationName("");
    setLocationUrl("");
    setShowing(false);
    fetchLocations();
    setLoading(false);
  };

  const handleRemove = async () => {
    await fetch(`/api/watch-together?matchId=${matchId}`, { method: "DELETE" });
    setMyLocation(null);
    fetchLocations();
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-green-600" />
          Watching together
        </h3>
        {session && !myLocation && (
          <Button size="sm" variant="outline" onClick={() => setShowing(!showing)}>
            <Plus className="h-3 w-3 mr-1" /> Add location
          </Button>
        )}
        {session && myLocation && (
          <button onClick={handleRemove} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
            <X className="h-3 w-3" /> Remove mine
          </button>
        )}
      </div>

      {showing && (
        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
          <div className="grid gap-1">
            <Label className="text-xs">Location name *</Label>
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. The Irish Rover, Madrid"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Google Maps link (optional)</Label>
            <Input
              value={locationUrl}
              onChange={(e) => setLocationUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
              className="h-8 text-sm"
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!locationName.trim() || loading}
            onClick={handlePost}
          >
            {loading ? "Saving..." : "I&apos;m watching here"}
          </Button>
        </div>
      )}

      {locations.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">Nobody&apos;s posted a watch location yet</p>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <div key={loc.locationName} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {loc.locationUrl ? (
                    <a
                      href={loc.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm text-green-700 hover:underline truncate"
                    >
                      {loc.locationName}
                    </a>
                  ) : (
                    <span className="font-medium text-sm text-gray-800">{loc.locationName}</span>
                  )}
                  <span className="text-xs text-gray-400 shrink-0">{loc.people.length} going</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{loc.people.join(", ")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
