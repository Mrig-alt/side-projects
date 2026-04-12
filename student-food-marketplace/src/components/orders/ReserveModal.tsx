"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import type { Listing } from "@/db/schema";

interface ReserveModalProps {
  listing: Listing;
  currentQty: number;
  slotDate?: string;
  onClose: () => void;
  onSuccess: (qty: number) => void;
}

export function ReserveModal({ listing, currentQty, onClose, onSuccess }: ReserveModalProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const max = Math.min(currentQty, 5);

  async function handleReserve() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id, quantity }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Reservation failed");
      return;
    }

    onSuccess(quantity);
    onClose();
    router.push("/buyer/orders");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reserve {listing.dishName}</DialogTitle>
          <DialogDescription>
            {formatPrice(listing.pricePerPortion)} per portion &middot; {currentQty} left
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="py-4">
          <p className="mb-3 text-sm font-medium text-gray-700">How many portions?</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-2xl font-bold text-gray-900">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(max, q + 1))}
              disabled={quantity >= max}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div>
            <p className="text-sm text-gray-500">Total to pay at pickup</p>
            <p className="text-xl font-bold text-gray-900">
              {formatPrice(listing.pricePerPortion * quantity)}
            </p>
          </div>
          <Button onClick={handleReserve} loading={loading} size="lg">
            Reserve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
