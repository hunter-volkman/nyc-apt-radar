import { RiskBadge, StatusBadge } from "@/components/listings/listing-badges";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { formatDateTimeLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { DemoListing, Tour } from "@/lib/types";

export function TourChecklist({ listing, tour }: { listing: DemoListing; tour: Tour }) {
  const entries = Object.entries(tour.checklist);
  const complete = entries.filter(([, checked]) => checked).length;
  const progress = Math.round((complete / entries.length) * 100);

  return (
    <Card className="rounded-lg shadow-sm" role="article">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{formatDateTimeLabel(tour.startsAt)}</p>
            <CardTitle className="mt-1 text-xl font-semibold">{listing.title}</CardTitle>
            <p className="mt-1 text-sm font-medium">
              {formatMoney(listing.rentMonthly)} · {listing.neighborhood}, {listing.borough}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {listing.address ?? "Address missing"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <StatusBadge status={listing.status} />
            <RiskBadge risk={listing.riskLevel}>{listing.mainRisk}</RiskBadge>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">Checklist</span>
            <span className="font-semibold">
              {complete}/{entries.length}
            </span>
          </div>
          <Progress value={progress} />
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([item, checked]) => (
          <div className="flex min-h-11 items-center gap-3 rounded-md border bg-muted/30 p-3" key={item}>
            <Checkbox checked={checked} disabled />
            <span className="text-sm font-medium">{item}</span>
          </div>
        ))}
        </div>

        <div className="rounded-md border bg-card p-3">
          <p className="stoop-label">Post-tour verdict</p>
          <p className="mt-1 text-sm font-semibold capitalize">{tour.verdict}</p>
          {tour.notes ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{tour.notes}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
