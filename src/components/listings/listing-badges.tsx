import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  statusLabels,
  type ListingStatus,
  type RiskLevel,
} from "@/lib/types";

const statusClasses: Record<ListingStatus, string> = {
  new: "border-zinc-300 bg-zinc-50 text-zinc-700",
  contacted: "border-sky-200 bg-sky-50 text-sky-800",
  tour_scheduled: "border-amber-200 bg-amber-50 text-amber-900",
  toured: "border-emerald-200 bg-emerald-50 text-emerald-800",
  applied: "border-violet-200 bg-violet-50 text-violet-800",
  dead: "border-red-200 bg-red-50 text-red-800",
  leased: "border-slate-300 bg-slate-100 text-slate-700",
};

const riskClasses: Record<RiskLevel, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-800",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  high: "border-red-200 bg-red-50 text-red-800",
};

export function StatusBadge({
  status,
  className,
}: {
  status: ListingStatus;
  className?: string;
}) {
  return (
    <Badge
      className={cn("h-6 rounded-md px-2 font-semibold", statusClasses[status], className)}
      variant="outline"
    >
      {statusLabels[status]}
    </Badge>
  );
}

export function EligibilityBadge({
  eligible,
  className,
}: {
  eligible: boolean;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-md px-2 font-semibold",
        eligible
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
        className,
      )}
      variant="outline"
    >
      {eligible ? "Eligible" : "Ineligible"}
    </Badge>
  );
}

export function RiskBadge({
  risk,
  children,
  className,
}: {
  risk: RiskLevel;
  children: string;
  className?: string;
}) {
  return (
    <Badge
      className={cn("h-6 max-w-full rounded-md px-2 font-semibold", riskClasses[risk], className)}
      title={children}
      variant="outline"
    >
      <span className="truncate">{children}</span>
    </Badge>
  );
}

export function ScoreTile({
  score,
  eligible,
  compact = false,
  className,
}: {
  score: number;
  eligible: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border bg-card text-center shadow-sm",
        eligible
          ? "border-emerald-200 text-emerald-900"
          : "border-red-200 text-red-900",
        compact ? "size-12" : "size-16",
        className,
      )}
      aria-label={`Score ${score}`}
    >
      <span className={cn("font-semibold leading-none", compact ? "text-lg" : "text-2xl")}>
        {score}
      </span>
      {!compact ? <span className="text-[0.68rem] font-semibold text-muted-foreground">score</span> : null}
    </div>
  );
}
