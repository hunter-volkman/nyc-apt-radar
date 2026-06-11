import Link from "next/link";
import {
  EligibilityBadge,
  RiskBadge,
  ScoreTile,
  StatusBadge,
} from "@/components/listings/listing-badges";
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
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1120px] grid-cols-7 gap-3">
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
                  No candidates
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
