import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatPrice, formatSlotDate, formatPickupWindow } from "@/lib/utils";
import { ContactRevealCard } from "@/components/orders/ContactRevealCard";
import { CancelOrderButton } from "@/components/orders/CancelOrderButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" | "outline" }> = {
  pending: { label: "Waiting for seller", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  ready: { label: "Ready for pickup!", variant: "success" },
  picked_up: { label: "Picked up", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  expired: { label: "Expired", variant: "secondary" },
};

export default async function BuyerOrdersPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/buyer/orders");

  const myOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.buyerId, session.user.id))
    .orderBy(desc(orders.createdAt));

  if (myOrders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Browse the cafeteria slots and reserve some home-cooked food!"
      >
        <Button asChild>
          <Link href="/">Browse food</Link>
        </Button>
      </EmptyState>
    );
  }

  const revealStatuses = ["accepted", "ready", "picked_up"];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-gray-900">My Orders</h1>
      <div className="space-y-4">
        {myOrders.map((order) => {
          const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, variant: "secondary" as const };
          const shouldReveal = revealStatuses.includes(order.status);

          return (
            <div key={order.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{order.dishName}</p>
                  <p className="text-sm text-gray-500">
                    {order.quantity} portion{order.quantity > 1 ? "s" : ""} &middot; {formatPrice(order.totalAmount)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatSlotDate(order.pickupDate)} &middot; {formatPickupWindow(order.pickupStartTime, order.pickupEndTime)}
                  </p>
                </div>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>

              {shouldReveal && order.sellerWhatsapp && order.sellerName && (
                <ContactRevealCard
                  dishName={order.dishName}
                  quantity={order.quantity}
                  pickupDate={order.pickupDate}
                  sellerWhatsapp={order.sellerWhatsapp}
                  sellerUpiId={order.sellerUpiId}
                  sellerName={order.sellerName}
                />
              )}

              {order.status === "pending" && (
                <div className="mt-3">
                  <CancelOrderButton orderId={order.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
