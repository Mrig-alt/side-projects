"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUISINE_LABELS } from "@/lib/utils";
import type { CuisineType } from "@/db/schema";

const CUISINES = Object.entries(CUISINE_LABELS) as [CuisineType, string][];

export default function NewListingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slotId = searchParams.get("slotId") ?? "";

  const [form, setForm] = useState({
    dishName: "",
    description: "",
    cuisineType: "north_indian" as CuisineType,
    isVeg: true,
    pricePerPortion: "",
    totalQuantity: "",
    photoUrl: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotId,
        ...form,
        pricePerPortion: Number(form.pricePerPortion),
        totalQuantity: Number(form.totalQuantity),
        photoUrl: form.photoUrl || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setErrors(data.error ?? {});
      return;
    }

    router.push(`/slots/${slotId}`);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
          <UtensilsCrossed className="h-6 w-6 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Add a dish</h1>
        <p className="mt-1 text-sm text-gray-500">Tell buyers what you&apos;re cooking.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Dish name</Label>
          <Input
            placeholder="Dal Makhani"
            value={form.dishName}
            onChange={(e) => setForm((f) => ({ ...f, dishName: e.target.value }))}
            error={errors.dishName?.[0]}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Description <span className="font-normal text-gray-400">(optional)</span></Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            placeholder="Slow-cooked overnight with butter and cream..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Cuisine type</Label>
          <select
            className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            value={form.cuisineType}
            onChange={(e) => setForm((f) => ({ ...f, cuisineType: e.target.value as CuisineType }))}
          >
            {CUISINES.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Dietary</Label>
          <div className="flex gap-3">
            {[{ value: true, label: "🟢 Veg" }, { value: false, label: "🔴 Non-veg" }].map(({ value, label }) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setForm((f) => ({ ...f, isVeg: value }))}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  form.isVeg === value
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Price per portion (₹)</Label>
            <Input
              type="number"
              min="1"
              max="9999"
              placeholder="80"
              value={form.pricePerPortion}
              onChange={(e) => setForm((f) => ({ ...f, pricePerPortion: e.target.value }))}
              error={errors.pricePerPortion?.[0]}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Portions available</Label>
            <Input
              type="number"
              min="1"
              max="100"
              placeholder="10"
              value={form.totalQuantity}
              onChange={(e) => setForm((f) => ({ ...f, totalQuantity: e.target.value }))}
              error={errors.totalQuantity?.[0]}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Add dish to slot
        </Button>
      </form>
    </div>
  );
}
