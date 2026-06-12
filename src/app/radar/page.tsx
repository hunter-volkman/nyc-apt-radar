import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Flame,
  Inbox,
  Radar,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import {
  importSourceEventFromForm,
  updateRadarListingStatusFromForm,
} from "@/app/actions/radar";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  getRadarDashboard,
  type RadarRow,
} from "@/lib/radar";
import type { RadarClassification, WatchRun } from "@/lib/types";

const radarSections: Array<{
  classification: RadarClassification;
  title: string;
  icon: ReactNode;
}> = [
  { classification: "hot", title: "Hot", icon: <Flame /> },
  { classification: "watch", title: "Watch", icon: <Clock /> },
  { classification: "needs_review", title: "Needs Review", icon: <AlertTriangle /> },
  { classification: "rejected", title: "Rejected", icon: <Ban /> },
];

export default async function RadarPage() {
  await connection();

  const dashboard = getRadarDashboard();

  return (
    <AppShell
      active="radar"
      eyebrow="Radar"
      title="Scan new apartment leads."
      subtitle="Watch source messages, dedupe listings, classify hot leads, and keep outreach one click away."
      action={
        <>
          <Button asChild size="sm">
            <Link href="/inbox">
              <Inbox />
              Inbox
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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <ImportSourceEventPanel />
          <RadarHealthPanel
            intervalMinutes={dashboard.intervalMinutes}
            lastRun={dashboard.lastRun}
            notificationCount={dashboard.notifications.length}
            pushLabel={dashboard.pushStatus.label}
            sourceDirectory={dashboard.sourceDirectory}
            totalEvents={dashboard.rows.length}
          />
        </div>

        <RadarMapPanel
          configured={Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)}
          hotCount={dashboard.rowsByClassification.hot.length}
          totalCount={dashboard.rows.length}
        />

        <div className="grid gap-4">
          {radarSections.map((section) => (
            <RadarSection
              icon={section.icon}
              key={section.classification}
              rows={dashboard.rowsByClassification[section.classification]}
              title={section.title}
            />
          ))}
        </div>

        <NotificationHistory notifications={dashboard.notifications} />
      </div>
    </AppShell>
  );
}

function ImportSourceEventPanel() {
  return (
    <Card className="rounded-lg border-primary/20 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="radar-label">Source message intake</p>
            <CardTitle className="mt-1 text-lg font-semibold">Import a listing signal</CardTitle>
          </div>
          <Badge className="rounded-md" variant="secondary">No scraping</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form action={importSourceEventFromForm} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[0.75fr_1fr]">
            <Field label="Source">
              <Input className="h-10" name="sourceName" placeholder="Alert source" />
            </Field>
            <Field label="Listing web address">
              <Input className="h-10" name="sourceUrl" placeholder="https://..." />
            </Field>
          </div>
          <Field label="Source message text">
            <Textarea
              className="min-h-36 resize-y"
              name="rawText"
              placeholder="Paste a saved-search email, listing notification, broker message, or listing text."
              required
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-muted-foreground">
              The watcher also imports .txt and .eml files from the configured source directory.
            </p>
            <Button type="submit">
              <Radar />
              Import Message
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RadarHealthPanel({
  intervalMinutes,
  lastRun,
  notificationCount,
  pushLabel,
  sourceDirectory,
  totalEvents,
}: {
  intervalMinutes: number;
  lastRun: WatchRun | null;
  notificationCount: number;
  pushLabel: string;
  sourceDirectory: string;
  totalEvents: number;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <p className="radar-label">Loop status</p>
        <CardTitle className="text-lg font-semibold">Scanner loop</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Metric label="Polling interval" value={`${intervalMinutes} min`} />
        <Metric label="Source directory" value={sourceDirectory} />
        <Metric label="Push status" value={pushLabel} />
        <Metric label="Source events" value={String(totalEvents)} />
        <Metric label="Notifications" value={String(notificationCount)} />
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
              Seen {lastRun.eventsSeen}, processed {lastRun.eventsProcessed}, created {lastRun.listingsCreated},
              duplicates {lastRun.duplicatesFound}.
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm leading-6 text-muted-foreground">
            No radar run recorded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RadarMapPanel({
  configured,
  hotCount,
  totalCount,
}: {
  configured: boolean;
  hotCount: number;
  totalCount: number;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="radar-label">Map display</p>
          <h2 className="mt-1 text-lg font-semibold">
            {configured ? "Mapbox is configured" : "Mapbox not configured"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {configured
              ? "Listing pins will appear here after coordinates are stored. Transit commute scoring is not calculated in this scanner pass."
              : "Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the map shell. Transit commute scoring remains a later dedicated thread."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-64">
          <Metric label="Hot leads" value={String(hotCount)} />
          <Metric label="Total leads" value={String(totalCount)} />
        </div>
      </CardContent>
    </Card>
  );
}

function RadarSection({
  icon,
  rows,
  title,
}: {
  icon: ReactNode;
  rows: RadarRow[];
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="[&>svg]:size-4">{icon}</span>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <Badge className="rounded-md" variant="outline">{rows.length}</Badge>
      </div>
      <div className="grid">
        {rows.length ? (
          rows.map((row) => <RadarResultRow key={row.id} row={row} />)
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Empty</p>
        )}
      </div>
    </section>
  );
}

function RadarResultRow({ row }: { row: RadarRow }) {
  const listing = row.bundle?.listing ?? null;

  return (
    <div className="grid gap-3 border-b p-4 last:border-b-0 xl:grid-cols-[11rem_minmax(0,1fr)_8rem_minmax(10rem,0.8fr)_13rem] xl:items-start">
      <div className="grid gap-1">
        <p className="radar-label">Source</p>
        <p className="truncate text-sm font-semibold" title={row.source}>{row.source}</p>
        <p className="text-xs text-muted-foreground">{row.ageLabel} old</p>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <ClassificationBadge classification={row.classification} />
          {listing ? <Badge className="rounded-md" variant="outline">{listing.status}</Badge> : null}
        </div>
        <h3 className="truncate text-sm font-semibold">
          {listing ? (
            <Link className="hover:underline" href={`/listings/${listing.id}`}>{listing.title}</Link>
          ) : (
            "Source event not linked to a listing"
          )}
        </h3>
        <p className="mt-1 text-sm font-medium">{row.rentLabel} · {row.neighborhoodLabel}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {listing?.address ?? "Address unknown"}
        </p>
      </div>

      <div className="grid gap-1">
        <p className="radar-label">Score</p>
        <p className="text-sm font-semibold">{row.scoreLabel}</p>
      </div>

      <div className="grid gap-1">
        <p className="radar-label">Blockers</p>
        <div className="flex flex-wrap gap-1.5">
          {row.blockers.length ? (
            row.blockers.slice(0, 3).map((blocker) => (
              <Badge className="max-w-full rounded-md" key={blocker} title={blocker} variant="secondary">
                <span className="truncate">{blocker}</span>
              </Badge>
            ))
          ) : (
            <Badge className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
              Ready
            </Badge>
          )}
        </div>
        {row.blockers.length > 3 ? (
          <p className="text-xs text-muted-foreground">+{row.blockers.length - 3} more</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <p className="radar-label">Next action</p>
        <p className="text-xs font-medium leading-5">{row.nextAction}</p>
        <div className="flex flex-wrap gap-2">
          {row.sourceUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={row.sourceUrl} rel="noreferrer" target="_blank">
                <ExternalLink />
                Open Listing
              </a>
            </Button>
          ) : null}
          {row.message ? <CopyMessageButton message={row.message} /> : null}
          {listing && row.canMarkContacted ? (
            <StatusForm label="Mark Contacted" listingId={listing.id} status="contacted" />
          ) : null}
          {listing && row.canKill ? (
            <StatusForm label="Kill" listingId={listing.id} status="dead" variant="destructive" />
          ) : null}
        </div>
      </div>
    </div>
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

function NotificationHistory({
  notifications,
}: {
  notifications: ReturnType<typeof getRadarDashboard>["notifications"];
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4" />
          <CardTitle className="text-lg font-semibold">Notification history</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
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
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No notifications recorded.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ClassificationBadge({ classification }: { classification: RadarClassification }) {
  const classNameByClassification: Record<RadarClassification, string> = {
    hot: "border-emerald-200 bg-emerald-50 text-emerald-800",
    watch: "border-sky-200 bg-sky-50 text-sky-800",
    needs_review: "border-amber-200 bg-amber-50 text-amber-900",
    rejected: "border-red-200 bg-red-50 text-red-800",
  };
  const labelByClassification: Record<RadarClassification, string> = {
    hot: "Hot",
    watch: "Watch",
    needs_review: "Needs Review",
    rejected: "Rejected",
  };

  return (
    <Badge className={`rounded-md ${classNameByClassification[classification]}`} variant="outline">
      {labelByClassification[classification]}
    </Badge>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="radar-label">{label}</span>
      {children}
    </label>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
