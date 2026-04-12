import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { cafeteriaSlots, listings, orders, users } from "@/db/schema";
import { eq, gte, desc } from "drizzle-orm";
import { formatSlotDate, formatPickupWindow, formatPrice } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SellerOrderCard } from "@/components/orders/SellerOrderCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PlusCircle, CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/db/schema";

export default async function SellerDashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.isSellerProfileComplete) redirect("/onboarding");

  const today = new Date().toISOString().split("T")[0];

  // Upcoming slots
  const mySlots = await db
    .select()
    .from(cafeteriaSlots)
    .where(eq(cafeteriaSlots.sellerId, session.user.id))
    .orderBy(cafeteriaSlots.date);

  const upcomingSlots = mySlots.filter((s) => s.date >= today);

  // Listings for upcoming slots
  const slotIds = upcomingSlots.map((s) => s.id);
  let myListings: (typeof listings.$inferSelect)[] = [];
  if (slotIds.length > 0) {
    myListings = await db
      .select()
      .from(listings)
      .where(eq(listings.sellerId, session.user.id));
  }

  // Pending + active orders for my listings
  type SellerOrderRow = {
    order: Order;
    buyer: { name: string; email: string };
  };

  const sellerOrders: SellerOrderRow[] = [];
  if (myListings.length > 0) {
    for (const listing of myListings) {
      const rows = await db
        .select({
          order: orders,
          buyer: { name: users.name, email: users.email },
        })
        .from(orders)
        .innerJoin(users, eq(orders.buyerId, users.id))
        .where(eq(orders.listingId, listing.id));
      sellerOrders.push(...rows);
    }
  }

  const pendingOrders = sellerOrders.filter((r) => r.order.status === "pending");
  const activeOrders = sellerOrders.filter((r) =>
    ["accepted", "ready"].includes(r.order.status)
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Seller Dashboard</h1>
          <p className="text-sm text-gray-500">Manage your cafeteria slots and orders</p>
        </div>
        <Button asChild size="sm">
          <Link href="/slots/new">
            <CalendarPlus className="h-4 w-4" />
            New slot
          </Link>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Upcoming slots", value: upcomingSlots.length },
          { label: "Pending orders", value: pendingOrders.length },
          { label: "Active orders", value: activeOrders.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Pending orders — needs action */}
      {pendingOrders.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
            Pending orders
            <Badge variant="warning">{pendingOrders.length}</Badge>
          </h2>
          <div className="space-y-3">
            {pendingOrders.map(({ order, buyer }) => (
              <SellerOrderCard key={order.id} order={order} buyerName={buyer.name} buyerEmail={buyer.email} />
            ))}
          </div>
        </section>
      )}

      {/* Active orders */}
      {activeOrders.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Active orders</h2>
          <div className="space-y-3">
            {activeOrders.map(({ order, buyer }) => (
              <SellerOrderCard key={order.id} order={order} buyerName={buyer.name} buyerEmail={buyer.email} />
            ))}
          </div>
        </section>
      )}

      {/* My upcoming slots */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Your slots</h2>
        {upcomingSlots.length === 0 ? (
          <EmptyState
            title="No upcoming slots"
            description="Book a cafeteria slot to start selling your food."
          >
            <Button asChild>
              <Link href="/slots/new">Book first slot</Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {upcomingSlots.map((slot) => {
              const slotListings = myListings.filter((l) => l.slotId === slot.id);
              return (
                <Link key={slot.id} href={`/slots/${slot.id}`}>
                  <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-orange-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{formatSlotDate(slot.date)}</p>
                        <p className="text-sm text-gray-500">{formatPickupWindow(slot.startTime, slot.endTime)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">{slotListings.length} dish{slotListings.length !== 1 ? "es" : ""}</p>
                        <p className="text-xs text-gray-400">IE Cafeteria</p>
                      </div>
                    </div>
                    {slotListings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {slotListings.map((l) => (
                          <span key={l.id} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                            {l.dishName} — {formatPrice(l.pricePerPortion)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
