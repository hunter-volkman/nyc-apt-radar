import { notFound } from "next/navigation";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassPanel } from "@/components/glass/glass-panel";
import { GlassShell } from "@/components/glass/glass-shell";
import { StatusPill } from "@/components/glass/status-pill";
import { ListingRiskPanel } from "@/components/listings/listing-risk-panel";
import { ListingScore } from "@/components/listings/listing-score";
import { TourChecklist } from "@/components/tours/tour-checklist";
import {
  getListingBundle,
  getOutreachForListing,
  getToursWithListings,
  listings,
} from "@/lib/demo-data";
import { formatDateLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export function generateStaticParams() {
  return listings.map((listing) => ({ id: listing.id }));
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getListingBundle(id);

  if (!bundle) {
    notFound();
  }

  const { listing, evaluation } = bundle;
  const tours = getToursWithListings().filter(({ listing: tourListing }) => tourListing.id === listing.id);
  const outreachMessages = getOutreachForListing(listing.id);

  return (
    <GlassShell
      active="board"
      eyebrow="Listing Detail"
      title={listing.title}
      subtitle={`${listing.neighborhood}, ${listing.borough} - ${formatMoney(listing.rentMonthly)} - ${listing.moveInFit}`}
      action={
        <>
          <GlassButton href="/board">Board</GlassButton>
          <GlassButton href="/inbox" variant="primary">Capture Listing</GlassButton>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[0.78fr_0.42fr]">
        <div className="grid gap-5">
          <GlassPanel variant="strong" className="grid gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={listing.status} />
                  <span className={evaluation.eligible ? "risk-pill risk-low" : "risk-pill risk-high"}>
                    {evaluation.eligible ? "Eligible" : "Ineligible"}
                  </span>
                  <span className={`risk-pill risk-${listing.riskLevel}`}>{listing.mainRisk}</span>
                </div>
                <h2 className="mt-4 text-2xl font-black text-white">Decision summary</h2>
                <p className="mt-2 max-w-3xl text-base leading-7 text-white/74">{evaluation.summary}</p>
              </div>
              <span className={evaluation.eligible ? "score-chip" : "score-chip score-chip-muted"}>{evaluation.totalScore}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <DetailMetric label="Rent" value={formatMoney(listing.rentMonthly)} />
              <DetailMetric label="Available" value={formatDateLabel(listing.availableDate)} />
              <DetailMetric label="Beds" value={String(listing.bedrooms ?? "Unknown")} />
              <DetailMetric label="Updated" value={listing.updatedAtLabel} />
            </div>
          </GlassPanel>

          <div className="grid gap-5 xl:grid-cols-2">
            <ListPanel title="Strengths" items={evaluation.strengths} />
            <ListPanel title="Risks" items={evaluation.risks} />
            <ListPanel title="Hard filters" items={evaluation.hardFilters.length ? evaluation.hardFilters : ["None failed"]} />
            <ListPanel title="Open questions" items={evaluation.openQuestions} />
          </div>

          <GlassPanel>
            <p className="fine-label">Outreach draft</p>
            <div className="mt-4 grid gap-4">
              {outreachMessages.length ? (
                outreachMessages.map((message) => (
                  <div className="rounded-2xl border border-white/10 bg-black/18 p-4" key={message.id}>
                    <p className="fine-label">{message.kind.replaceAll("_", " ")}</p>
                    <p className="mt-3 text-sm leading-6 text-white/78">{message.body}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <GlassButton size="sm" variant="primary">Approve Draft</GlassButton>
                      <GlassButton size="sm">Edit</GlassButton>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/12 p-4 text-sm leading-6 text-white/50">
                  No draft yet
                </div>
              )}
            </div>
          </GlassPanel>

          <GlassPanel>
            <p className="fine-label">Notes</p>
            <p className="mt-3 text-sm leading-6 text-white/74">{listing.personalNotes}</p>
          </GlassPanel>

          {tours.map(({ tour }) => (
            <TourChecklist key={tour.id} listing={listing} tour={tour} />
          ))}
        </div>

        <aside className="grid content-start gap-5">
          <ListingScore evaluation={evaluation} />
          <ListingRiskPanel evaluation={evaluation} listing={listing} />

          <GlassPanel>
            <p className="fine-label">Decision actions</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <GlassButton variant="primary">Contact</GlassButton>
              <GlassButton>Follow up</GlassButton>
              <GlassButton>Schedule tour</GlassButton>
              <GlassButton>Mark toured</GlassButton>
              <GlassButton>Apply</GlassButton>
              <GlassButton variant="danger">Kill</GlassButton>
            </div>
          </GlassPanel>
        </aside>
      </div>
    </GlassShell>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
      <p className="fine-label">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <GlassPanel>
      <p className="fine-label">{title}</p>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-white/76">
        {items.map((item) => (
          <li className="rounded-2xl border border-white/10 bg-black/18 p-3" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
