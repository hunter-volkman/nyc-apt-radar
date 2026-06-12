import Link from "next/link";
import { Inbox } from "lucide-react";
import {
  EligibilityBadge,
  RiskBadge,
  ScoreTile,
  StatusBadge,
} from "@/components/listings/listing-badges";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/money";
import type { ListingBundle } from "@/lib/listing-view-models";
import type { ListingStatus } from "@/lib/types";

type BoardColumn = {
  status: ListingStatus;
  label: string;
  listings: ListingBundle[];
};

export function CandidateBoard({ columns }: { columns: BoardColumn[] }) {
  const totalListings = columns.reduce((total, column) => total + column.listings.length, 0);

  return (
    <div className="grid gap-4">
      {totalListings === 0 ? (
        <section className="rounded-lg border border-dashed bg-muted/30 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="stoop-label">No real listings yet</p>
              <h2 className="mt-1 text-lg font-semibold">Capture the first candidate from Inbox.</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Paste listing text, broker messages, or manual notes, then review the parsed fields before saving.
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/inbox">
                <Inbox />
                Capture
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {columns.map((column) => (
          <section className="min-h-72 rounded-lg border bg-muted/30 p-2" key={column.status}>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <StatusBadge status={column.status} />
              <span className="rounded-md border bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {column.listings.length}
              </span>
            </div>
            <Separator className="mb-2" />

            <div className="grid gap-2">
              {column.listings.length ? (
                column.listings.map(({ listing, evaluation }) => {
                  return (
                    <Link
                      className="block rounded-md border bg-card p-3 shadow-sm transition hover:border-foreground/25 hover:bg-accent/40"
                      href={`/listings/${listing.id}`}
                      key={listing.id}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold leading-5">{listing.title}</h2>
                          <p className="mt-1 text-sm font-semibold">
                            {formatMoney(listing.rentMonthly)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {listing.neighborhood ?? "Neighborhood unknown"}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {listing.address ?? "Address missing"}
                          </p>
                        </div>
                        <ScoreTile compact eligible={evaluation.eligible} score={evaluation.totalScore} />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <EligibilityBadge eligible={evaluation.eligible} />
                        <RiskBadge className="max-w-[8.5rem]" risk={listing.riskLevel}>
                          {listing.mainRisk}
                        </RiskBadge>
                      </div>

                      <p className="mt-3 line-clamp-2 text-xs font-medium leading-5">
                        {listing.nextAction}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">{listing.updatedAtLabel}</p>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-md border border-dashed bg-card/60 p-3 text-sm leading-6 text-muted-foreground">
                  Empty
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
