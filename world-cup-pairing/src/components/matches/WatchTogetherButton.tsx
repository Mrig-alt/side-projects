"use client";

import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WatchTogetherButtonProps {
  matchId: string;
  existingInvite?: { locationName: string; locationUrl?: string | null } | null;
}

export default function WatchTogetherButton({ matchId, existingInvite }: WatchTogetherButtonProps) {
  const [open, setOpen] = useState(false);
  const [locationName, setLocationName] = useState(existingInvite?.locationName ?? "");
  const [locationUrl, setLocationUrl] = useState(existingInvite?.locationUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(!!existingInvite);

  const handleSave = async () => {
    if (!locationName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/watch-together", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, locationName: locationName.trim(), locationUrl: locationUrl.trim() || undefined }),
      });
      if (res.ok) {
        setSaved(true);
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await fetch(`/api/watch-together?matchId=${matchId}`, { method: "DELETE" });
      setSaved(false);
      setLocationName("");
      setLocationUrl("");
    } finally {
      setLoading(false);
    }
  };

  if (saved && existingInvite) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5">
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="truncate">Watching at {locationName || existingInvite.locationName}</span>
        <button onClick={handleRemove} disabled={loading} className="ml-auto shrink-0 text-blue-400 hover:text-blue-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <MapPin className="h-4 w-4" />
        Watch together?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>📍 Watch together</DialogTitle>
            <DialogDescription>Let your paired opponents know where you&apos;re watching from.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="loc-name">Location *</Label>
              <Input
                id="loc-name"
                placeholder="e.g. Bar XYZ, Calle Mayor"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="loc-url">Map link (optional)</Label>
              <Input
                id="loc-url"
                type="url"
                placeholder="Google Maps / Apple Maps / Waze URL"
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} loading={loading} disabled={!locationName.trim()}>
              Save location
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
