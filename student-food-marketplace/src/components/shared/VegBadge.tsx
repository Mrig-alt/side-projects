import { cn } from "@/lib/utils";

interface VegBadgeProps {
  isVeg: boolean;
  className?: string;
}

export function VegBadge({ isVeg, className }: VegBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium border",
        isVeg
          ? "border-green-600 text-green-700"
          : "border-red-500 text-red-600",
        className
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-sm",
          isVeg ? "bg-green-600" : "bg-red-500"
        )}
      />
      {isVeg ? "Veg" : "Non-veg"}
    </span>
  );
}
