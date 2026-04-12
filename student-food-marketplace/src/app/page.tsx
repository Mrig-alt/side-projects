import { db } from "@/db";
import { cafeteriaSlots, listings, users } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { format } from "date-fns";
import { SlotCard } from "@/components/slots/SlotCard";
import { DateTabBar } from "@/components/slots/DateTabBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { MapPin } from "lucide-react";
import type { CafeteriaSlot, Listing } from "@/db/schema";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: rawDate } = await searchParams;
  const today = format(new Date(), "yyyy-MM-dd");
  const selectedDate = rawDate ?? today;

  const slotRows = await db
    .select({
      slot: cafeteriaSlots,
      seller: { id: users.id, name: users.name },
    })
    .from(cafeteriaSlots)
    .innerJoin(users, eq(cafeteriaSlots.sellerId, users.id))
    .where(
      and(
        eq(cafeteriaSlots.date, selectedDate),
        gte(cafeteriaSlots.date, today)
      )
    )
    .orderBy(cafeteriaSlots.startTime);

  const slotsWithListings = await Promise.all(
    slotRows.map(async (row) => {
      const dishes = await db
        .select()
        .from(listings)
        .where(eq(listings.slotId, row.slot.id));
      return { ...row.slot, seller: row.seller, listings: dishes } as CafeteriaSlot & {
        seller: { id: string; name: string };
        listings: Listing[];
      };
    })
  );

  return (
    <div>
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-400 p-5 text-white">
        <h1 className="text-2xl font-bold">Campus Bites</h1>
        <p className="mt-1 text-sm text-orange-100">
          Home-cooked Indian food by IE students
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-orange-100">
          <MapPin className="h-4 w-4" />
          IE Business School Cafeteria
        </div>
      </div>

      <DateTabBar />

      {slotsWithListings.length === 0 ? (
        <EmptyState
          title="No food today"
          description="No one is selling on this day yet. Check another day or sign up to sell!"
        />
      ) : (
        <div className="space-y-4">
          {slotsWithListings.map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
        </div>
      )}
    </div>
  );
}
