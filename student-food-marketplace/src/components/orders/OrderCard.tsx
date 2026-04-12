"use client";

import { useState } from "react";
import { formatPrice, formatSlotDate, formatPickupWindow } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactRevealCard } from "./ContactRevealCard";
import type { Order } from "@/db/schema";

interface OrderCardProps {
  order: Order;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  pending:   { label: "Waiting for seller", variant: "warning" },
  accepted:  { label: "Accepted",           variant: "success" },
  rejected:  { label: "Rejected",           variant: "destructive" },
  ready:     { label: "Ready for pickup!",  variant: "success" },
  picked_up: { label: "Picked up",          variant: "secondary" },
  cancelled: { label: "Cancelled",          variant: "secondary" },
  expired:   { label: "Expired",            variant: "secondary" },
};

export function OrderCard({ order }: OrderCardProps) {
  const [status, setStatus] = useState(order.status);
  const [cancelling, setCancelling] = useState(false);

  const meta = STATUS_LABELS[status] ?? { label: status, variant: "secondary" as const };
  const canCancel = status === "pending";
  const showContact =
    (status === "accepted" || status === "ready") &&
    order.sellerWhatsapp;

  async function handleCancel() {
    setCancelling(true);
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setStatus("cancelled");
    setCancelling(false);
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">{order.dishName}</h3>
          <p className="text-sm text-gray-500">
            {order.quantity} portion{order.quantity > 1 ? "s" : ""} &middot; {formatPrice(order.totalAmount)}
          </p>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {formatSlotDate(order.pickupDate)} &middot; {formatPickupWindow(order.pickupStartTime, order.pickupEndTime)} &middot; IE Cafeteria
      </div>

      {showContact && order.sellerWhatsapp && (
        <ContactRevealCard
          dishName={order.dishName}
          quantity={order.quantity}
          pickupDate={order.pickupDate}
          sellerWhatsapp={order.sellerWhatsapp}
          sellerUpiId={order.sellerUpiId}
          sellerName={order.sellerName ?? "Seller"}
        />
      )}

      {canCancel && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            loading={cancelling}
            className="text-red-600 hover:bg-red-50 border-red-200"
          >
            Cancel reservation
          </Button>
        </div>
      )}
    </div>
  );
}
