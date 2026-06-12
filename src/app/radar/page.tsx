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
      title="Watch real alerts and act fast."
      subtitle="Paste real alert text, dedupe source events, classify hot listings, and keep the next action visible."
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
            totalEvents={dashboard.rows.length}
          />
        </div>

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
            <p className="stoop-label">Manual source-event import</p>
            <CardTitle className="mt-1 text-lg font-semibold">Paste real alert text</CardTitle>
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
          <Field label="Real alert text">
            <Textarea
              className="min-h-36 resize-y"
              name="rawText"
              placeholder="Paste the alert email, message, or listing text you received."
              required
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Imports create source events, process pending events once, and record duplicates locally.
            </p>
            <Button type="submit">
              <Radar />
              Import Alert
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
  totalEvents,
}: {
  intervalMinutes: number;
  lastRun: WatchRun | null;
  notificationCount: number;
  totalEvents: number;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <p className="stoop-label">Loop status</p>
        <CardTitle className="text-lg font-semibold">Local watcher</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Metric label="Polling interval" value={`${intervalMinutes} min`} />
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
        <p className="stoop-label">Source</p>
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
        <p className="stoop-label">Score</p>
        <p className="text-sm font-semibold">{row.scoreLabel}</p>
      </div>

      <div className="grid gap-1">
        <p className="stoop-label">Blockers</p>
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
        <p className="stoop-label">Next action</p>
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
                <Badge className="rounded-md" variant="outline">{notification.channel}</Badge>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{notification.body}</p>
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
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="stoop-label">{label}</span>
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
