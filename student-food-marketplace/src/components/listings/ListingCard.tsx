"use client";

import Image from "next/image";
import { useState } from "react";
import { formatPrice, CUISINE_LABELS } from "@/lib/utils";
import type { Listing } from "@/db/schema";
import { VegBadge } from "@/components/shared/VegBadge";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { Button } from "@/components/ui/button";
import { ReserveModal } from "@/components/orders/ReserveModal";

interface ListingCardProps {
  listing: Listing;
  showReserve?: boolean;
  slotDate?: string;
}

export function ListingCard({ listing, showReserve, slotDate }: ListingCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentQty, setCurrentQty] = useState(listing.availableQuantity);

  const isAvailable = listing.status === "active" && currentQty > 0;

  return (
    <>
      <div className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        {listing.photoUrl ? (
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
            <Image
              src={listing.photoUrl}
              alt={listing.dishName}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 text-3xl">
            🍽️
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 leading-tight">{listing.dishName}</h3>
              <span className="shrink-0 font-bold text-gray-900">{formatPrice(listing.pricePerPortion)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <VegBadge isVeg={listing.isVeg} />
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {CUISINE_LABELS[listing.cuisineType]}
              </span>
            </div>
            {listing.description && (
              <p className="mt-1 text-xs text-gray-400 line-clamp-1">{listing.description}</p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <AvailabilityBadge status={listing.status} availableQuantity={currentQty} />
            {showReserve && isAvailable && (
              <Button size="sm" onClick={() => setModalOpen(true)}>
                Reserve
              </Button>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <ReserveModal
          listing={listing}
          currentQty={currentQty}
          slotDate={slotDate}
          onClose={() => setModalOpen(false)}
          onSuccess={(qty) => setCurrentQty((q) => q - qty)}
        />
      )}
    </>
  );
}
