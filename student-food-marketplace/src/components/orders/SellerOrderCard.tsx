"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice, formatSlotDate, formatPickupWindow } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Order } from "@/db/schema";

interface SellerOrderCardProps {
  order: Order;
  buyerName: string;
  buyerEmail: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" | "outline" }> = {
  pending:   { label: "Pending",  variant: "warning" },
  accepted:  { label: "Accepted", variant: "success" },
  ready:     { label: "Ready",    variant: "success" },
  picked_up: { label: "Done",     variant: "secondary" },
  rejected:  { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled by buyer", variant: "secondary" },
};

export function SellerOrderCard({ order, buyerName }: SellerOrderCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [loading, setLoading] = useState<string | null>(null);

  async function transition(newStatus: "accepted" | "rejected" | "ready" | "picked_up") {
    setLoading(newStatus);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(null);
    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
    }
  }

  const meta = STATUS_LABELS[status] ?? { label: status, variant: "secondary" as const };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{order.dishName}</p>
          <p className="text-sm text-gray-500">
            {order.quantity} portion{order.quantity > 1 ? "s" : ""} &middot; {formatPrice(order.totalAmount)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            By <span className="font-medium text-gray-600">{buyerName}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {formatSlotDate(order.pickupDate)} &middot; {formatPickupWindow(order.pickupStartTime, order.pickupEndTime)}
          </p>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      {/* Action buttons */}
      {status === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="success"
            onClick={() => transition("accepted")}
            loading={loading === "accepted"}
            className="flex-1"
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => transition("rejected")}
            loading={loading === "rejected"}
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
          >
            Reject
          </Button>
        </div>
      )}
      {status === "accepted" && (
        <Button
          size="sm"
          variant="default"
          onClick={() => transition("ready")}
          loading={loading === "ready"}
          className="mt-3 w-full"
        >
          Mark as ready for pickup
        </Button>
      )}
      {status === "ready" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => transition("picked_up" as const)}
          loading={loading === "picked_up"}
          className="mt-3 w-full"
        >
          Confirm picked up
        </Button>
      )}
    </div>
  );
}
