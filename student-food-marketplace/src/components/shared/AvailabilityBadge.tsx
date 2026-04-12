import { Badge } from "@/components/ui/badge";
import type { ListingStatus } from "@/db/schema";

interface AvailabilityBadgeProps {
  status: ListingStatus;
  availableQuantity: number;
}

export function AvailabilityBadge({ status, availableQuantity }: AvailabilityBadgeProps) {
  if (status === "sold_out" || availableQuantity === 0) {
    return <Badge variant="destructive">Sold out</Badge>;
  }
  if (status === "cancelled") {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  if (status === "paused") {
    return <Badge variant="warning">Paused</Badge>;
  }
  return (
    <Badge variant="success">
      {availableQuantity} left
    </Badge>
  );
}
