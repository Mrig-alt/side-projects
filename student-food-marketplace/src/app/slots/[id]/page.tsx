import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { cafeteriaSlots, listings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatSlotDate, formatPickupWindow } from "@/lib/utils";
import { Clock, MapPin, PlusCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/listings/ListingCard";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function SlotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [slot] = await db
    .select()
    .from(cafeteriaSlots)
    .where(eq(cafeteriaSlots.id, id))
    .limit(1);

  if (!slot) notFound();

  const [seller] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, slot.sellerId))
    .limit(1);

  const dishes = await db
    .select()
    .from(listings)
    .where(eq(listings.slotId, id));

  const isOwner = session?.user.id === slot.sellerId;

  return (
    <div>
      {/* Slot header */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-orange-500">{formatSlotDate(slot.date)}</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{seller?.name}</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatPickupWindow(slot.startTime, slot.endTime)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            IE Business School Cafeteria
          </span>
        </div>
      </div>

      {/* Dishes */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Dishes ({dishes.length})
        </h2>
        {isOwner && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/listings/new?slotId=${slot.id}`}>
              <PlusCircle className="h-4 w-4" />
              Add dish
            </Link>
          </Button>
        )}
      </div>

      {dishes.length === 0 ? (
        <EmptyState
          title="No dishes yet"
          description={
            isOwner
              ? "Add your first dish to let people know what you're cooking."
              : "This seller hasn't added any dishes yet."
          }
        >
          {isOwner && (
            <Button asChild>
              <Link href={`/listings/new?slotId=${slot.id}`}>Add first dish</Link>
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {dishes.map((dish) => (
            <ListingCard key={dish.id} listing={dish} showReserve={!isOwner && !!session} slotDate={slot.date} />
          ))}
        </div>
      )}
    </div>
  );
}
