import Link from "next/link";
import { GlassPanel } from "@/components/glass/glass-panel";
import { StatusPill } from "@/components/glass/status-pill";
import { cn } from "@/lib/cn";
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
    <GlassPanel as="article" className={cn("h-full p-4", compact ? "rounded-[22px]" : "rounded-[26px]")}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className={cn("score-chip", !evaluation.eligible && "score-chip-muted")}>
            {evaluation.totalScore}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={listing.status} />
              <span className={cn("risk-pill", `risk-${listing.riskLevel}`)}>{listing.mainRisk}</span>
            </div>
            <Link className="mt-3 block text-lg font-black leading-6 text-white hover:text-[var(--stoop-jade)]" href={`/listings/${listing.id}`}>
              {listing.title}
            </Link>
            <p className="mt-1 text-sm leading-5 text-white/62">
              {listing.neighborhood}, {listing.borough}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Fact label="Rent" value={formatMoney(listing.rentMonthly)} />
          <Fact label="Eligibility" value={evaluation.eligible ? "Eligible" : "Ineligible"} tone={evaluation.eligible ? "good" : "bad"} />
          <Fact label="Move-in" value={listing.moveInFit} />
          <Fact label="Available" value={formatDateLabel(listing.availableDate)} />
        </div>

        <div className="mt-auto rounded-2xl border border-white/10 bg-black/18 p-3">
          <p className="fine-label">Next action</p>
          <p className="mt-2 text-sm leading-5 text-white/82">{listing.nextAction}</p>
        </div>
      </div>
    </GlassPanel>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <p className="fine-label">{label}</p>
      <p
        className={cn(
          "mt-2 text-sm font-bold leading-5 text-white",
          tone === "good" && "text-[var(--stoop-green)]",
          tone === "bad" && "text-[var(--stoop-coral)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
