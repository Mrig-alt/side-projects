"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  const router = useRouter();
  const { update } = useSession();
  const [form, setForm] = useState({ whatsappNumber: "", upiId: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setErrors(data.error ?? {});
      setLoading(false);
      return;
    }

    // Refresh session so isSellerProfileComplete updates in JWT
    await update({ isSellerProfileComplete: true });
    router.push("/seller/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <ChefHat className="mx-auto mb-3 h-10 w-10 text-orange-500" />
          <h1 className="text-2xl font-bold text-gray-900">Set up seller profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Buyers will use these details to pay and coordinate pickup at the cafeteria.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp number</Label>
            <div className="flex">
              <span className="flex items-center rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">
                +91
              </span>
              <Input
                id="whatsapp"
                placeholder="9876543210"
                value={form.whatsappNumber}
                onChange={(e) => {
                  setForm((f) => ({ ...f, whatsappNumber: e.target.value.replace(/\D/g, "") }));
                  setErrors((err) => ({ ...err, whatsappNumber: [] }));
                }}
                error={errors.whatsappNumber?.[0]}
                className="rounded-l-none"
                maxLength={10}
                inputMode="numeric"
                required
              />
            </div>
            <p className="text-xs text-gray-400">Buyers will message you here after you accept their order.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="upi">UPI ID <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input
              id="upi"
              placeholder="yourname@upi"
              value={form.upiId}
              onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
              error={errors.upiId?.[0]}
            />
            <p className="text-xs text-gray-400">Buyers can pay via UPI before pickup.</p>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Start Selling
          </Button>
        </form>
      </div>
    </div>
  );
}
