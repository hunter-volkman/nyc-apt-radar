import { cn } from "@/lib/cn";
import { statusLabels } from "@/lib/demo-data";
import type { ListingStatus } from "@/lib/types";

export function StatusPill({ status, className }: { status: ListingStatus; className?: string }) {
  return (
    <span className={cn("status-pill", `status-pill-${status}`, className)}>
      {statusLabels[status]}
    </span>
  );
}
