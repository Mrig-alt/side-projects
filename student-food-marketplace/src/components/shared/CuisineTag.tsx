import { CUISINE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { CuisineType } from "@/db/schema";

interface CuisineTagProps {
  cuisine: CuisineType;
}

export function CuisineTag({ cuisine }: CuisineTagProps) {
  return (
    <Badge variant="secondary">{CUISINE_LABELS[cuisine] ?? cuisine}</Badge>
  );
}
