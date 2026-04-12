import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import { formatPickupWindow, formatPrice, CUISINE_LABELS } from "@/lib/utils";
import { VegBadge } from "@/components/shared/VegBadge";
import type { CafeteriaSlot, Listing } from "@/db/schema";

interface SlotCardProps {
  slot: CafeteriaSlot & {
    seller: { id: string; name: string };
    listings: Listing[];
  };
}

export function SlotCard({ slot }: SlotCardProps) {
  const activeListings = slot.listings.filter((l) => l.status === "active" && l.availableQuantity > 0);
  const totalPortions = activeListings.reduce((sum, l) => sum + l.availableQuantity, 0);

  return (
    <Link href={`/slots/${slot.id}`}>
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-orange-200 hover:shadow-md transition-all">
        {/* Seller + time */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-600">
                {slot.seller.name[0]?.toUpperCase()}
              </div>
              <p className="font-semibold text-gray-900">{slot.seller.name}</p>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatPickupWindow(slot.startTime, slot.endTime)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                IE Cafeteria
              </span>
            </div>
          </div>
          {totalPortions > 0 ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              {totalPortions} left
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
              Sold out
            </span>
          )}
        </div>

        {/* Dish previews */}
        {slot.listings.length > 0 && (
          <div className="mt-3 space-y-2">
            {slot.listings.slice(0, 3).map((dish) => (
              <div key={dish.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <VegBadge isVeg={dish.isVeg} />
                  <span className="text-sm text-gray-700 truncate">{dish.dishName}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {CUISINE_LABELS[dish.cuisineType]}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-gray-800">
                  {formatPrice(dish.pricePerPortion)}
                </span>
              </div>
            ))}
            {slot.listings.length > 3 && (
              <p className="text-xs text-orange-500">+{slot.listings.length - 3} more dishes →</p>
            )}
          </div>
        )}

        {slot.listings.length === 0 && (
          <p className="mt-3 text-sm text-gray-400 italic">No dishes listed yet</p>
        )}
      </div>
    </Link>
  );
}
