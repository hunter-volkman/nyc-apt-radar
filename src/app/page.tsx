import { ArrowRight, Bell, CalendarCheck, ClipboardList, Radar } from "lucide-react";
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
import { getApplicationReadinessSummary } from "@/lib/application-readiness";
import { buildDailyBriefing } from "@/lib/daily-briefing";
import {
  getNeedsFollowUp,
  getNeedsOutreach,
  getRecentlyKilled,
  getTopCandidates,
  getTourStatusBundles,
  type ListingBundle,
} from "@/lib/listing-view-models";
import { formatDateLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { searchProfile } from "@/lib/search-profile";

export default async function TodayPage() {
  await connection();

  const topCandidates = getTopCandidates(4);
  const primaryCandidate = topCandidates[0];
  const needsOutreach = getNeedsOutreach();
  const needsFollowUp = getNeedsFollowUp();
  const scheduledTours = getTourStatusBundles().filter(({ listing }) => listing.status === "tour_scheduled");
  const recentlyKilled = getRecentlyKilled();
  const readiness = getApplicationReadinessSummary();
  const briefing = buildDailyBriefing({
    topCandidates,
    needsOutreach,
    needsFollowUp,
    tourStatusBundles: scheduledTours,
    recentlyKilled,
  });

  return (
    <AppShell
      active="today"
      eyebrow="Today"
      title="Command the apartment search."
      subtitle="A compact view of ranked leads, follow-ups, tours, risk, and readiness gaps."
      action={
        <>
          <Button asChild size="sm">
            <Link href="/radar">
              <Radar />
              Radar
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
        {primaryCandidate ? <PrimaryCommand bundle={primaryCandidate} /> : <EmptyTodayCommand />}

        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-5">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="radar-label">Top candidates</p>
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
                {topCandidates.length ? (
                  topCandidates.map(({ listing, evaluation }) => (
                    <ListingCard evaluation={evaluation} key={listing.id} listing={listing} />
                  ))
                ) : (
                  <EmptyPanel
                    actionHref="/radar"
                    actionLabel="Open Radar"
                    title="No ranked candidates yet"
                    body="Keep the scanner loop running. Hot and review-worthy leads will appear here after source events are processed."
                  />
                )}
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              <ActionQueue
                icon={<Bell />}
                title="Needs outreach"
                items={needsOutreach.map((listing) => ({
                  href: `/listings/${listing.listing.id}`,
                  label: listing.listing.title,
                  detail: listing.listing.nextAction,
                }))}
              />
              <ActionQueue
                icon={<ArrowRight />}
                title="Follow-up queue"
                items={needsFollowUp.map((listing) => ({
                  href: `/listings/${listing.listing.id}`,
                  label: listing.listing.title,
                  detail: listing.listing.nextAction,
                }))}
              />
            </div>

            <ToursCard tours={scheduledTours} />
          </div>

          <aside className="grid content-start gap-5">
            <DailyBriefing brief={briefing} />
            <ReadinessCard readiness={readiness} />
            <SearchProfileCard />
            <KilledCard listings={recentlyKilled} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyTodayCommand() {
  return (
    <Card className="rounded-lg border-primary/20 shadow-sm">
      <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="radar-label">Next concrete action</p>
          <h2 className="mt-1 text-xl font-semibold leading-7">Start the scanner loop.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The database is empty. Start the watcher and let NYC Apt Radar parse, score, and classify new source events.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button asChild>
            <Link href="/radar">
              <Radar />
              Open Radar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/board">
              <ClipboardList />
              Empty board
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
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
            <Link href="/radar">Open Radar</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({
  actionHref,
  actionLabel,
  body,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  body: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-4 md:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
        <Button asChild className="w-full sm:w-auto" size="sm" variant="outline">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
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
  tours: ReturnType<typeof getTourStatusBundles>;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="radar-label">Scheduled tours</p>
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
          tours.map(({ listing }) => (
            <Link
              className="rounded-md border bg-muted/30 p-3 transition hover:border-foreground/25 hover:bg-accent/40"
              href={`/listings/${listing.id}`}
              key={listing.id}
            >
              <p className="text-sm font-semibold">{listing.title}</p>
              <p className="mt-1 text-sm font-medium">{formatDateLabel(listing.availableDate)}</p>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{listing.nextAction}</p>
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
        <p className="radar-label">Search profile</p>
        <CardTitle className="text-lg font-semibold">{searchProfile.name}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm">
        <MiniMetric label="Max rent" value={formatMoney(searchProfile.maxRentMonthly)} />
        <MiniMetric label="Tolerance" value={formatMoney(searchProfile.budgetToleranceMonthly)} />
        <MiniMetric label="Move-in" value={formatDateLabel(searchProfile.targetMoveInDate)} />
        <MiniMetric
          label="Bedrooms"
          value={`${searchProfile.bedroomsMin ?? "?"}-${searchProfile.bedroomsMax ?? "?"}`}
        />
      </CardContent>
    </Card>
  );
}

function ReadinessCard({
  readiness,
}: {
  readiness: ReturnType<typeof getApplicationReadinessSummary>;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="radar-label">Application readiness</p>
            <CardTitle className="mt-1 text-lg font-semibold">
              {readiness.trackedReadyCount}/{readiness.totalCount} tracked ready
            </CardTitle>
          </div>
          <span className="rounded-md border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            Unset
          </span>
        </div>
        <Progress value={0} />
      </CardHeader>
      <CardContent className="grid gap-2">
        {readiness.items.map((item) => (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3" key={item.id}>
            <span className="text-sm font-medium">{item.label}</span>
            <span className="text-sm font-semibold text-muted-foreground">
              {item.requiredForMostApplications ? "Untracked" : "Conditional"}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function KilledCard({ listings }: { listings: ListingBundle[] }) {
  return (
    <Card className="rounded-lg border-red-200 bg-red-50/60 shadow-sm">
      <CardHeader>
        <p className="radar-label">Recently killed</p>
        <CardTitle className="text-lg font-semibold">Do not reopen casually</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {listings.length ? (
          listings.map(({ listing }) => (
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
      <p className="radar-label">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
