import { ArrowRight, CalendarCheck, ClipboardList, Inbox } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { DailyBriefing } from "@/components/briefing/daily-briefing";
import { AppShell } from "@/components/layout/app-shell";
import {
  EligibilityBadge,
  RiskBadge,
  ScoreTile,
  StatusBadge,
} from "@/components/listings/listing-badges";
import { ListingCard } from "@/components/listings/listing-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  applicationReadiness,
  dailyBrief,
  searchProfile,
} from "@/lib/demo-data";
import {
  getNeedsFollowUp,
  getNeedsOutreach,
  getRecentlyKilled,
  getTopCandidates,
  getToursWithListings,
  type ListingBundle,
} from "@/lib/listing-view-models";
import { formatDateTimeLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { DemoListing } from "@/lib/types";

export default async function TodayPage() {
  await connection();

  const topCandidates = getTopCandidates(4);
  const primaryCandidate = topCandidates[0];
  const needsOutreach = getNeedsOutreach();
  const needsFollowUp = getNeedsFollowUp();
  const scheduledTours = getToursWithListings().filter(
    ({ listing }) => listing.status === "tour_scheduled",
  );
  const recentlyKilled = getRecentlyKilled();
  const readyCount = applicationReadiness.filter((item) => item.ready).length;
  const readinessGaps = applicationReadiness.filter((item) => !item.ready);

  return (
    <AppShell
      active="today"
      eyebrow="Today"
      title="Command the apartment hunt."
      subtitle="One local screen for the next action, best candidates, follow-ups, tours, risk, and readiness gaps."
      action={
        <>
          <Button asChild size="sm">
            <Link href="/inbox">
              <Inbox />
              Capture
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/board">
              <ClipboardList />
              Board
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        {primaryCandidate ? <PrimaryCommand bundle={primaryCandidate} /> : null}

        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-5">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="stoop-label">Top candidates</p>
                  <h2 className="mt-1 text-xl font-semibold">Ranked by fit and urgency</h2>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/board">
                    Board
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {topCandidates.map(({ listing, evaluation }) => (
                  <ListingCard evaluation={evaluation} key={listing.id} listing={listing} />
                ))}
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              <ActionQueue
                icon={<Inbox />}
                title="Needs outreach"
                items={needsOutreach.map((listing) => ({
                  href: `/listings/${listing.id}`,
                  label: listing.title,
                  detail: listing.nextAction,
                }))}
              />
              <ActionQueue
                icon={<ArrowRight />}
                title="Needs follow-up"
                items={needsFollowUp.map((listing) => ({
                  href: `/listings/${listing.id}`,
                  label: listing.title,
                  detail: listing.nextAction,
                }))}
              />
            </div>

            <ToursCard tours={scheduledTours} />
          </div>

          <aside className="grid content-start gap-5">
            <DailyBriefing brief={dailyBrief} />
            <ReadinessCard gaps={readinessGaps} readyCount={readyCount} />
            <SearchProfileCard />
            <KilledCard listings={recentlyKilled} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function PrimaryCommand({ bundle }: { bundle: ListingBundle }) {
  const { listing, evaluation } = bundle;

  return (
    <Card className="rounded-lg border-primary/20 shadow-sm">
      <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <ScoreTile eligible={evaluation.eligible} score={evaluation.totalScore} />
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <StatusBadge status={listing.status} />
            <EligibilityBadge eligible={evaluation.eligible} />
            <RiskBadge risk={listing.riskLevel}>{listing.mainRisk}</RiskBadge>
          </div>
          <h2 className="text-xl font-semibold leading-7">{listing.title}</h2>
          <p className="mt-1 text-sm font-semibold">
            {formatMoney(listing.rentMonthly)} · {listing.neighborhood ?? "Neighborhood unknown"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{listing.address ?? "Address missing"}</p>
          <Separator className="my-3" />
          <p className="text-sm font-medium leading-6">{listing.nextAction}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button asChild>
            <Link href={`/listings/${listing.id}`}>
              Decide
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/inbox">Capture another</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionQueue({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: Array<{ href: string; label: string; detail: string }>;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="[&>svg]:size-4">{icon}</span>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.length ? (
          items.map((item) => (
            <Link
              className="rounded-md border bg-muted/30 p-3 transition hover:border-foreground/25 hover:bg-accent/40"
              href={item.href}
              key={item.href}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
            </Link>
          ))
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Nothing queued.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ToursCard({
  tours,
}: {
  tours: ReturnType<typeof getToursWithListings>;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="stoop-label">Scheduled tours</p>
            <CardTitle className="mt-1 text-lg font-semibold">Tour checks on deck</CardTitle>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/tours">
              <CalendarCheck />
              Tours
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {tours.length ? (
          tours.map(({ tour, listing }) => (
            <Link
              className="rounded-md border bg-muted/30 p-3 transition hover:border-foreground/25 hover:bg-accent/40"
              href={`/listings/${listing.id}`}
              key={tour.id}
            >
              <p className="text-sm font-semibold">{listing.title}</p>
              <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(tour.startsAt)}</p>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{tour.notes}</p>
            </Link>
          ))
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No tours scheduled.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SearchProfileCard() {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <p className="stoop-label">Search profile</p>
        <CardTitle className="text-lg font-semibold">{searchProfile.name}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm">
        <MiniMetric label="Max rent" value={formatMoney(searchProfile.maxRentMonthly)} />
        <MiniMetric label="Tolerance" value={formatMoney(searchProfile.budgetToleranceMonthly)} />
        <MiniMetric label="Move-in" value="Jun 24" />
        <MiniMetric label="Bedroom" value="1-2" />
      </CardContent>
    </Card>
  );
}

function ReadinessCard({
  gaps,
  readyCount,
}: {
  gaps: typeof applicationReadiness;
  readyCount: number;
}) {
  const percent = Math.round((readyCount / applicationReadiness.length) * 100);
  const blockers = gaps.filter((item) => item.blocking);

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="stoop-label">Application readiness</p>
            <CardTitle className="mt-1 text-lg font-semibold">
              {readyCount}/{applicationReadiness.length} ready
            </CardTitle>
          </div>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
            {blockers.length} blockers
          </span>
        </div>
        <Progress value={percent} />
      </CardHeader>
      <CardContent className="grid gap-2">
        {gaps.map((item) => (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3" key={item.id}>
            <span className="text-sm font-medium">{item.label}</span>
            <span className={item.blocking ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-amber-800"}>
              {item.blocking ? "Blocking" : "Later"}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function KilledCard({ listings }: { listings: DemoListing[] }) {
  return (
    <Card className="rounded-lg border-red-200 bg-red-50/60 shadow-sm">
      <CardHeader>
        <p className="stoop-label">Recently killed</p>
        <CardTitle className="text-lg font-semibold">Do not reopen casually</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {listings.length ? (
          listings.map((listing) => (
            <Link
              className="rounded-md border bg-card p-3 transition hover:border-red-300"
              href={`/listings/${listing.id}`}
              key={listing.id}
            >
              <p className="text-sm font-semibold">{listing.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{listing.mainRisk}</p>
            </Link>
          ))
        ) : (
          <p className="rounded-md border border-dashed bg-card p-3 text-sm text-muted-foreground">
            Nothing killed recently.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/35 p-3">
      <p className="stoop-label">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
