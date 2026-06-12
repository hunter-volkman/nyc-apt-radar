import {
  AlertTriangle,
  Bell,
  ClipboardList,
  Clock,
  ExternalLink,
  Flame,
  Radio,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { updateRadarListingStatusFromForm } from "@/app/actions/radar";
import { AppShell } from "@/components/layout/app-shell";
import { CopyMessageButton } from "@/components/radar/copy-message-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getRadarDashboard,
  type RadarRow,
} from "@/lib/radar";
import type { RadarClassification, WatchRun } from "@/lib/types";

const classificationLabels: Record<RadarClassification, string> = {
  hot: "Hot",
  needs_review: "Needs Review",
  rejected: "Rejected",
  watch: "Watch",
};

export default async function RadarPage() {
  await connection();

  const dashboard = getRadarDashboard();
  const hotRows = dashboard.rowsByClassification.hot;
  const reviewRows = dashboard.rowsByClassification.needs_review;
  const watchRows = dashboard.rowsByClassification.watch;
  const rejectedRows = dashboard.rowsByClassification.rejected;
  const actionRows = [...hotRows, ...reviewRows, ...watchRows];
  const hotOrReviewCount = hotRows.length + reviewRows.length;

  return (
    <AppShell
      active="radar"
      eyebrow="Radar"
      title="Listings appear, disappear, and get acted on here."
      subtitle="The scanner loop is the product. This screen shows its health, its finds, and the next move."
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/board">
            <ClipboardList />
            Board
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4">
        <LoopOverview
          hotCount={hotRows.length}
          lastRun={dashboard.lastRun}
          needsReviewCount={reviewRows.length}
          pushLabel={dashboard.pushStatus.label}
          totalEvents={dashboard.rows.length}
          watchCount={watchRows.length}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <ActionQueue rows={actionRows} />
          <LoopHealthPanel
            intervalMinutes={dashboard.intervalMinutes}
            lastRun={dashboard.lastRun}
            notificationCount={dashboard.notifications.length}
            pushLabel={dashboard.pushStatus.label}
            sourceDirectory={dashboard.sourceDirectory}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <SourceLedger rows={dashboard.rows} />
          <NotificationHistory
            hotOrReviewCount={hotOrReviewCount}
            notifications={dashboard.notifications}
            rejectedCount={rejectedRows.length}
          />
        </div>
      </div>
    </AppShell>
  );
}

function LoopOverview({
  hotCount,
  lastRun,
  needsReviewCount,
  pushLabel,
  totalEvents,
  watchCount,
}: {
  hotCount: number;
  lastRun: WatchRun | null;
  needsReviewCount: number;
  pushLabel: string;
  totalEvents: number;
  watchCount: number;
}) {
  const loopHealthy = lastRun?.status === "succeeded";
  const statusLabel = lastRun ? capitalize(lastRun.status) : "Waiting";
  const statusText = lastRun
    ? `${formatDateTime(lastRun.startedAt)} · ${lastRun.eventsProcessed} processed`
    : "No scan run recorded";

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-md" variant={loopHealthy ? "secondary" : "outline"}>
              <Radio className="size-3.5" />
              {statusLabel}
            </Badge>
            <Badge className="rounded-md" variant={needsReviewCount || hotCount ? "default" : "outline"}>
              {hotCount + needsReviewCount} actionable
            </Badge>
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-7 sm:text-2xl">
            {hotCount > 0
              ? `${hotCount} hot lead${hotCount === 1 ? "" : "s"}`
              : needsReviewCount > 0
                ? `${needsReviewCount} lead${needsReviewCount === 1 ? "" : "s"} need review`
                : "Watching for new matches"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{statusText}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <SignalMetric icon={<Flame />} label="Hot" value={String(hotCount)} tone="hot" />
          <SignalMetric icon={<AlertTriangle />} label="Review" value={String(needsReviewCount)} tone="review" />
          <SignalMetric icon={<Clock />} label="Watch" value={String(watchCount)} tone="watch" />
          <SignalMetric icon={<Bell />} label="Push" value={pushLabel} tone="neutral" />
          <SignalMetric icon={<Search />} label="Events" value={String(totalEvents)} tone="neutral" wide />
        </div>
      </div>
    </section>
  );
}

function ActionQueue({ rows }: { rows: RadarRow[] }) {
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="radar-label">Action queue</p>
          <h2 className="mt-1 text-lg font-semibold">Leads worth touching now</h2>
        </div>
        <Badge className="rounded-md" variant="outline">{rows.length}</Badge>
      </div>
      <div className="grid">
        {rows.length ? (
          rows.map((row) => <LeadRow key={row.id} row={row} />)
        ) : (
          <EmptyState
            icon={<Search />}
            title="No actionable leads"
            body="The loop has not found a hot or review-worthy listing yet."
          />
        )}
      </div>
    </section>
  );
}

function LeadRow({ row }: { row: RadarRow }) {
  const listing = row.bundle?.listing ?? null;

  return (
    <article className="grid gap-3 border-b p-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-start">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <ClassificationBadge classification={row.classification} />
          <Badge className="rounded-md" variant="outline">{row.source}</Badge>
          <span className="text-xs text-muted-foreground">{row.ageLabel} old</span>
        </div>
        <h3 className="truncate text-base font-semibold">
          {listing ? (
            <Link className="hover:underline" href={`/listings/${listing.id}`}>{listing.title}</Link>
          ) : (
            "Unlinked source event"
          )}
        </h3>
        <p className="mt-1 text-sm font-medium">{row.rentLabel} · {row.neighborhoodLabel}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {listing?.address ?? "Address unknown"} · Score {row.scoreLabel}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {row.blockers.length ? (
            row.blockers.slice(0, 4).map((blocker) => (
              <Badge className="max-w-full rounded-md" key={blocker} title={blocker} variant="secondary">
                <span className="truncate">{blocker}</span>
              </Badge>
            ))
          ) : (
            <Badge className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
              Ready for outreach
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-medium leading-5 text-muted-foreground">{row.nextAction}</p>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {row.sourceUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={row.sourceUrl} rel="noreferrer" target="_blank">
                <ExternalLink />
                Open
              </a>
            </Button>
          ) : null}
          {row.message ? <CopyMessageButton message={row.message} /> : null}
          {listing && row.canMarkContacted ? (
            <StatusForm label="Contacted" listingId={listing.id} status="contacted" />
          ) : null}
          {listing && row.canKill ? (
            <StatusForm label="Kill" listingId={listing.id} status="dead" variant="destructive" />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function LoopHealthPanel({
  intervalMinutes,
  lastRun,
  notificationCount,
  pushLabel,
  sourceDirectory,
}: {
  intervalMinutes: number;
  lastRun: WatchRun | null;
  notificationCount: number;
  pushLabel: string;
  sourceDirectory: string;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <p className="radar-label">Loop health</p>
        <CardTitle className="text-lg font-semibold">Scanner</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <KeyValue label="Interval" value={`${intervalMinutes} min`} />
        <KeyValue label="Push" value={pushLabel} />
        <KeyValue label="Notifications" value={String(notificationCount)} />
        <KeyValue label="Source path" value={sourceDirectory} />
        <Separator />
        {lastRun ? (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Last run</span>
              <Badge className="rounded-md capitalize" variant={lastRun.status === "succeeded" ? "outline" : "destructive"}>
                {lastRun.status}
              </Badge>
            </div>
            <p className="font-medium">{formatDateTime(lastRun.startedAt)}</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Imported {lastRun.eventsImported}, seen {lastRun.eventsSeen}, processed {lastRun.eventsProcessed},
              created {lastRun.listingsCreated}, duplicates {lastRun.duplicatesFound}.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">No run yet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">The watcher has not written a scan result.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceLedger({ rows }: { rows: RadarRow[] }) {
  const recentRows = rows.slice(0, 10);

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="radar-label">Source ledger</p>
          <h2 className="mt-1 text-lg font-semibold">Newest scanner events</h2>
        </div>
        <Badge className="rounded-md" variant="outline">{rows.length}</Badge>
      </div>
      <div className="grid">
        {recentRows.length ? (
          recentRows.map((row) => (
            <div className="grid gap-2 border-b p-4 last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)_7rem] sm:items-center" key={row.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={row.source}>{row.source}</p>
                <p className="text-xs text-muted-foreground">{row.ageLabel} old</p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.bundle?.listing.title ?? "Unlinked source event"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.blockers.length ? row.blockers.join("; ") : "No blockers"}
                </p>
              </div>
              <ClassificationBadge classification={row.classification} />
            </div>
          ))
        ) : (
          <EmptyState
            icon={<Radio />}
            title="No source events"
            body="The loop has not recorded a source message."
          />
        )}
      </div>
    </section>
  );
}

function NotificationHistory({
  hotOrReviewCount,
  notifications,
  rejectedCount,
}: {
  hotOrReviewCount: number;
  notifications: ReturnType<typeof getRadarDashboard>["notifications"];
  rejectedCount: number;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="radar-label">Push history</p>
            <CardTitle className="mt-1 text-lg font-semibold">Notifications</CardTitle>
          </div>
          <Badge className="rounded-md" variant={hotOrReviewCount ? "default" : "outline"}>
            {hotOrReviewCount} live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <KeyValue label="Recent" value={String(notifications.length)} />
          <KeyValue label="Rejected" value={String(rejectedCount)} />
        </div>
        <Separator />
        {notifications.length ? (
          notifications.map((notification) => (
            <div className="rounded-md border bg-muted/30 p-3" key={notification.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{notification.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="rounded-md" variant="outline">{notification.channel}</Badge>
                  <Badge className="rounded-md" variant={notification.status === "failed" ? "destructive" : "secondary"}>
                    {notification.status}
                  </Badge>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm leading-5 text-muted-foreground">{notification.body}</p>
              {notification.errorMessage ? (
                <p className="mt-2 text-xs text-destructive">{notification.errorMessage}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</p>
            </div>
          ))
        ) : (
          <EmptyState
            icon={<Bell />}
            title="No pushes yet"
            body="Hot and review-worthy leads will appear here after a scan."
          />
        )}
      </CardContent>
    </Card>
  );
}

function StatusForm({
  label,
  listingId,
  status,
  variant = "outline",
}: {
  label: string;
  listingId: string;
  status: string;
  variant?: "outline" | "destructive";
}) {
  return (
    <form action={updateRadarListingStatusFromForm}>
      <input name="id" type="hidden" value={listingId} />
      <input name="status" type="hidden" value={status} />
      <Button size="sm" type="submit" variant={variant}>{label}</Button>
    </form>
  );
}

function ClassificationBadge({ classification }: { classification: RadarClassification }) {
  const classNameByClassification: Record<RadarClassification, string> = {
    hot: "border-emerald-200 bg-emerald-50 text-emerald-800",
    needs_review: "border-amber-200 bg-amber-50 text-amber-900",
    rejected: "border-red-200 bg-red-50 text-red-800",
    watch: "border-sky-200 bg-sky-50 text-sky-800",
  };
  const iconByClassification: Record<RadarClassification, ReactNode> = {
    hot: <Flame className="size-3.5" />,
    needs_review: <AlertTriangle className="size-3.5" />,
    rejected: <XCircle className="size-3.5" />,
    watch: <Clock className="size-3.5" />,
  };

  return (
    <Badge className={`w-fit rounded-md ${classNameByClassification[classification]}`} variant="outline">
      {iconByClassification[classification]}
      {classificationLabels[classification]}
    </Badge>
  );
}

function SignalMetric({
  icon,
  label,
  tone,
  value,
  wide = false,
}: {
  icon: ReactNode;
  label: string;
  tone: "hot" | "neutral" | "review" | "watch";
  value: string;
  wide?: boolean;
}) {
  const toneClass = {
    hot: "border-emerald-200 bg-emerald-50 text-emerald-900",
    neutral: "border-border bg-muted/30 text-foreground",
    review: "border-amber-200 bg-amber-50 text-amber-950",
    watch: "border-sky-200 bg-sky-50 text-sky-950",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass} ${wide ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase">
        <span className="[&>svg]:size-3.5">{icon}</span>
        {label}
      </div>
      <p className="mt-2 min-w-0 break-words text-lg font-semibold leading-6">{value}</p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

function EmptyState({
  body,
  icon,
  title,
}: {
  body: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="grid gap-2 p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2 text-foreground">
        <span className="[&>svg]:size-4">{icon}</span>
        <span className="font-semibold">{title}</span>
      </div>
      <p className="leading-6">{body}</p>
    </div>
  );
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
