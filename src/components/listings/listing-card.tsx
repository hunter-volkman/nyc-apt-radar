import Link from "next/link";
import {
  EligibilityBadge,
  RiskBadge,
  ScoreTile,
  StatusBadge,
} from "@/components/listings/listing-badges";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatDateLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { DemoListing, ListingEvaluation } from "@/lib/types";

export function ListingCard({
  listing,
  evaluation,
  compact = false,
}: {
  listing: DemoListing;
  evaluation: ListingEvaluation;
  compact?: boolean;
}) {
  return (
    <Card className={cn("h-full rounded-lg shadow-sm", compact && "text-sm")} role="article">
      <CardHeader className="gap-3">
        <div className="flex items-start gap-3">
          <ScoreTile compact={compact} eligible={evaluation.eligible} score={evaluation.totalScore} />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={listing.status} />
              <EligibilityBadge eligible={evaluation.eligible} />
            </div>
            <CardTitle className="text-base font-semibold leading-6">
              <Link className="hover:underline" href={`/listings/${listing.id}`}>
                {listing.title}
              </Link>
            </CardTitle>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatMoney(listing.rentMonthly)} · {listing.neighborhood ?? "Neighborhood unknown"}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {listing.address ?? "Address missing"}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Move-in" value={listing.moveInFit} />
          <Fact label="Available" value={formatDateLabel(listing.availableDate)} />
        </div>
        <RiskBadge risk={listing.riskLevel}>{listing.mainRisk}</RiskBadge>
        <Separator />
        <div className="mt-auto">
          <p className="stoop-label">Next action</p>
          <p className="mt-1 text-sm font-medium leading-5 text-foreground">{listing.nextAction}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/35 px-3 py-2">
      <p className="stoop-label">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-foreground">{value}</p>
    </div>
  );
}
