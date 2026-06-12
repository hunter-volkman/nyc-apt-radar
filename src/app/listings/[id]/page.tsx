import { ArrowLeft, Inbox } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { updateListingStatusFromForm } from "@/app/actions/listings";
import { AppShell } from "@/components/layout/app-shell";
import {
  EligibilityBadge,
  RiskBadge,
  ScoreTile,
  StatusBadge,
} from "@/components/listings/listing-badges";
import { ListingRiskPanel } from "@/components/listings/listing-risk-panel";
import { ListingScore } from "@/components/listings/listing-score";
import { OutreachDraftPanel } from "@/components/outreach/outreach-draft-panel";
import { TourChecklist } from "@/components/tours/tour-checklist";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { searchProfile } from "@/lib/demo-data";
import { getListingBundle, getToursWithListings } from "@/lib/listing-view-models";
import { formatDateLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { draftOutreachFallback, getRecommendedOutreachKind } from "@/lib/outreach";
import type { ListingStatus } from "@/lib/types";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id } = await params;
  const bundle = getListingBundle(id);

  if (!bundle) {
    notFound();
  }

  const { listing, evaluation } = bundle;
  const tours = getToursWithListings().filter(({ listing: tourListing }) => tourListing.id === listing.id);
  const initialDraft = draftOutreachFallback(
    listing,
    searchProfile,
    getRecommendedOutreachKind(listing),
  );

  return (
    <AppShell
      active="board"
      eyebrow="Listing Detail"
      title={listing.title}
      subtitle={`${listing.neighborhood}, ${listing.borough} · ${formatMoney(listing.rentMonthly)} · ${listing.address ?? "Address missing"}`}
      action={
        <>
          <Button asChild size="sm" variant="outline">
            <Link href="/board">
              <ArrowLeft />
              Board
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/inbox">
              <Inbox />
              Capture
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card className="rounded-lg border-primary/20 shadow-sm">
            <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_1fr]">
              <ScoreTile eligible={evaluation.eligible} score={evaluation.totalScore} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={listing.status} />
                  <EligibilityBadge eligible={evaluation.eligible} />
                  <RiskBadge risk={listing.riskLevel}>{listing.mainRisk}</RiskBadge>
                </div>
                <h2 className="mt-3 text-xl font-semibold">Decision summary</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {evaluation.summary}
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailMetric label="Rent" value={formatMoney(listing.rentMonthly)} />
                  <DetailMetric label="Neighborhood" value={listing.neighborhood ?? "Unknown"} />
                  <DetailMetric label="Address" value={listing.address ?? "Missing"} />
                  <DetailMetric label="Available" value={formatDateLabel(listing.availableDate)} />
                  <DetailMetric label="Beds" value={String(listing.bedrooms ?? "Unknown")} />
                  <DetailMetric label="Baths" value={String(listing.bathrooms ?? "Unknown")} />
                  <DetailMetric label="Move-in" value={listing.moveInFit} />
                  <DetailMetric label="Updated" value={listing.updatedAtLabel} />
                </div>

                <Separator className="my-4" />
                <p className="stoop-label">Next action</p>
                <p className="mt-1 text-sm font-medium leading-6">{listing.nextAction}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <ListPanel title="Strengths" items={evaluation.strengths} />
            <ListPanel title="Risks" items={evaluation.risks} tone="risk" />
            <ListPanel title="Hard filters" items={evaluation.hardFilters.length ? evaluation.hardFilters : ["None failed"]} />
            <ListPanel title="Open questions" items={evaluation.openQuestions} />
          </div>

          <OutreachDraftPanel initialDraft={initialDraft} listingId={listing.id} />

          <Card className="rounded-lg shadow-sm">
            <CardHeader>
              <p className="stoop-label">Notes</p>
              <CardTitle className="text-lg font-semibold">Private readout</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {listing.personalNotes ?? "No notes captured."}
              </p>
            </CardContent>
          </Card>

          {tours.map(({ tour }) => (
            <TourChecklist key={tour.id} listing={listing} tour={tour} />
          ))}
        </div>

        <aside className="grid content-start gap-5">
          <ListingScore evaluation={evaluation} />
          <DecisionActions listingId={listing.id} />
          <ListingRiskPanel evaluation={evaluation} listing={listing} />
        </aside>
      </div>
    </AppShell>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/35 p-3">
      <p className="stoop-label">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function ListPanel({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "risk";
}) {
  return (
    <Card className={tone === "risk" ? "rounded-lg border-amber-200 bg-amber-50/50 shadow-sm" : "rounded-lg shadow-sm"}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 text-sm leading-6">
          {items.map((item) => (
            <li className="rounded-md border bg-card p-3" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DecisionActions({ listingId }: { listingId: string }) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <p className="stoop-label">Decision actions</p>
        <CardTitle className="text-lg font-semibold">Set status</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <StatusAction listingId={listingId} status="contacted" variant="primary">Contact</StatusAction>
        <StatusAction listingId={listingId} status="contacted">Follow up</StatusAction>
        <StatusAction listingId={listingId} status="tour_scheduled">Schedule tour</StatusAction>
        <StatusAction listingId={listingId} status="toured">Mark toured</StatusAction>
        <StatusAction listingId={listingId} status="applied">Apply</StatusAction>
        <StatusAction listingId={listingId} status="dead" variant="danger">Kill</StatusAction>
      </CardContent>
    </Card>
  );
}

function StatusAction({
  children,
  listingId,
  status,
  variant = "default",
}: {
  children: ReactNode;
  listingId: string;
  status: ListingStatus;
  variant?: "default" | "primary" | "danger";
}) {
  return (
    <form action={updateListingStatusFromForm}>
      <input name="id" type="hidden" value={listingId} />
      <input name="status" type="hidden" value={status} />
      <Button
        className="w-full justify-center"
        type="submit"
        variant={variant === "primary" ? "default" : variant === "danger" ? "destructive" : "outline"}
      >
        {children}
      </Button>
    </form>
  );
}
