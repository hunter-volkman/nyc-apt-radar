import Link from "next/link";
import { GlassPanel } from "@/components/glass/glass-panel";
import { StatusPill } from "@/components/glass/status-pill";
import { getBoardColumns, getEvaluation } from "@/lib/demo-data";
import { formatMoney } from "@/lib/money";

export function CandidateBoard() {
  const columns = getBoardColumns();

  return (
    <div className="grid gap-4 xl:grid-cols-7">
      {columns.map((column) => (
        <GlassPanel as="section" className="min-h-64 rounded-[24px] p-3" key={column.status}>
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <StatusPill status={column.status} />
            <span className="text-xs font-bold text-white/54">{column.listings.length}</span>
          </div>

          <div className="grid gap-3">
            {column.listings.length ? (
              column.listings.map((listing) => {
                const evaluation = getEvaluation(listing.id);

                return (
                  <Link
                    className="block rounded-[18px] border border-white/10 bg-black/20 p-3 transition hover:border-white/24 hover:bg-white/[0.07]"
                    href={`/listings/${listing.id}`}
                    key={listing.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-black leading-5 text-white">{listing.title}</h2>
                        <p className="mt-1 text-xs leading-5 text-white/60">
                          {formatMoney(listing.rentMonthly)} - {listing.neighborhood}
                        </p>
                      </div>
                      <span className={evaluation?.eligible ? "score-chip !h-11 !w-11 !text-base" : "score-chip score-chip-muted !h-11 !w-11 !text-base"}>
                        {evaluation?.totalScore ?? "?"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusPill status={listing.status} />
                      <span className="risk-pill risk-medium">{evaluation?.eligible ? "Eligible" : "Ineligible"}</span>
                      <span className={`risk-pill risk-${listing.riskLevel}`}>{listing.mainRisk}</span>
                    </div>

                    <p className="mt-3 text-xs font-semibold leading-5 text-white/76">{listing.nextAction}</p>
                    <p className="mt-3 text-xs text-white/46">{listing.updatedAtLabel}</p>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-[18px] border border-dashed border-white/12 p-4 text-sm leading-6 text-white/46">
                No candidates
              </div>
            )}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
